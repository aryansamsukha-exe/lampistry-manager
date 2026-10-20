import type { Product } from "@/components/ProductCard";

export const BRAND_NAME = "ANJANI ART";
export const SIZE_UNIT = "in";

type SizeSource = Pick<Product, "length" | "width" | "height" | "dimensions">;
type PackingSource = Pick<Product, "packing_length" | "packing_width" | "packing_height">;

const joinSize = (l?: string, w?: string, h?: string) =>
  l && w && h ? `${l} × ${w} × ${h} ${SIZE_UNIT}` : null;

/** Item size as "L × W × H in", falling back to the free-text dimensions column. */
export const formatItemSize = (p: SizeSource) => joinSize(p.length, p.width, p.height) ?? (p.dimensions || null);

export const formatPackingSize = (p: PackingSource) => joinSize(p.packing_length, p.packing_width, p.packing_height);

/** Price in USD, or null when it has not been set yet (0) so callers can hide it. */
export const formatPrice = (p: Pick<Product, "price">) => (p.price > 0 ? `$${p.price.toFixed(2)}` : null);

export const formatNetWeight = (p: Pick<Product, "net_weight">) => (p.net_weight ? `${p.net_weight} kg` : null);

const SMALL_WORDS = new Set(["a", "an", "and", "as", "at", "by", "for", "in", "of", "on", "or", "the", "to", "with"]);

/** "WOODEN FLOOR LAMP WITH SHADE" → "Wooden Floor Lamp with Shade". */
export const toTitleCase = (text: string) =>
  text
    .trim()
    .toLowerCase()
    .split(/(\s+)/)
    .map((word, i) => (i > 0 && SMALL_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join("");
