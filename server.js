require("dotenv").config();
const {
  CoinbaseFactory,
  StateFactory,
  OrderFactory,
  PortfolioFactory,
} = require("./src/factories/index");
const { sortByMetric, wait } = require("./src/lib/utils");
const Clock = require("interval-clock");

const wakeTime = process.argv[2] || "20m";
const fraction = +process.argv[3] || 0.75;
const margin = +process.argv[4] || 0.01;
const stopMargin = +process.argv[5] || 0.005;
const walkAway = +process.argv[6] || 0.03;
const strategy = process.argv[7] || "volatility";

// Build Coinbase clients
const { public: publicClient, auth: authClient } = CoinbaseFactory(process.env);

// Build portfolio tracker
const portfolio = PortfolioFactory();

// Set clock
const interval = Clock(wakeTime || "20m");
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
      stats.vwap < -0.001 &&
      stats.slope > 0.001 &&
      stats.shortVwap < -0.005 &&
      stats.shortSlope > 0.005
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

  console.log("cleaning orphans");
  const { crypto, products } = state.get();
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
