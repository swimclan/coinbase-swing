const CoinbasePro = require("coinbase-pro");
const _reverse = require("lodash/reverse");
const { exchange } = require("../lib/constants");
const regression = require("regression");
const {
  wait,
  isValidSize,
  setSigDig,
  calcSize,
  calcLimitPrice,
  getTimeRange,
  calculateVolatility,
  calculateVWAP,
  convertTimeShortHandToMinutes,
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

function PortfolioFactory() {
  let gain = 0;
  let initialValue = 0;
  let balances = {};
  let prices = {};
  let freeze = false;

  return {
    setBalances(account) {
      balances = account.reduce((acc, inst) => {
        return {
          ...acc,
          [inst.currency]: +inst.balance,
        };
      }, {});
    },
    setTickerPrice(id, ticker) {
      prices[id.split("-")[0]] = +ticker.price;
    },
    getPrices() {
      return prices;
    },
    getBalances() {
      return balances;
    },
    reset() {
      gain = 0;
      initialValue = 0;
      freeze = false;
    },
    compute() {
      const newValue =
        Object.entries(prices).reduce((acc, [curr, price]) => {
          if (balances[curr] && balances[curr] > 0) {
            acc += balances[curr] * price;
          }
          return acc;
        }, 0) + (balances["USD"] || 0);
      if (initialValue === 0) {
        initialValue = newValue;
      } else {
        gain = (newValue - initialValue) / initialValue;
      }
    },
    getGain() {
      return gain;
    },
    freeze() {
      freeze = true;
    },
    isFrozen() {
      return freeze;
    },
  };
}

async function StateFactory({ publicClient, authClient, interval, portfolio }) {
  let ret = { cash: 0, products: {}, crypto: {} };
  try {
    const products = await publicClient.getProducts();
    const account = await authClient.getAccount();
    portfolio.setBalances(account);
    const usdInstrument = account.find((inst) => inst.currency === "USD") || {};
    ret.crypto = account
      .filter((inst) => inst.currency !== "USD")
      .reduce((acc, inst) => {
        if (+inst.available > 0) {
          return { ...acc, [inst.currency]: +inst.available };
        }
        return acc;
      }, {});
    ret.cash = usdInstrument.available || 0;
    const targetProducts = products
      .map((p) => ({
        id: p.id,
        inc: p.base_increment,
        min: p.base_min_size,
        limitOnly: p.limit_only,
      }))
      .filter(({ id }) => id.match(/USD$/))
      .filter(({ limitOnly }) => !limitOnly);

    for (const targetProduct of targetProducts) {
      const { id, inc, min } = targetProduct;
      const stats = await publicClient.getProduct24HrStats(id);
      await wait(300);
      const ticker = await publicClient.getProductTicker(id);
      portfolio.setTickerPrice(id, ticker);
      await wait(300);

      // Get price history for time series metrics for 5x the interval of the trade system
      const period = convertTimeShortHandToMinutes(interval);
      const historicTimeRange = getTimeRange(new Date(), "Minutes", period * 5);

      let priceHistory = [];
      let retryCount = 0;
      while (!priceHistory.length && retryCount < 50) {
        try {
          priceHistory = _reverse(
            await publicClient.getProductHistoricRates(id, {
              start: historicTimeRange[1],
              end: historicTimeRange[0],
              granularity: 60,
            })
          );
        } catch (err) {
          console.log("priceHistory failed");
          console.error(err.data || err.message || err);
        }
        retryCount++;
        await wait(300);
      }

      if (!priceHistory.length) {
        throw new Error("priceHistory not retrieved.  Bailing...");
      }

      // Compute percent change
      const open = stats.open;
      const price = +ticker.price;
      const change = (price - open) / open;

      const closes = priceHistory.map((ph) => ph[4]);

      // Compute volatility (sigma relative to price)
      const volatility = calculateVolatility(closes) / price;

      // Compute the linear least squares regression for long and short terms
      const points = closes.map((close, i) => [i + 1, close]);
      const { equation: longEq } = regression.linear(points, { precision: 8 });
      const slope = longEq[0];
      const { equation: shortEq } = regression.linear(points.slice(-period), {
        precision: 8,
      });
      const shortSlope = shortEq[0];

      // Compute VWAP
      const vwap = calculateVWAP(priceHistory);
      const shortVwap = calculateVWAP(priceHistory.slice(-period));

      // Compute VWAP relative to price
      const relativeVwap = (price - vwap) / vwap;
      const relativeShortVwap = (price - shortVwap) / shortVwap;

      // Compute slope relative to price
      const relativeSlope = slope / price;
      const relativeShortSlope = shortSlope / price;

      // Compute vwap-slope weighted composite
      const compositeScore = relativeVwap - relativeSlope * 5;

      ret.products[id] = {
        price,
        volatility,
        change,
        compositeScore,
        vwap: relativeVwap,
        shortVwap: relativeShortVwap,
        slope: relativeSlope,
        shortSlope: relativeShortSlope,
        min,
        inc,
      };
    }
  } catch (error) {
    typeof error === "string" && console.error(error);
    typeof error === "object" &&
      console.log(error.message || error.data || error.body);
  }

  portfolio.compute();

  return {
    get() {
      return ret;
    },
  };
}

function OrderFactory({ authClient, publicClient }) {
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
    async sell({ price, size, product_id, margin }) {
      const limitPrice = calcLimitPrice(price || targetPrice, margin);
      return await authClient.placeOrder({
        side: "sell",
        type: "limit",
        price: limitPrice.toFixed(2),
        size: +size,
        product_id,
        post_only: false,
      });
    },
    async getAll() {
      return await authClient.getOrders();
    },
    async remargin(margin, stopMargin, force = false) {
      let ret = [];
      try {
        const currentOrders = await authClient.getOrders();
        for (const currentOrder of currentOrders) {
          const ticker = await publicClient.getProductTicker(
            currentOrder.product_id
          );
          await wait(500);
          const currentLimitPrice = +currentOrder.price;
          const currentTickerPrice = +ticker.price;
          const originalPrice = currentLimitPrice / (1 + margin);
          const stopPrice = originalPrice / (1 + stopMargin);
          const shouldStop = force || currentTickerPrice <= stopPrice;
          if (shouldStop) {
            await authClient.cancelOrder(currentOrder.id);
            const newSellOrder = await this.sell({
              price: currentTickerPrice,
              size: +currentOrder.size,
              product_id: currentOrder.product_id,
              margin: 0.001,
            });
            ret.push(newSellOrder);
          }
        }
      } catch (err) {
        console.error("Remargin failed");
        console.error(err);
      }
      return ret;
    },
    async cleanOrphans(crypto, products) {
      for (const [currency, amount] of Object.entries(crypto)) {
        await wait(500);
        const product_id = `${currency}-USD`;
        const ticker = await publicClient.getProductTicker(product_id);
        try {
          if (+amount >= products[product_id].min) {
            console.log(`Selling ${amount.toString()} orphaned ${currency}...`);
            await this.sell({
              price: +ticker.price,
              size: +amount,
              product_id,
              margin: 0.001,
            });
          } else {
            console.warn(
              `Tried to clean orphaned for ${product_id} but amount was less than min size`
            );
          }
        } catch (error) {
          console.error(
            `Something failed when cleaning orhpaned for ${product_id}`
          );
          console.log(error.data || error.message || error);
        }
      }
    },
    async cancel(id) {
      return await authClient.cancelOrder(id);
    },
  };
}

module.exports = {
  CoinbaseFactory,
  StateFactory,
  OrderFactory,
  PortfolioFactory,
};
