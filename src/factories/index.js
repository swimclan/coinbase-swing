const CoinbasePro = require("coinbase-pro");
const { exchange } = require("../lib/constants");
const { wait } = require("../lib/utils");

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
  let ret = { cash: 0, products: {} };
  try {
    const [products, account] = await Promise.all([
      publicClient.getProducts(),
      authClient.getAccount(),
    ]);
    const usdInstrument = account.find((inst) => inst.currency === "USD") || {};
    ret.cash = usdInstrument.available || 0;
    const targetProductIds = products
      .map((p) => p.id)
      .filter((id) => id.match(/USD$/));
    for (const targetProductId of targetProductIds) {
      const [stats, ticker] = await Promise.all([
        publicClient.getProduct24HrStats(targetProductId),
        publicClient.getProductTicker(targetProductId),
      ]);
      await wait(1000);
      const open = stats.open;
      const price = ticker.price;
      ret.products[targetProductId] = {
        change: (price - open) / open,
      };
    }
  } catch (error) {
    typeof error === "string" && console.error(error);
    typeof error === "object" &&
      console.log(error.message || error.data || error.body);
  }

  return {
    get() {
      return ret;
    },
  };
}

module.exports = {
  CoinbaseFactory,
  State,
};
