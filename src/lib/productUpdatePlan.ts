import type { Product } from "@/components/ProductCard";

/** Fields an updated price list may change. Packing size, net weight, photos and category are never touched. */
export const UPDATABLE_FIELDS = ["price", "description", "finish", "length", "width", "height"] as const;
export type UpdatableField = (typeof UPDATABLE_FIELDS)[number];

export const FIELD_LABELS: Record<UpdatableField, string> = {
  price: "Price (USD)",
  description: "Description",
  finish: "Finish",
  length: "Length",
  width: "Width",
  height: "Height",
};

export type FieldChange = { field: UpdatableField; from: string; to: string };
export type ProductUpdatePlan = { product: Product; changes: FieldChange[] };
export type UpdatePlan = {
  updates: ProductUpdatePlan[];
  unchanged: number;
  notFound: string[];
  duplicateCodes: string[];
  /** Codes that have no price in the sheet or in the app. */
  stillWithoutPrice: string[];
};

const display = (value: unknown) => (value === null || value === undefined ? "" : String(value).trim());

const sameValue = (a: string, b: string) => {
  if (a === b) return true;
  const x = Number(a);
  const y = Number(b);
  return a !== "" && b !== "" && Number.isFinite(x) && Number.isFinite(y) && x === y;
};

/**
 * Compares sheet rows with saved products by item code. A sheet value only replaces the
 * saved one when the sheet actually has a value, so blank cells never erase existing details.
 */
export const planProductUpdates = (sheet: Product[], existing: Product[]): UpdatePlan => {
  const byCode = new Map(existing.map((p) => [p.product_code.trim().toUpperCase(), p]));
  const seen = new Set<string>();
  const duplicateCodes: string[] = [];
  const notFound: string[] = [];
  const updates: ProductUpdatePlan[] = [];
  const stillWithoutPrice: string[] = [];
  let unchanged = 0;

  for (const row of sheet) {
    const code = row.product_code.trim().toUpperCase();
    if (seen.has(code)) {
      duplicateCodes.push(row.product_code);
      continue;
    }
    seen.add(code);

    const product = byCode.get(code);
    if (!product) {
      notFound.push(row.product_code);
      continue;
    }

    if (!(row.price > 0) && !(product.price > 0)) stillWithoutPrice.push(product.product_code);

    const changes: FieldChange[] = [];
    for (const field of UPDATABLE_FIELDS) {
      const to = field === "price" ? (row.price > 0 ? String(row.price) : "") : display(row[field]);
      const from = field === "price" ? String(product.price ?? 0) : display(product[field]);
      if (to !== "" && !sameValue(from, to)) changes.push({ field, from, to });
    }
    if (changes.length > 0) updates.push({ product, changes });
    else unchanged++;
  }

  return { updates, unchanged, notFound, duplicateCodes, stillWithoutPrice };
};
