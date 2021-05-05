const express = require("express");
const bodyParser = require("body-parser");
const isEmpty = require("lodash/isEmpty");
require("dotenv").config();
const {
  CoinbaseFactory,
  StateFactory,
  OrderFactory,
  PortfolioFactory,
  MarketCapFactory,
} = require("./src/factories/index");
const { sortByMetric, wait, returnConfig } = require("./src/lib/utils");
const Clock = require("interval-clock");

const app = express();
app.use(bodyParser.json());

// CONFIG
let wakeTime = process.argv[2] || 10;
let fraction = +process.argv[3] || 0.75;
let margin = +process.argv[4] || 0.01;
let stopMargin = +process.argv[5] || 0.005;
let walkAway = +process.argv[6] || 0.03;
let strategy = process.argv[7] || "change";
let maxVwap = +process.argv[8] || -0.001;
let minSlope = +process.argv[9] || 0.001;
let isTesting = process.argv[10] === "test" || true;
let maxOrders = process.argv[11] || 1;
let maxVolatility = process.argv[12] || 0.01;
let minLoss = process.argv[13] || -0.5;
let maxRSI = process.argv[14] || 30;
let minRelVol = process.argv[15] || 5;
let maxRounds = process.argv[16] || 100;
let minMarketSlopeCategory = process.argv[17] || 3;
let maxRank = process.argv[18] || 10;

// Stores for API retrieval
let lastState = {};
let lastOrders = [];
const orderTracker = {};
let mktCapResponse;

// Build Coinbase clients
const { public: publicClient, auth: authClient } = CoinbaseFactory(process.env);

// Build CoinMarketCap client
const mktcapFactory = MarketCapFactory(process.env);
(async function () {
  mktCapResponse = await mktcapFactory.getTopCoins(maxRank);
})();

// Build portfolio tracker
const portfolio = PortfolioFactory();

// Set initial clock
let interval;
function setClock() {
  if (interval) {
    interval.removeAllListeners();
  }
  interval = Clock(`${wakeTime}m`);
  interval.on("tick", () => {
    if (!portfolio.isFrozen()) {
      main();
    } else {
      console.log("Walked away.  Waiting for tomorrow");
    }
  });
}

// Set 24 hour clock for reseting portfolio tracking and getting latest marketcap ranks
const dailyClock = Clock("24h");
dailyClock.on("tick", async () => {
  portfolio.reset();
  mktCapResponse = await mktcapFactory.getTopCoins(maxRank);
});

function getEligibleByStrategy(products, topCoins) {
  return products
    .filter(({ id }) => {
      const symbolMatcher = id.match(new RegExp(`([A-Z0-9]+)-USD`));
      const crypto = symbolMatcher ? symbolMatcher[1] : null;
      return !!topCoins.find((coin) => coin.symbol === crypto);
    })
    .filter((prod) => {
      const passRSI = prod.rsi <= maxRSI;
      if (strategy === "compositeScore") {
        return passRSI && prod.vwap <= maxVwap && prod.slope >= minSlope;
      } else if (strategy === "vwap") {
        return passRSI && prod.vwap <= maxVwap;
      } else if (strategy === "slope") {
        return passRSI && prod.slope >= minSlope;
      } else if (strategy === "change") {
        return passRSI && prod.change >= minLoss;
      } else if (strategy === "volatility") {
        return passRSI && Math.abs(prod.volatility) <= maxVolatility;
      } else if (strategy === "relativeVolume") {
        return (
          passRSI &&
          Math.abs(prod.relativeVolume) > minRelVol &&
          prod.periodSlope > 0
        );
      }
      return true;
    });
}

async function executeBuy(
  state,
  orderFactory,
  fraction,
  strategy,
  mktCapResponse
) {
  const topCoins = mktCapResponse.data;
  const sortedState = sortByMetric(state.get(), strategy);
  let eligibleProducts = getEligibleByStrategy(sortedState.products, topCoins);

  if (!eligibleProducts.length) {
    console.log("Nothing looks good...  Try again later");
    return null;
  }

  if (sortedState.marketSlopeCategory < minMarketSlopeCategory) {
    console.log("Market is too bearish... Try again later");
    return null;
  }
  const productToBuy = eligibleProducts[0];

  console.log(`Buying...`);
  console.log(productToBuy);
  return await orderFactory.buy({
    product: productToBuy,
    cash: sortedState.cash,
    fraction,
  });
}

async function executeSell(buyOrder, orderFactory, margin) {
  let filled = false;
  let completedOrder;
  let tryCount = 1;
  while (!filled && tryCount <= 100) {
    completedOrder = await authClient.getOrder(buyOrder.id);
    await wait(300);
    if (+completedOrder.filled_size > 0) {
      filled = true;
    }
    tryCount++;
  }
  if (!filled) {
    throw new Error("Couldnt execute the sell, trying again");
  }
  console.log("Placing limit sell");
  return await orderFactory.sell({ ...buyOrder, margin });
}

async function executeWalkAway(portfolio, orderFactory) {
  portfolio.freeze();
  await orderFactory.remargin(margin, stopMargin, true);
}

// Main routine
async function main() {
  console.log("Fetching state");
  const state = await StateFactory({
    publicClient,
    authClient,
    interval: wakeTime,
    portfolio,
  });
  const orderFactory = OrderFactory({ authClient, publicClient });
  await orderFactory.init();

  // Assign latest current orders to global lastOrders for api retrieval
  lastOrders = orderFactory.getAllOrders();

  // Walk away?
  const currentGain = portfolio.getGain();
  if (currentGain >= walkAway) {
    await executeWalkAway(portfolio, orderFactory);
    return;
  }

  // Assign latest state to global lastState for api retrieval
  lastState = state.get();

  if (isTesting) {
    console.info("System is testing. No market operations will commence...");
    return;
  }
  const { crypto, products } = lastState;

  console.log("cleaning orphans");
  await orderFactory.cleanOrphans(crypto, products);

  console.log("Analyzing existing orders");
  const resells = await orderFactory.remargin(margin, stopMargin);
  console.log(`Remargined ${resells.length} orders`);

  // Check to see if there are stale orders in the market and cancel/abandon them
  const abandonedOrders = await orderFactory.abandonStale(
    orderTracker,
    maxRounds
  );
  abandonedOrders.length &&
    console.log(
      "Stale orders detected abandoned",
      abandonedOrders.map((o) => o.product_id).join(", ")
    );

  // Check to see if you are under max allowed open orders
  if (orderFactory.getAllOrders().length >= maxOrders && maxOrders > 0) {
    console.log("Max orders reached.  New orders not allowed at this time...");
    return;
  }

  // Place the market buy
  let buyOrder;
  try {
    buyOrder = await executeBuy(
      state,
      orderFactory,
      fraction,
      strategy,
      mktCapResponse
    );
  } catch (err) {
    console.error(typeof err === "object" ? err.data || err.message : err);
    buyOrder = null;
  }

  if (!buyOrder) {
    console.log("No buy opportunity or failure occured");
    return;
  }

  // Place the sell order
  let sellOrder,
    sold = false;
  while (!sold) {
    try {
      sellOrder = await executeSell(buyOrder, orderFactory, margin);
      sold = true;
    } catch (err) {
      console.warn("Couldnt get sell order placed. Trying again....");
      // do nothing
    }
  }
  sellOrder && console.log("Limit sell placed:");
  sellOrder && console.log(JSON.stringify(sellOrder));
}

/* API SECTION */

app.get("/state", (req, res, next) => {
  if (isEmpty(lastState)) {
    return res.status(200).json(lastState);
  }
  return res.status(200).json(sortByMetric(lastState, strategy));
});

app.get("/config", (req, res, next) => {
  return returnConfig(res, {
    wakeTime,
    fraction,
    margin,
    stopMargin,
    walkAway,
    strategy,
    isTesting,
    maxVwap,
    minSlope,
    maxOrders,
    maxVolatility,
    minLoss,
    maxRSI,
    minRelVol,
    maxRounds,
    minMarketSlopeCategory,
    maxRank,
  });
});

app.get("/portfolio", (req, res, next) => {
  return res.status(200).json({
    gain: portfolio.getGain(),
    value: portfolio.getValue(),
    frozen: portfolio.isFrozen(),
    balances: portfolio.getBalances(),
    prices: portfolio.getPrices(),
  });
});

app.post("/gain", (req, res, next) => {
  portfolio.setGain(+req.body.gain);
  return res.status(200).json({
    gain: portfolio.getGain(),
    frozen: portfolio.isFrozen(),
    balances: portfolio.getBalances(),
    prices: portfolio.getPrices(),
  });
});

app.get("/orders", (req, res, next) => {
  return res.status(200).json([...lastOrders]);
});

app.post("/config", (req, res, next) => {
  const {
    wakeTime: wt,
    fraction: f,
    margin: m,
    stopMargin: sm,
    walkAway: wa,
    strategy: s,
    isTesting: it,
    maxVwap: mv,
    minSlope: ms,
    maxOrders: mo,
    maxVolatility: mvol,
    minLoss: ml,
    maxRSI: mr,
    minRelVol: mrv,
    maxRounds: mxr,
    minMarketSlopeCategory: msc,
    maxRank: mrk,
  } = req.body;

  wt && (wakeTime = wt);
  f && (fraction = f);
  m && (margin = m);
  sm && (stopMargin = sm);
  wa && (walkAway = wa);
  s && (strategy = s);
  isTesting = !!it;
  mv && (maxVwap = mv);
  ms && (minSlope = ms);
  mo != null && !isNaN(mo) && (maxOrders = mo);
  mvol && (maxVolatility = mvol);
  ml && (minLoss = ml);
  mr && (maxRSI = mr);
  mrv && (minRelVol = mrv);
  mxr && (maxRounds = mxr);
  msc && (minMarketSlopeCategory = msc);
  mrk && (maxRank = mrk);

  setClock();

  return returnConfig(res, {
    wakeTime,
    fraction,
    margin,
    stopMargin,
    walkAway,
    strategy,
    isTesting,
    maxVwap,
    minSlope,
    maxOrders,
    maxVolatility,
    minLoss,
    maxRSI,
    minRelVol,
    maxRounds,
    minMarketSlopeCategory,
    maxRank,
  });
});

app.get("/orders", (req, res, next) => {
  return res.status(200).json({ orders: lastOrders });
});

app.get("/walk", async (req, res, next) => {
  const orderFactory = OrderFactory({ authClient, publicClient });
  await orderFactory.init();
  await executeWalkAway(portfolio, orderFactory);
  return res.status(200).json({
    gain: portfolio.getGain(),
    frozen: portfolio.isFrozen(),
    balances: portfolio.getBalances(),
    prices: portfolio.getPrices(),
  });
});

app.get("/resume", (req, res, next) => {
  portfolio.reset();
  return res.status(200).json({
    gain: portfolio.getGain(),
    frozen: portfolio.isFrozen(),
    balances: portfolio.getBalances(),
    prices: portfolio.getPrices(),
  });
});

app.listen(process.env.NODE_PORT, () => {
  console.info(`App server running on port ${process.env.NODE_PORT}`);
});
