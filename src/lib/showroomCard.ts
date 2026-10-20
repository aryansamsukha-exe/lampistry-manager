import { SIZE_UNIT, toTitleCase } from "@/lib/productDisplay";

type CardSource = {
  description?: string | null;
  product_code?: string | null;
  length?: string | null;
  width?: string | null;
  height?: string | null;
  price?: number | null;
};

/** "$29" for whole dollars, "$4.70" otherwise; null when there is no price. */
export const formatCardPrice = (price?: number | null) => {
  if (price === null || price === undefined || !(price > 0)) return null;
  return Number.isInteger(price) ? `$${price}` : `$${price.toFixed(2)}`;
};

/** "18 × 18 × 50 in", or labelled parts ("H 59 in") when only some dimensions are known. */
export const formatCardSize = ({ length, width, height }: CardSource) => {
  const l = length?.trim(), w = width?.trim(), h = height?.trim();
  if (l && w && h) return `${l} × ${w} × ${h} ${SIZE_UNIT}`;
  const parts = [l && `L ${l}`, w && `W ${w}`, h && `H ${h}`].filter(Boolean);
  return parts.length ? `${parts.join(" × ")} ${SIZE_UNIT}` : null;
};

export const cardTitle = ({ description, product_code }: CardSource) =>
  description?.trim() ? toTitleCase(description) : product_code?.trim() || "";
