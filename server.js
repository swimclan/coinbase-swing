require("dotenv").config();
const {
  CoinbaseFactory,
  StateFactory,
  OrderFactory,
} = require("./src/factories/index");
const { sortByPercentChange, wait } = require("./src/lib/utils");
const Clock = require("interval-clock");

const wakeTime = process.argv[2];
const fraction = +process.argv[3] || 0.75;
const margin = +process.argv[4] || 0.01;

// Build Coinbase clients
const { public: publicClient, auth: authClient } = CoinbaseFactory(process.env);

// Set clock
const interval = Clock(wakeTime || "20m");
interval.on("tick", main);

async function executeBuy(state, order) {
  const sortedState = sortByPercentChange(state.get());
  const productToBuy = sortedState.products[0];

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
  const state = await StateFactory({ publicClient, authClient });
  const order = OrderFactory({ authClient, publicClient });

  console.log("cleaning orphans");
  const { crypto, products } = state.get();
  await order.cleanOrphans(crypto, products);

  console.log("Analyzing existing orders");
  const resells = await order.remargin(margin);
  console.log(`Remargined ${resells.length} orders`);

  let buyOrder;
  try {
    buyOrder = await executeBuy(state, order);
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
      console.error(err);
    }
  }
  sellOrder && console.log("Sold...");
  sellOrder && console.log(sellOrder);
}
