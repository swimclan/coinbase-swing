const CoinbasePro = require("coinbase-pro");
const rp = require("request-promise");
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
  calculateRelativeVolume,
  calculateRSI,
  meanArr,
  computeSlopeScore,
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
  let newValue = 0;

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
    setGain(newGain) {
      gain = newGain;
    },
    compute() {
      newValue =
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
    getValue() {
      return newValue;
    },
    freeze() {
      freeze = true;
    },
    unfreeze() {
      freeze = false;
    },
    isFrozen() {
      return freeze;
    },
  };
}

async function StateFactory({ publicClient, authClient, interval, portfolio }) {
  let ret = { cash: 0, products: [], crypto: {} };
  try {
    const products = await publicClient.getProducts();
    await wait(300);
    const account = await authClient.getAccount();
    await wait(300);
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
      await wait(300);
      portfolio.setTickerPrice(id, ticker);
      // Get price history for time series metrics for the last 5 hours
      const period = +interval;
      const historicTimeRange = getTimeRange(new Date(), "Minutes", 300);

      let priceHistory = [];
      let retryCount = 0;
      while (!priceHistory.length && retryCount < 100) {
        priceHistory = _reverse(
          await publicClient.getProductHistoricRates(id, {
            start: historicTimeRange[1],
            end: historicTimeRange[0],
            granularity: 60,
          })
        );
        await wait(300);
        retryCount++;
      }

      if (!priceHistory.length) {
        console.error("priceHistory not retrieved:", id);
      }

      // Compute percent change
      const open = stats.open;
      const price = +ticker.price;
      const change = (price - open) / open;

      const closes = priceHistory.map((ph) => ph[4]);

      // Compute volatility (sigma relative to price)
      const volatility = calculateVolatility(closes) / price;

      // Compute the linear least squares regression
      const points = closes.map((close, i) => [i + 1, close]);
      const { equation: longEq } = regression.linear(points, { precision: 8 });
      const slope = longEq[0];

      const { equation: periodEq } = regression.linear(points.slice(-period), {
        precision: 8,
      });
      const periodSlope = periodEq[0];

      // Compute VWAP
      const vwap = calculateVWAP(priceHistory);

      // Compute percentage diff from price to vwap
      const relativeVwap = (price - vwap) / vwap;

      // Compute slope relative to price
      const relativeSlope = slope / price;

      // Compute vwap-slope weighted composite
      const compositeScore = relativeVwap - relativeSlope * 5;

      // Compute relative volume
      const relativeVolume = calculateRelativeVolume(priceHistory, period);

      // Compute RSI
      const rsi = calculateRSI(priceHistory.slice(-15));

      ret.products.push({
        id,
        price,
        volatility: -volatility,
        change,
        compositeScore,
        vwap: relativeVwap,
        slope: relativeSlope,
        slopeCategory: computeSlopeScore(relativeSlope),
        relativeVolume: -relativeVolume,
        periodSlope,
        rsi,
        min,
        inc,
      });
    }
  } catch (error) {
    typeof error === "string" && console.error(error);
    typeof error === "object" &&
      console.log(error.message || error.data || error.body);
  }

  ret.marketGain = meanArr(
    ret.products.filter((p) => p.price).map((p) => p.change)
  );
  ret.marketSlope = meanArr(
    ret.products.filter((p) => p.price).map((p) => p.slope)
  );
  ret.marketSlopeCategory = computeSlopeScore(ret.marketSlope);

  portfolio.compute();

  return {
    get() {
      return ret;
    },
  };
}

function OrderFactory({ authClient, publicClient }) {
  let targetPrice;
  let currentOrders = [];
  return {
    async init() {
      currentOrders = await authClient.getOrders();
      await wait(300);
    },
    async buy({ product, cash, fraction }) {
      const { id: product_id, price, min, inc } = product;
      targetPrice = price;
      const rawSize = calcSize(price, cash, fraction);
      const isValid = isValidSize(rawSize, min);
      const size = isValid ? setSigDig(rawSize, inc) : 0;
      if (size === 0) {
        return null;
      }
      const setOrder = await authClient.placeOrder({
        side: "buy",
        type: "market",
        product_id,
        size,
      });
      await wait(300);
      return setOrder;
    },
    async sell({ price, size, product_id, margin }) {
      const limitPrice = calcLimitPrice(price || targetPrice, margin);
      const setOrder = await authClient.placeOrder({
        side: "sell",
        type: "limit",
        price: limitPrice.toFixed(2),
        size: +size,
        product_id,
        post_only: false,
      });
      await wait(300);
      return setOrder;
    },
    getAllOrders() {
      return currentOrders;
    },
    async remargin(margin, stopMargin, force = false) {
      let ret = [];
      try {
        for (const currentOrder of currentOrders) {
          const ticker = await publicClient.getProductTicker(
            currentOrder.product_id
          );
          await wait(300);
          const currentLimitPrice = +currentOrder.price;
          const currentTickerPrice = +ticker.price;
          const originalPrice = currentLimitPrice / (1 + margin);
          const stopPrice = originalPrice / (1 + stopMargin);
          const shouldStop = force || currentTickerPrice <= stopPrice;
          if (shouldStop) {
            await authClient.cancelOrder(currentOrder.id);
            await wait(300);
            const newSellOrder = await this.sell({
              price: currentTickerPrice,
              size: +currentOrder.size - +currentOrder.filled_size,
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
    async abandonStale(orderTracker, maxRounds) {
      let ret = [];
      for (const currentOrder of currentOrders) {
        if (!orderTracker[currentOrder.id]) {
          orderTracker[currentOrder.id] = 1;
        } else {
          orderTracker[currentOrder.id]++;
        }
        if (maxRounds > 0 && orderTracker[currentOrder.id] > maxRounds) {
          const ticker = await publicClient.getProductTicker(
            currentOrder.product_id
          );
          await wait(300);
          const currentTickerPrice = +ticker.price;
          await authClient.cancelOrder(currentOrder.id);
          await wait(300);
          const newSellOrder = await this.sell({
            price: currentTickerPrice,
            size: +currentOrder.size,
            product_id: currentOrder.product_id,
            margin: 0.001,
          });
          ret.push(newSellOrder);
        }
      }
      return ret;
    },
    async cleanOrphans(crypto, products) {
      for (const [currency, amount] of Object.entries(crypto)) {
        const product_id = `${currency}-USD`;
        const ticker = await publicClient.getProductTicker(product_id);
        await wait(300);
        try {
          const product = products.find((prod) => prod.id === product_id);
          if (product && +amount >= product.min) {
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
      const canceledOrder = await authClient.cancelOrder(id);
      await wait(300);
      return canceledOrder;
    },
  };
}

function MarketCapFactory(env) {
  const { COINMARKETCAP_API_KEY: apiKey } = env;
  const requestOptions = {
    method: "GET",
    uri: "https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest",
    qs: {
      start: "1",
      convert: "USD",
    },
    headers: {
      "X-CMC_PRO_API_KEY": apiKey,
    },
    json: true,
    gzip: true,
  };

  return {
    async getTopCoins(limit) {
      requestOptions.qs.limit = limit.toString();
      return await rp(requestOptions);
    },
  };
}

module.exports = {
  CoinbaseFactory,
  StateFactory,
  OrderFactory,
  PortfolioFactory,
  MarketCapFactory,
};
