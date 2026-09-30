import type { Product } from "@/components/ProductCard";

/**
 * Converts a dimension value such as "45", "45 cm", or "45.5cm" to cm.
 * Catalog imports use centimetres unless a unit is written explicitly.
 */
const dimensionInCentimetres = (value?: string): number | null => {
  if (!value) return null;

  const normalized = String(value).trim().toLowerCase().replace(",", ".");
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;

  const numericValue = Number(match[0]);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return null;

  if (/mm\s*$/.test(normalized)) return numericValue / 10;
  if (/(?:m|metre|meter)s?\s*$/.test(normalized) && !/cm\s*$/.test(normalized)) return numericValue * 100;
  return numericValue;
};

/** Calculates cubic metres from L × W × H. Plain values are treated as cm. */
export const calculateCbm = (product: Pick<Product, "length" | "width" | "height">): number | null => {
  const length = dimensionInCentimetres(product.length);
  const width = dimensionInCentimetres(product.width);
  const height = dimensionInCentimetres(product.height);

  if (length === null || width === null || height === null) return null;
  return (length * width * height) / 1_000_000;
};

export const formatCbm = (product: Pick<Product, "length" | "width" | "height" | "cbm">): string => {
  const calculated = calculateCbm(product);
  if (calculated !== null) return calculated.toFixed(4);
  return product.cbm && product.cbm !== "N/A" ? product.cbm : "—";
};

export const withCalculatedCbm = (product: Product): Product => {
  const calculated = calculateCbm(product);
  return calculated === null ? product : { ...product, cbm: calculated.toFixed(4) };
};
