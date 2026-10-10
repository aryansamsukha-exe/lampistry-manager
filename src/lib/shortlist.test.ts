import { describe, expect, it } from "vitest";
import {
  MAX_QUANTITY, MAX_SHORTLIST_ITEMS, addToList, clampQuantity, parseStoredList, refreshFromProducts,
  removeFromList, updateInList,
} from "./shortlist";
import type { PublicProduct } from "@/services/publicProductService";

const product = (id: string, overrides: Partial<PublicProduct> = {}): PublicProduct => ({
  id,
  product_code: `CODE-${id}`,
  description: `Lamp ${id}`,
  cbm: "",
  length: "10",
  width: "20",
  height: "30",
  ...overrides,
});

describe("shortlist list operations", () => {
  it("adds a product once with quantity 1 and a size snapshot", () => {
    const list = addToList(addToList([], product("a"), 1), product("a"), 2);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ productId: "a", productCode: "CODE-a", quantity: 1, itemSize: "10 × 20 × 30 in" });
  });

  it("stops adding at the maximum size", () => {
    let list = Array.from({ length: MAX_SHORTLIST_ITEMS }, (_, i) => product(String(i)))
      .reduce((acc, p) => addToList(acc, p), [] as ReturnType<typeof addToList>);
    list = addToList(list, product("extra"));
    expect(list).toHaveLength(MAX_SHORTLIST_ITEMS);
  });

  it("updates details and clamps quantity", () => {
    const list = addToList([], product("a"));
    expect(updateInList(list, "a", { quantity: 0 })[0].quantity).toBe(1);
    expect(updateInList(list, "a", { quantity: MAX_QUANTITY + 5 })[0].quantity).toBe(MAX_QUANTITY);
    expect(updateInList(list, "a", { finish: "Brass" })[0]).toMatchObject({ finish: "Brass", quantity: 1 });
  });

  it("removes products", () => {
    const list = addToList(addToList([], product("a")), product("b"));
    expect(removeFromList(list, "a").map((i) => i.productId)).toEqual(["b"]);
  });

  it("refreshes snapshots but keeps buyer edits", () => {
    const list = updateInList(addToList([], product("a")), "a", { quantity: 12 });
    const [item] = refreshFromProducts(list, [product("a", { product_code: "NEW", imageUrl: "x.jpg" })]);
    expect(item).toMatchObject({ productCode: "NEW", imageUrl: "x.jpg", quantity: 12 });
  });
});

describe("parseStoredList", () => {
  it("ignores corrupt storage", () => {
    expect(parseStoredList("not json")).toEqual([]);
    expect(parseStoredList('{"a":1}')).toEqual([]);
    expect(parseStoredList(null)).toEqual([]);
  });

  it("drops invalid entries and repairs quantities", () => {
    const raw = JSON.stringify([{ productId: "a", productCode: "A", quantity: "abc" }, { nope: true }]);
    const [item, ...rest] = parseStoredList(raw);
    expect(rest).toHaveLength(0);
    expect(item).toMatchObject({ productId: "a", quantity: 1, finish: "", notes: "" });
  });

  it("clamps quantities", () => {
    expect(clampQuantity(Number.NaN)).toBe(1);
    expect(clampQuantity(2.6)).toBe(3);
  });
});
