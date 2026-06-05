"use strict";

const {
  money,
  toCurrencyString,
  charmRound,
  grossUpForGatewayFee,
} = require("../../../src/utils/money");

describe("money utilities", () => {
  test("money() parses safely", () => {
    expect(money("123.45").toFixed(2)).toBe("123.45");
    expect(money(123.45).toFixed(2)).toBe("123.45");
  });

  test("money() rejects NaN", () => {
    expect(() => money(NaN)).toThrow();
    expect(() => money(null)).toThrow();
  });

  test("toCurrencyString formats to 2dp", () => {
    expect(toCurrencyString("123.456")).toBe("123.46");
    expect(toCurrencyString("123.454")).toBe("123.45");
  });

  test("charmRound USD rounds up to next .99", () => {
    expect(charmRound("74.32", "USD").toString()).toBe("74.99");
  });

  test("grossUpForGatewayFee inverts a percentage fee", () => {
    const gross = grossUpForGatewayFee("100", { pct: "0.02", fixed: "0" });
    expect(gross.toFixed(2)).toBe("102.04");
  });
});
