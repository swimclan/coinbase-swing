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
  getTimeRange,
  calculateVWAP,
  convertTimeShortHandToMinutes,
  calculateRSI,
  calcAverageMoves,
  calculateRelativeVolume,
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
  test("getTimeRange() will return a 24-hour date range in ISO8601", () => {
    const now = new Date();
    const dateRange = getTimeRange(now, "Minutes", 30);
    const parsedDates = dateRange.map((dr) => new Date(dr));
    expect(dateRange.length).toEqual(2);
    expect(parsedDates[0].getTime()).toEqual(now.getTime());
    expect(parsedDates[1].getTime()).toEqual(now.getTime() - 1800000);
  });
  test("calculateVWAP() will return the proper volume weighted price form an input of candles", () => {
    const candles = [
      [123, 9.0, 11.0, 10.0, 10.0, 100],
      [123, 6.0, 10.0, 8.0, 8.0, 300],
      [123, 10.0, 12.0, 11.0, 11.0, 200],
    ];
    expect(calculateVWAP(candles)).toEqual(9.33);
  });
  test("convertTimeShortHandToMinutes() will return minute value for a given shorthand", () => {
    expect(convertTimeShortHandToMinutes("5m")).toEqual(5);
    expect(convertTimeShortHandToMinutes("2h")).toEqual(120);
    expect(convertTimeShortHandToMinutes("45s")).toEqual(1);
  });
  test("calcAverageMoves() will give the average of all the moves that went in a specified direction", () => {
    // [ time, low, high, open, close, volume ]
    const candles = [
      [1000, 10, 30, 10, 20, 100],
      [1001, 10, 30, 10, 25, 100],
      [1002, 10, 30, 10, 20, 100],
      [1003, 10, 30, 10, 5, 100],
    ];

    expect(calcAverageMoves(candles, "up")).toEqual(5);
    expect(calcAverageMoves(candles, "down")).toEqual(10);
  });
  test("calculateRSI() will calculate the RSI for a given set of candles", () => {
    const candles = [
      [1000, 10, 30, 10, 20, 100],
      [1001, 10, 30, 10, 25, 100],
      [1002, 10, 30, 10, 20, 100],
      [1003, 10, 30, 10, 5, 100],
    ];
    expect(calculateRSI(candles).toFixed(2)).toEqual("33.33");
  });
  test("calculateRelativeVolume() will return the relative volume of the most recent n candles", () => {
    const candles = [
      [1000, 10, 30, 10, 20, 300],
      [1000, 10, 30, 10, 20, 100],
      [1001, 10, 30, 10, 25, 200],
      [1002, 10, 30, 10, 20, 300],
      [1003, 10, 30, 10, 15, 400],
      [1003, 10, 30, 10, 15, 300],
      [1003, 10, 30, 10, 15, 700],
      [1003, 10, 30, 10, 15, 1300],
    ];
    expect(calculateRelativeVolume(candles, 2).toFixed(2)).toEqual("2.22");
  });
});
