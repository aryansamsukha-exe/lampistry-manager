import { describe, expect, it } from "vitest";
import { cardTitle, formatCardPrice, formatCardSize } from "./showroomCard";

describe("formatCardPrice", () => {
  it("drops decimals for whole dollars", () => expect(formatCardPrice(29)).toBe("$29"));
  it("keeps cents otherwise", () => expect(formatCardPrice(4.7)).toBe("$4.70"));
  it("hides missing or zero prices", () => {
    expect(formatCardPrice(null)).toBeNull();
    expect(formatCardPrice(0)).toBeNull();
  });
});

describe("formatCardSize", () => {
  it("joins all three dimensions", () => expect(formatCardSize({ length: "18", width: "18", height: "50" })).toBe("18 × 18 × 50 in"));
  it("labels partial sizes", () => expect(formatCardSize({ height: "59" })).toBe("H 59 in"));
  it("returns null without any size", () => expect(formatCardSize({})).toBeNull());
});

describe("cardTitle", () => {
  it("title-cases capital descriptions", () => expect(cardTitle({ description: "BAMBOO CEILING LAMP" })).toBe("Bamboo Ceiling Lamp"));
  it("keeps small words lower case", () =>
    expect(cardTitle({ description: "Iron Paper Mache Floor Lamp with Shade" })).toBe("Iron Paper Mache Floor Lamp with Shade"));
  it("falls back to the code", () => expect(cardTitle({ description: " ", product_code: "AA-10609 L Shade" })).toBe("AA-10609 L Shade"));
});
