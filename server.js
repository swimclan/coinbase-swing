require("dotenv").config();
const { CoinbaseFactory, State } = require("./src/factories/index");
const Clock = require("interval-clock");

// Build Coinbase clients
const { public: publicClient, auth: authClient } = CoinbaseFactory(process.env);

// Set clock
const interval = Clock("5s");
interval.on("tick", main);

// Main routine
async function main() {
  const state = await State({ publicClient, authClient });
  console.log(state.get());
}
