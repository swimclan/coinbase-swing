const CoinbasePro = require("coinbase-pro");
const { exchange } = require("../lib/constants");

const instances = {};

function CoinbaseFactory(env) {
  const {
    COINBASE_API_PASSPHRASE: passphrase,
    COINBASE_API_SECRET: secret,
    COINBASE_API_KEY: key,
    NODE_ENV: environment,
  } = env;

  const apiEndpoint =
    environment === "production"
      ? exchange.PROD_API_ENDPOINT
      : exchange.STAGE_API_ENDPOINT;

  if (!instances.coinbase) {
    return (instances.coinbase = {
      public: new CoinbasePro.PublicClient(apiEndpoint),
      auth: new CoinbasePro.AuthenticatedClient(
        key,
        secret,
        passphrase,
        apiEndpoint
      ),
    });
  }
  return instances.coinbase;
}

async function State({ publicClient, authClient }) {
  const account = await authClient.getAccount();
  const usdInstrument = account.find((inst) => inst.currency === "USD");
  const stats = await publicClient.getProduct24HrStats("BTC-USD");
  const ticker = await publicClient.getProductTicker("BTC-USD");
  const open = stats.open;
  const price = ticker.price;

  return {
    get() {
      return {
        usdValue: usdInstrument.available,
        result: { change: (price - open) / open },
      };
    },
  };
}

module.exports = {
  CoinbaseFactory,
  State,
};
