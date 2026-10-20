import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Product } from "@/components/ProductCard";
import { isInlineImage, removeImageFiles, uploadImageFile } from "@/services/imageStorageService";

// Tables come from supabase/showroom.sql; untyped until the generated types are refreshed.
const db = supabase as unknown as SupabaseClient;

export type ShowroomCollection = {
  id: string;
  name: string;
  client_name: string | null;
  source_file_name: string | null;
  created_at: string;
  item_count: number;
};

export type ShowroomItem = {
  id: string;
  collection_id: string;
  sort_order: number;
  product_code: string | null;
  description: string | null;
  finish: string | null;
  length: string | null;
  width: string | null;
  height: string | null;
  price: number | null;
  image_url: string | null;
};

export type ShowroomItemEdits = Partial<
  Pick<ShowroomItem, "product_code" | "description" | "finish" | "length" | "width" | "height" | "price">
>;

const currentUserId = async () => {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("You must be logged in.");
  return id;
};

const orNull = (value?: string | null) => (value?.trim() ? value.trim() : null);

export const getShowroomCollections = async (): Promise<ShowroomCollection[]> => {
  const { data, error } = await db
    .from("showroom_collections")
    .select("id, name, client_name, source_file_name, created_at, showroom_items(count)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  type Row = Omit<ShowroomCollection, "item_count"> & { showroom_items?: { count: number }[] };
  return ((data ?? []) as Row[]).map(({ showroom_items, ...c }) => ({ ...c, item_count: showroom_items?.[0]?.count ?? 0 }));
};

export const getShowroomCollection = async (id: string) => {
  const [collection, items] = await Promise.all([
    db.from("showroom_collections").select("id, name, client_name, source_file_name, created_at").eq("id", id).maybeSingle(),
    db.from("showroom_items").select("*").eq("collection_id", id).order("sort_order"),
  ]);
  if (collection.error) throw collection.error;
  if (items.error) throw items.error;
  if (!collection.data) return null;
  return { collection: collection.data as Omit<ShowroomCollection, "item_count">, items: (items.data ?? []) as ShowroomItem[] };
};

export type ImportProgress = { done: number; total: number };

/**
 * Creates a collection from rows read by processExcelFile. Photos shared by several rows
 * (one picture over merged cells) are uploaded once.
 */
export const createShowroomCollection = async (
  input: { name: string; clientName?: string; sourceFileName?: string; rows: Product[] },
  onProgress?: (progress: ImportProgress) => void
): Promise<string> => {
  const userId = await currentUserId();
  const { data: collection, error } = await db
    .from("showroom_collections")
    .insert({ user_id: userId, name: input.name.trim(), client_name: orNull(input.clientName), source_file_name: input.sourceFileName ?? null })
    .select("id")
    .single();
  if (error) throw error;

  try {
    const uploaded = new Map<string, string>();
    const photos = [...new Set(input.rows.map((r) => r.imageUrl).filter(isInlineImage))] as string[];
    const progress = { done: 0, total: photos.length };
    onProgress?.({ ...progress });
    for (const [i, dataUrl] of photos.entries()) {
      const code = input.rows.find((r) => r.imageUrl === dataUrl)?.product_code || `item-${i + 1}`;
      uploaded.set(dataUrl, await uploadImageFile(userId, `showroom-${code}`, dataUrl));
      progress.done++;
      onProgress?.({ ...progress });
    }

    const items = input.rows.map((r, i) => ({
      collection_id: collection.id,
      user_id: userId,
      sort_order: i,
      product_code: orNull(r.product_code),
      description: orNull(r.description),
      finish: orNull(r.finish),
      length: orNull(r.length),
      width: orNull(r.width),
      height: orNull(r.height),
      price: r.price > 0 ? r.price : null,
      image_url: r.imageUrl ? uploaded.get(r.imageUrl) ?? r.imageUrl : null,
    }));
    const { error: itemsError } = await db.from("showroom_items").insert(items);
    if (itemsError) throw itemsError;
  } catch (err) {
    await deleteShowroomCollection(collection.id).catch(() => undefined);
    throw err;
  }
  return collection.id;
};

export const updateShowroomItem = async (id: string, edits: ShowroomItemEdits) => {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const [key, value] of Object.entries(edits)) {
    patch[key] = key === "price" ? (typeof value === "number" && value > 0 ? value : null) : orNull(value as string | null);
  }
  const { data, error } = await db.from("showroom_items").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  return data as ShowroomItem;
};

/** Deletes an item, and its photo unless another item in the collection still uses it. */
export const deleteShowroomItem = async (item: ShowroomItem) => {
  const { error } = await db.from("showroom_items").delete().eq("id", item.id);
  if (error) throw error;
  if (!item.image_url) return;
  const { count } = await db
    .from("showroom_items")
    .select("id", { count: "exact", head: true })
    .eq("image_url", item.image_url);
  if (!count) await removeImageFiles([item.image_url]);
};

export const deleteShowroomCollection = async (id: string) => {
  const { data: items } = await db.from("showroom_items").select("image_url").eq("collection_id", id);
  const { error } = await db.from("showroom_collections").delete().eq("id", id);
  if (error) throw error;
  await removeImageFiles([...new Set((items ?? []).map((i: { image_url: string | null }) => i.image_url))] as string[]);
};
