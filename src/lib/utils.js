function wait(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

function sortByPercentChange(state) {
  const { products } = state;
  return {
    ...state,
    products: Object.entries(products)
      .map(([prod, { price, change, min, inc }]) => {
        return [prod, change, price, min, inc];
      })
      .sort((a, b) => {
        if (a[1] < b[1]) {
          return -1;
        } else if (a[1] > b[1]) {
          return 1;
        }
        return 0;
      })
      .map(([id, change, price, min, inc]) => {
        return {
          [id]: { price, change, min, inc },
        };
      }),
  };
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
  sortByPercentChange,
  calcSize,
  isValidSize,
  setSigDig,
  calcLimitPrice,
};
