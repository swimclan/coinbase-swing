const { test, expect } = require("@jest/globals");
const {
  calcSize,
  isValidSize,
  setSigDig,
  calcLimitPrice,
  meanArr,
  getDeltaYs,
  squareArr,
  sumArr,
  calculateVariance,
  calculateVolatility,
  get24HourDateRange,
} = require("../utils");

describe("utils", () => {
  test("calcSize() will calculate the size based on the product price and fraction", () => {
    expect(calcSize(1000, 100, 0.5)).toEqual(0.05);
  });
  test("isValidSize() will return boolean for whether size is valid against minimum", () => {
    expect(isValidSize(0.0002, "0.01")).toBe(false);
  });
  test("setSigDig() will fix decimal places based on increment", () => {
    expect(setSigDig(0.0239487, "0.0010000")).toEqual(0.024);
    expect(setSigDig(2.23452345, "1.0000000")).toEqual(2);
    expect(setSigDig(1230.234235345, "0.010000000")).toEqual(1230.23);
  });
  test("calcLimitPrice() will set the right limit price based on desired margin", () => {
    expect(calcLimitPrice("1000.00", 0.1)).toEqual(1100);
  });

  test("sumArr() will sum all vals in an array", () => {
    expect(sumArr([2, 4, 1, 2, 1])).toEqual(10);
  });
  test("meanArr() will return the mean of a collection of numbers", () => {
    expect(meanArr([2, 4, 1, 2, 1])).toEqual(2);
  });
  test("getDeltaYs() will return an array of delta y's with of the input values with respect to the mean", () => {
    expect(getDeltaYs([2, 4, 1, 2, 1])).toEqual([0, 2, -1, 0, -1]);
  });
  test("squareArr() will square all the numbers in an array", () => {
    expect(squareArr([0, 2, -1, 0, -1])).toEqual([0, 4, 1, 0, 1]);
  });
  test("calculateVariance() will return the variance of the input values", () => {
    expect(calculateVariance([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toEqual(8.25);
  });
  test("calculateVolatility() will return the standard deviation (volatility) of a list of values", () => {
    expect(calculateVolatility([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toEqual(2.87);
  });
  test("get24HourDateRange() will return a 24-hour date range in ISO8601", () => {
    const dateRange = get24HourDateRange(new Date());
    const parsedDates = dateRange.map((dr) => new Date(dr));
    expect(dateRange.length).toEqual(2);
    expect(parsedDates[0].getDate()).toEqual(new Date().getDate());
    expect(parsedDates[1].getDate()).toEqual(new Date().getDate() - 1);
  });
});
