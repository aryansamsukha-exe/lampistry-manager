import { supabase } from "@/integrations/supabase/client";
import type { Product } from "@/components/ProductCard";

// The public RPCs are not in the generated types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/** Product fields that are intentionally published on QR pages. Prices are never exposed publicly. */
export type PublicProduct = Omit<Product, "price" | "sno" | "import_batch_id" | "created_at">;

type PublicProductRow = {
  id: string; product_code: string; description: string | null; category: string | null;
  dimensions: string | null; length: string | null; width: string | null; height: string | null;
  cbm: string | null; finish: string | null; packing_length: string | null; packing_width: string | null;
  packing_height: string | null; net_weight: string | null; image_url: string | null;
};

const toPublicProduct = (row: PublicProductRow): PublicProduct => ({
  id: row.id,
  product_code: row.product_code,
  description: row.description || "",
  category: row.category ?? undefined,
  dimensions: row.dimensions ?? undefined,
  length: row.length ?? undefined,
  width: row.width ?? undefined,
  height: row.height ?? undefined,
  cbm: row.cbm ?? "",
  finish: row.finish ?? undefined,
  packing_length: row.packing_length ?? undefined,
  packing_width: row.packing_width ?? undefined,
  packing_height: row.packing_height ?? undefined,
  net_weight: row.net_weight ?? undefined,
  imageUrl: row.image_url ?? undefined,
});

export const getPublicProductById = async (productId: string): Promise<PublicProduct | null> => {
  if (!productId) return null;
  const { data, error } = await db.rpc("get_public_product", { product_uuid: productId }).maybeSingle();
  if (error || !data) return null;
  return toPublicProduct(data);
};

/** Older printed QR codes use /public/product?code=<product code>. */
export const getPublicProductByCode = async (productCode: string): Promise<PublicProduct | null> => {
  const code = productCode?.trim();
  if (!code) return null;
  const { data, error } = await db.rpc("get_public_product_by_code", { p_code: code }).maybeSingle();
  if (error || !data) return null;
  return toPublicProduct(data);
};

/** Current public details for up to 100 products; products that no longer exist are simply missing. */
export const getPublicProducts = async (productIds: string[]): Promise<PublicProduct[]> => {
  if (productIds.length === 0) return [];
  const { data, error } = await db.rpc("get_public_products", { product_uuids: productIds.slice(0, 100) });
  if (error) throw error;
  return (data as PublicProductRow[]).map(toPublicProduct);
};
