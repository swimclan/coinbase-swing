const { test, expect } = require("@jest/globals");
const {
  calcSize,
  isValidSize,
  setSigDig,
  calcLimitPrice,
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
});
