function wait(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

function sortByMetric(state, metric) {
  const metrics = {
    change: 1,
    volatility: 2,
    changeVolatilityVwapComposite: 3,
    vwap: 4,
  };
  const { products } = state;
  return {
    ...state,
    products: Object.entries(products)
      .map(
        ([
          prod,
          {
            price,
            change,
            volatility,
            changeVolatilityVwapComposite,
            vwap,
            min,
            inc,
          },
        ]) => {
          return [
            prod,
            change,
            volatility,
            changeVolatilityVwapComposite,
            vwap,
            price,
            min,
            inc,
          ];
        }
      )
      .sort((a, b) => {
        if (a[metrics[metric]] < b[metrics[metric]]) {
          return -1;
        } else if (a[metrics[metric]] > b[metrics[metric]]) {
          return 1;
        }
        return 0;
      })
      .map(
        ([
          id,
          change,
          volatility,
          changeVolatilityVwapComposite,
          vwap,
          price,
          min,
          inc,
        ]) => {
          return {
            [id]: {
              price,
              change,
              volatility,
              changeVolatilityVwapComposite,
              vwap,
              min,
              inc,
            },
          };
        }
      ),
  };
}

function get24HourDateRange(now) {
  const yesterday = new Date();
  yesterday.setHours(now.getHours() - 24);
  return [now, yesterday].map((d) => d.toISOString());
}

function sumArr(vals) {
  return vals.reduce((acc, val) => {
    return (acc += val);
  }, 0);
}

function meanArr(vals) {
  return sumArr(vals) / vals.length;
}

function getDeltaYs(vals) {
  const mean = meanArr(vals);
  return vals.map((y) => y - mean);
}

function calculateVariance(vals = []) {
  if (vals.length === 0) {
    return 0;
  }
  const deltaYs = getDeltaYs(vals);
  const squaredErrorVals = squareArr(deltaYs);
  return sumArr(squaredErrorVals) / vals.length;
}

function calculateVolatility(vals) {
  return parseFloat(Math.sqrt(calculateVariance(vals)).toFixed(2));
}

function calculateVWAP(priceHistory) {
  const pvs = sumArr(
    priceHistory.map((ph) => meanArr([ph[1], ph[2], ph[4]]) * ph[5])
  );

  const vs = sumArr(priceHistory.map((ph) => ph[5]));
  return parseFloat((pvs / vs).toFixed(2));
}

function squareArr(vals) {
  return vals.map((val) => Math.pow(val, 2));
}

function calcSize(price, cash, fraction) {
  const cashFraction = +cash * +fraction;
  return +cashFraction / +price;
}

function isValidSize(size, minSize) {
  return +size > +minSize;
}

function setSigDig(size, increment) {
  const placeMap = increment
    .replace(".", "")
    .replace(/(0*)(1)0*/, (_, p1, p2) => {
      return `${p1 || ""}${p2}`;
    });
  const sigs = placeMap.split("").reduce((acc, dig) => {
    if (dig !== "1") {
      return acc + 1;
    }
    return acc;
  }, 0);
  return +size.toFixed(sigs);
}

function calcLimitPrice(buyPrice, margin) {
  return +buyPrice * (1 + +margin);
}

module.exports = {
  wait,
  sortByMetric,
  calcSize,
  isValidSize,
  setSigDig,
  calcLimitPrice,
  sumArr,
  meanArr,
  getDeltaYs,
  squareArr,
  calculateVariance,
  calculateVolatility,
  get24HourDateRange,
  calculateVWAP,
};
