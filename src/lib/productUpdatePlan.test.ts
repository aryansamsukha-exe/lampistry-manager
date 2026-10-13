import { describe, expect, it } from "vitest";
import type { Product } from "@/components/ProductCard";
import { planProductUpdates } from "./productUpdatePlan";

const product = (code: string, overrides: Partial<Product> = {}): Product => ({
  id: code,
  sno: 1,
  product_code: code,
  price: 0,
  cbm: "",
  description: "HANGING LAMP",
  length: "30",
  width: "30",
  height: "28",
  packing_length: "33",
  net_weight: "1.1",
  ...overrides,
});

describe("planProductUpdates", () => {
  it("fills blank prices and fixes sizes", () => {
    const plan = planProductUpdates(
      [product("AA-1", { price: 25, height: "25", packing_length: undefined, net_weight: undefined })],
      [product("AA-1", { height: "2" })]
    );
    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0].changes).toEqual([
      { field: "price", from: "0", to: "25" },
      { field: "height", from: "2", to: "25" },
    ]);
  });

  it("never erases saved values with blank sheet cells", () => {
    const plan = planProductUpdates(
      [product("AA-1", { price: 0, description: "", finish: undefined })],
      [product("AA-1", { price: 40, finish: "Brass" })]
    );
    expect(plan.updates).toHaveLength(0);
    expect(plan.unchanged).toBe(1);
  });

  it("treats equal numbers as unchanged and matches codes case-insensitively", () => {
    const plan = planProductUpdates([product("aa-1", { price: 25, length: "30.0" })], [product("AA-1", { price: 25 })]);
    expect(plan.unchanged).toBe(1);
  });

  it("reports unknown and repeated codes", () => {
    const plan = planProductUpdates([product("AA-9"), product("AA-1"), product("AA-1")], [product("AA-1")]);
    expect(plan.notFound).toEqual(["AA-9"]);
    expect(plan.duplicateCodes).toEqual(["AA-1"]);
  });
});
