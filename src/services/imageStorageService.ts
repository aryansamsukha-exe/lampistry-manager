import { supabase } from "@/integrations/supabase/client";

const BUCKET = "product-images";
const PUBLIC_PREFIX = `/storage/v1/object/public/${BUCKET}/`;
const ONE_YEAR_SECONDS = "31536000";

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/bmp": "bmp",
};

export const isInlineImage = (url?: string | null) => !!url && url.startsWith("data:");

const dataUrlToBlob = async (dataUrl: string) => (await fetch(dataUrl)).blob();

const storagePath = (url?: string | null) => {
  if (!url) return null;
  const index = url.indexOf(PUBLIC_PREFIX);
  return index === -1 ? null : decodeURIComponent(url.slice(index + PUBLIC_PREFIX.length));
};

/** Uploads an image (data URL) to Storage and returns its public URL. */
export const uploadImageFile = async (userId: string, productCode: string, imageDataUrl: string): Promise<string> => {
  const blob = await dataUrlToBlob(imageDataUrl);
  const extension = EXTENSIONS[blob.type] ?? "jpg";
  const safeCode = productCode.replace(/[^a-zA-Z0-9_-]/g, "_");
  // A new name per upload so browsers and the CDN never show a cached old photo.
  const path = `${userId}/${safeCode}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: blob.type || "image/jpeg", cacheControl: ONE_YEAR_SECONDS });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
};

/** Removes Storage files behind the given URLs. Inline (data URL) images are ignored. */
export const removeImageFiles = async (urls: (string | null | undefined)[]) => {
  const paths = urls.map(storagePath).filter((p): p is string => !!p);
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from(BUCKET).remove(paths);
  if (error) console.error("Error removing image files:", error);
};

export type MigrationProgress = { done: number; total: number; moved: number; failed: number };

/**
 * Moves photos stored as base64 text in product_images into Storage, one row at a time so no
 * single request has to carry many large images.
 */
export const migrateInlineImagesToStorage = async (
  onProgress: (progress: MigrationProgress) => void
): Promise<MigrationProgress> => {
  const { data: session } = await supabase.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) throw new Error("You must be logged in.");

  const { data: rows, error } = await supabase
    .from("product_images")
    .select("id, product_code")
    .eq("user_id", userId);
  if (error) throw error;

  const progress: MigrationProgress = { done: 0, total: rows?.length ?? 0, moved: 0, failed: 0 };
  onProgress({ ...progress });

  const queue = [...(rows ?? [])];
  const worker = async () => {
    for (let row = queue.shift(); row; row = queue.shift()) {
      try {
        const { data, error: readError } = await supabase
          .from("product_images")
          .select("image_url")
          .eq("id", row.id)
          .maybeSingle();
        if (readError) throw readError;

        if (isInlineImage(data?.image_url)) {
          const url = await uploadImageFile(userId, row.product_code, data!.image_url);
          const { error: updateError } = await supabase.from("product_images").update({ image_url: url }).eq("id", row.id);
          if (updateError) throw updateError;
          progress.moved++;
        }
      } catch (err) {
        console.error(`Could not move image for ${row.product_code}:`, err);
        progress.failed++;
      }
      progress.done++;
      onProgress({ ...progress });
    }
  };

  await Promise.all([worker(), worker(), worker()]);
  return progress;
};
