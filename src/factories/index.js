const CoinbasePro = require("coinbase-pro");
const { exchange } = require("../lib/constants");
const {
  wait,
  isValidSize,
  setSigDig,
  calcSize,
  calcLimitPrice,
} = require("../lib/utils");

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

async function StateFactory({ publicClient, authClient }) {
  let ret = { cash: 0, products: {} };
  try {
    const products = await publicClient.getProducts();
    const account = await authClient.getAccount();
    const usdInstrument = account.find((inst) => inst.currency === "USD") || {};
    ret.cash = usdInstrument.available || 0;
    const targetProducts = products
      .map((p) => ({ id: p.id, inc: p.base_increment, min: p.base_min_size }))
      .filter(({ id }) => id.match(/USD$/));

    for (const targetProduct of targetProducts) {
      const { id, inc, min } = targetProduct;
      const stats = await publicClient.getProduct24HrStats(id);
      const ticker = await publicClient.getProductTicker(id);
      await wait(500);
      const open = stats.open;
      const price = ticker.price;
      ret.products[id] = {
        price,
        change: (price - open) / open,
        min,
        inc,
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

function OrderFactory({ authClient }) {
  let targetPrice;
  return {
    async buy({ product, cash, fraction }) {
      const [product_id, { price, min, inc }] = Object.entries(product)[0];
      targetPrice = price;
      const rawSize = calcSize(price, cash, fraction);
      const isValid = isValidSize(rawSize, min);
      const size = isValid ? setSigDig(rawSize, inc) : 0;
      if (size === 0) {
        return null;
      }
      return await authClient.placeOrder({
        side: "buy",
        type: "market",
        product_id,
        size,
      });
    },
    async sell({ size, product_id, margin }) {
      const limitPrice = calcLimitPrice(targetPrice, margin);
      return await authClient.placeOrder({
        side: "sell",
        type: "limit",
        price: limitPrice.toFixed(2),
        size: +size,
        product_id,
        post_only: true,
      });
    },
  };
}

module.exports = {
  CoinbaseFactory,
  StateFactory,
  OrderFactory,
};
