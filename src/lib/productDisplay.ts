import type { Product } from "@/components/ProductCard";

export const BRAND_NAME = "ANJANI ART";
export const SIZE_UNIT = "in";

const joinSize = (l?: string, w?: string, h?: string) =>
  l && w && h ? `${l} × ${w} × ${h} ${SIZE_UNIT}` : null;

/** Item size as "L × W × H in", falling back to the free-text dimensions column. */
export const formatItemSize = (p: Product) => joinSize(p.length, p.width, p.height) ?? (p.dimensions || null);

export const formatPackingSize = (p: Product) => joinSize(p.packing_length, p.packing_width, p.packing_height);

/** Price in USD, or null when it has not been set yet (0) so callers can hide it. */
export const formatPrice = (p: Product) => (p.price > 0 ? `$${p.price.toFixed(2)}` : null);

export const formatNetWeight = (p: Product) => (p.net_weight ? `${p.net_weight} kg` : null);
