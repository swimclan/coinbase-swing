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
let maxVwap = +process.argv[8] || 0.001;
let minSlope = +process.argv[9] || 0.001;
let isTesting = process.argv[8] === "test" || true;

let lastState = {};
let testing = isTesting;

// Build Coinbase clients
const { public: publicClient, auth: authClient } = CoinbaseFactory(process.env);

// Build portfolio tracker
const portfolio = PortfolioFactory();

// Set clock
const interval = Clock(wakeTime);
interval.on("tick", () => {
  if (!portfolio.isFrozen()) {
    main();
  } else {
    console.log("Walked away.  Waiting for tomorrow");
  }
});

// Set 24 hour clock for reseting portfolio tracking
const dailyClock = Clock("24h");
dailyClock.on("tick", portfolio.reset);

async function executeBuy(state, order, fraction, strategy) {
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
  return await order.buy({
    product: productToBuy,
    cash: sortedState.cash,
    fraction,
  });
}

async function executeSell(buyOrder, order, margin) {
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
  return await order.sell({ ...buyOrder, margin });
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
  const order = OrderFactory({ authClient, publicClient });

  // Walk away?
  const currentGain = portfolio.getGain();
  if (currentGain >= walkAway) {
    portfolio.freeze();
    await order.remargin(margin, stopMargin, true);
    return;
  }

  // Assign latest state to global lastState for api retrieval
  lastState = state.get();

  if (testing) {
    console.info("System is testing. No market operations will commence...");
    return;
  }
  const { crypto, products } = lastState;

  console.log("cleaning orphans");
  await order.cleanOrphans(crypto, products);

  console.log("Analyzing existing orders");
  const resells = await order.remargin(margin, stopMargin);
  console.log(`Remargined ${resells.length} orders`);

  let buyOrder;
  try {
    buyOrder = await executeBuy(state, order, fraction, strategy);
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
      sellOrder = await executeSell(buyOrder, order, margin);
      sold = true;
    } catch (err) {
      console.warn("Couldnt get sell order placed. Trying again....");
      // do nothing
    }
  }
  sellOrder && console.log("Sold...");
  sellOrder && console.log(sellOrder);
}

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
  });
});

app.get("/portfolio", (req, res, next) => {
  return res.status(200).json({
    balances: portfolio.getBalances(),
    prices: portfolio.getPrices(),
    gain: portfolio.getGain(),
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
  } = req.body;

  wt && (wakeTime = wt);
  f && (fraction = f);
  m && (margin = m);
  sm && (stopMargin = sm);
  wa && (walkAway = wa);
  s && (strategy = s);
  it && (isTesting = it);
  mv && (maxVwap = mv);
  ms && (minSlope = ms);

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
  });
});

app.listen(process.env.NODE_PORT, () => {
  console.info(`App server running on port ${process.env.NODE_PORT}`);
});
