require("dotenv").config();
const {
  CoinbaseFactory,
  StateFactory,
  OrderFactory,
} = require("./src/factories/index");
const { sortByPercentChange } = require("./src/lib/utils");
const Clock = require("interval-clock");

const wakeTime = process.argv[2];
const fraction = +process.argv[3] || 0.75;
const margin = +process.argv[4] || 0.01;

// Build Coinbase clients
const { public: publicClient, auth: authClient } = CoinbaseFactory(process.env);

// Set clock
const interval = Clock(wakeTime || "20m");
interval.on("tick", main);

// Main routine
async function main() {
  console.log("Fetching state");
  const state = await StateFactory({ publicClient, authClient });
  const sortedState = sortByPercentChange(state.get());
  const productToBuy = sortedState.products[0];
  const order = OrderFactory({ authClient });

  console.log(`Buying...`);
  console.log(productToBuy);
  const buyOrder = await order.buy({
    product: productToBuy,
    cash: sortedState.cash,
    fraction,
  });
  if (!buyOrder) {
    console.log("No buy opportunity");
    return;
  }
  let filled = false;
  let completedOrder;
  while (!filled) {
    completedOrder = await authClient.getOrder(buyOrder.id);
    if (+completedOrder.filled_size > 0) {
      filled = true;
    }
  }
  console.log("Placing limit sell");
  await order.sell({ ...buyOrder, margin });
}
