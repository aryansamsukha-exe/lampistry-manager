import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export type SavedCatalog = { id: string; name: string; description?: string | null; import_batch_id?: string | null; layout: string; cover_title?: string | null; cover_subtitle?: string | null; created_at: string };

export const getSavedCatalogs = async (): Promise<SavedCatalog[]> => {
  const { data, error } = await db.from("catalogs").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as SavedCatalog[];
};

export const getCatalogProductIds = async (catalogId: string): Promise<string[]> => {
  const { data, error } = await db.from("catalog_products").select("product_id").eq("catalog_id", catalogId).order("sort_order");
  if (error) throw error;
  return (data || []).map(row => row.product_id);
};

export const saveCatalog = async (input: { id?: string; name: string; description?: string; importBatchId?: string; layout: string; coverTitle?: string; coverSubtitle?: string; productIds: string[] }) => {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session?.user) throw new Error("You must be logged in to save a catalog.");
  const payload = { user_id: session.session.user.id, name: input.name, description: input.description || null, import_batch_id: input.importBatchId || null, layout: input.layout, cover_title: input.coverTitle || null, cover_subtitle: input.coverSubtitle || null, updated_at: new Date().toISOString() };
  const query = input.id ? db.from("catalogs").update(payload).eq("id", input.id) : db.from("catalogs").insert(payload);
  const { data, error } = await query.select().single();
  if (error) throw error;
  const catalog = data as SavedCatalog;
  const { error: clearError } = await db.from("catalog_products").delete().eq("catalog_id", catalog.id);
  if (clearError) throw clearError;
  if (input.productIds.length) {
    const { error: productsError } = await db.from("catalog_products").insert(input.productIds.map((product_id, sort_order) => ({ catalog_id: catalog.id, product_id, sort_order })));
    if (productsError) throw productsError;
  }
  return catalog;
};

export const deleteCatalog = async (id: string) => {
  const { error } = await db.from("catalogs").delete().eq("id", id);
  if (error) throw error;
};
