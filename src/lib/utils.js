const _sortBy = require("lodash/sortBy");

function wait(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

function returnConfig(
  res,
  {
    wakeTime,
    fraction,
    margin,
    stopMargin,
    walkAway,
    strategy,
    isTesting,
    maxVwap,
    minSlope,
    maxOrders,
    maxVolatility,
    minLoss,
  }
) {
  return res.status(200).json({
    wakeTime,
    fraction,
    margin,
    maxVwap,
    minSlope,
    stopMargin,
    walkAway,
    strategy,
    isTesting,
    maxOrders,
    maxVolatility,
    minLoss,
  });
}

function sortByMetric(state, metric) {
  const { products } = state;
  return {
    ...state,
    products: _sortBy(products, [metric]),
  };
}

function getTimeRange(now, units, offset) {
  const before = new Date();
  before[`set${units}`](now[`get${units}`]() - offset);
  return [now, before].map((d) => d.toISOString());
}

function convertTimeShortHandToMinutes(shorthand) {
  const unitFactors = {
    s: 0,
    m: 1,
    h: 60,
  };

  const charSplit = shorthand.split("");
  const unit = charSplit.pop();
  const minutes = parseInt(charSplit.join("")) * unitFactors[unit];
  return minutes || 1;
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

function calculateRSI(priceHistory) {
  const rs =
    calcAverageMoves(priceHistory, "up") /
    calcAverageMoves(priceHistory, "down");

  return 100 - 100 / (1 + rs);
}

function calcAverageMoves(priceHistory, direction) {
  const closes = priceHistory
    .slice(1)
    .filter((candle, i) => {
      if (direction === "up") {
        return candle[4] >= priceHistory[i][4];
      }
      return candle[4] < priceHistory[i][4];
    })
    .map((candle) => candle[4]);

  return meanArr(closes);
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
  getTimeRange,
  calculateVWAP,
  convertTimeShortHandToMinutes,
  returnConfig,
  calcAverageMoves,
  calculateRSI,
};
