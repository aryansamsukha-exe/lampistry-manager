export const MAX_IMAGE_DIMENSION = 1200;
export const JPEG_QUALITY = 0.85;

export type CropFractions = { l: number; t: number; r: number; b: number };

const NO_CROP: CropFractions = { l: 0, t: 0, r: 0, b: 0 };

/**
 * Resizes an image so its longest side is at most MAX_IMAGE_DIMENSION and re-encodes it as JPEG
 * on a white background, optionally turned clockwise by quarterTurns × 90°.
 * Returns null when the browser cannot decode the file (e.g. EMF, HEIC).
 */
export const compressImage = async (
  blob: Blob,
  crop: CropFractions = NO_CROP,
  quarterTurns = 0
): Promise<string | null> => {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    return null;
  }

  const sx = bitmap.width * crop.l;
  const sy = bitmap.height * crop.t;
  const sw = bitmap.width * (1 - crop.l - crop.r);
  const sh = bitmap.height * (1 - crop.t - crop.b);
  if (sw <= 1 || sh <= 1) {
    bitmap.close();
    return null;
  }

  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(sw, sh));
  const w = Math.round(sw * scale);
  const h = Math.round(sh * scale);
  const turns = ((Math.round(quarterTurns) % 4) + 4) % 4;
  const canvas = document.createElement("canvas");
  canvas.width = turns % 2 ? h : w;
  canvas.height = turns % 2 ? w : h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return null;
  }

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((turns * Math.PI) / 2);
  ctx.drawImage(bitmap, sx, sy, sw, sh, -w / 2, -h / 2, w, h);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
};

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

/** Compressed data URL, or the original file as a data URL if it cannot be compressed or would grow. */
export const compressImageOrKeep = async (blob: Blob): Promise<string> => {
  const original = await blobToDataUrl(blob);
  const compressed = await compressImage(blob);
  return compressed && compressed.length < original.length ? compressed : original;
};

/** Loads an image (URL or data URL) and returns it turned clockwise by quarterTurns × 90°. */
export const rotateImage = async (src: string, quarterTurns: number): Promise<string> => {
  const response = await fetch(src);
  if (!response.ok) throw new Error(`Could not load the photo (${response.status}).`);
  const rotated = await compressImage(await response.blob(), NO_CROP, quarterTurns);
  if (!rotated) throw new Error("This photo format cannot be rotated in the browser.");
  return rotated;
};

/** Approximate size in bytes of the data encoded in a base64 data URL. */
export const dataUrlBytes = (dataUrl: string) => Math.round((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75);

export const formatBytes = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
