const express = require("express");
const bodyParser = require("body-parser");
const isEmpty = require("lodash/isEmpty");
require("dotenv").config();
const {
  CoinbaseFactory,
  StateFactory,
  OrderFactory,
  PortfolioFactory,
} = require("./src/factories/index");
const { sortByMetric, wait, returnConfig } = require("./src/lib/utils");
const Clock = require("interval-clock");

const app = express();
app.use(bodyParser.json());

// CONFIG
let wakeTime = process.argv[2] || "24h";
let fraction = +process.argv[3] || 0.75;
let margin = +process.argv[4] || 0.01;
let stopMargin = +process.argv[5] || 0.005;
let walkAway = +process.argv[6] || 0.03;
let strategy = process.argv[7] || "change";
let maxVwap = +process.argv[8] || -0.001;
let minSlope = +process.argv[9] || 0.001;
let isTesting = process.argv[10] === "test" || true;
let maxOrders = process.argv[11] || 0;

// Stores for API retrieval
let lastState = {};
let lastOrders = [];

// Build Coinbase clients
const { public: publicClient, auth: authClient } = CoinbaseFactory(process.env);

// Build portfolio tracker
const portfolio = PortfolioFactory();

// Set initial clock
let interval;
function setClock() {
  if (interval) {
    interval.removeAllListeners();
  }
  interval = Clock(wakeTime);
  interval.on("tick", () => {
    if (!portfolio.isFrozen()) {
      main();
    } else {
      console.log("Walked away.  Waiting for tomorrow");
    }
  });
}

// Set 24 hour clock for reseting portfolio tracking
const dailyClock = Clock("24h");
dailyClock.on("tick", portfolio.reset);

async function executeBuy(state, orderFactory, fraction, strategy) {
  const sortedState = sortByMetric(state.get(), strategy);
  const eligibleProducts = sortedState.products.filter((prod) => {
    const stats = Object.values(prod)[0];
    return (
      stats.vwap < maxVwap &&
      stats.slope > minSlope &&
      stats.shortVwap < maxVwap &&
      stats.shortSlope > minSlope
    );
  });

  if (!eligibleProducts.length) {
    console.log("Nothing looks good...  Try again later");
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
    if (+completedOrder.filled_size > 0) {
      filled = true;
    }
    tryCount++;
    await wait(500);
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

  // Check to see if you are under max allowed open orders
  if (orderFactory.getAllOrders().length >= maxOrders && maxOrders > 0) {
    console.log("Max orders reached.  New orders not allowed at this time...");
    return;
  }

  let buyOrder;
  try {
    buyOrder = await executeBuy(state, orderFactory, fraction, strategy);
  } catch (err) {
    console.error(err);
    buyOrder = null;
  }

  if (!buyOrder) {
    console.log("No buy opportunity or failure occured");
    return;
  }
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
  sellOrder && console.log("Sold...");
  sellOrder && console.log(sellOrder);
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
  });
});

app.get("/portfolio", (req, res, next) => {
  return res.status(200).json({
    gain: portfolio.getGain(),
    frozen: portfolio.isFrozen(),
    balances: portfolio.getBalances(),
    prices: portfolio.getPrices(),
  });
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
  });
});

app.get("/orders", (req, res, next) => {
  return res.status(200).json({ orders: lastOrders });
});

app.get("/walk", async (req, res, next) => {
  const orderFactory = OrderFactory({ authClient, publicClient });
  await executeWalkAway(portfolio, orderFactory);
  return res.status(200).json({ result: true });
});

app.listen(process.env.NODE_PORT, () => {
  console.info(`App server running on port ${process.env.NODE_PORT}`);
});
