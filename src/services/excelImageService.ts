import JSZip from "jszip";
import { compressImage, type CropFractions as Crop } from "@/services/imageCompression";

/** A picture placed on the first worksheet, rendered as a JPEG data URL. */
export type SheetImage = { row: number; col: number; dataUrl: string };

type Anchor = { row: number; col: number; mediaPath: string; crop: Crop };

const MIME_TYPES: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", bmp: "image/bmp", webp: "image/webp",
};

const parseXml = (text: string) => new DOMParser().parseFromString(text, "application/xml");

const byLocalName = (parent: Document | Element, name: string) =>
  Array.from(parent.getElementsByTagNameNS("*", name));

const attr = (el: Element, localName: string) =>
  Array.from(el.attributes).find((a) => a.localName === localName)?.value ?? null;

const resolvePath = (fromFile: string, target: string) => {
  if (target.startsWith("/")) return target.slice(1);
  const parts = fromFile.split("/").slice(0, -1);
  for (const segment of target.split("/")) {
    if (segment === "..") parts.pop();
    else if (segment !== ".") parts.push(segment);
  }
  return parts.join("/");
};

const relsPathFor = (file: string) => {
  const parts = file.split("/");
  const name = parts.pop();
  return [...parts, "_rels", `${name}.rels`].join("/");
};

const readRelationships = async (zip: JSZip, file: string) => {
  const relsFile = zip.file(relsPathFor(file));
  if (!relsFile) return [];
  return byLocalName(parseXml(await relsFile.async("string")), "Relationship").map((rel) => ({
    id: rel.getAttribute("Id") ?? "",
    type: rel.getAttribute("Type") ?? "",
    target: resolvePath(file, rel.getAttribute("Target") ?? ""),
  }));
};

const firstSheetPath = async (zip: JSZip) => {
  const workbook = zip.file("xl/workbook.xml");
  if (!workbook) return null;
  const firstSheet = byLocalName(parseXml(await workbook.async("string")), "sheet")[0];
  const relId = firstSheet && attr(firstSheet, "id");
  const rels = await readRelationships(zip, "xl/workbook.xml");
  return rels.find((r) => r.id === relId)?.target ?? null;
};

// srcRect values are thousandths of a percent; negative values mean padding, which we ignore.
const readCrop = (pic: Element): Crop => {
  const rect = byLocalName(pic, "srcRect")[0];
  const value = (name: string) => Math.max(0, Number(rect?.getAttribute(name) ?? 0) / 100000);
  return { l: value("l"), t: value("t"), r: value("r"), b: value("b") };
};

const readAnchors = async (zip: JSZip, drawingPath: string): Promise<Anchor[]> => {
  const drawing = zip.file(drawingPath);
  if (!drawing) return [];
  const doc = parseXml(await drawing.async("string"));
  const rels = await readRelationships(zip, drawingPath);

  return [...byLocalName(doc, "twoCellAnchor"), ...byLocalName(doc, "oneCellAnchor")].flatMap((anchor) => {
    const from = byLocalName(anchor, "from")[0];
    const pic = byLocalName(anchor, "pic")[0];
    const blip = pic && byLocalName(pic, "blip")[0];
    if (!from || !blip) return [];

    const mediaPath = rels.find((r) => r.id === attr(blip, "embed"))?.target;
    if (!mediaPath) return [];

    return [{
      row: Number(byLocalName(from, "row")[0]?.textContent ?? -1),
      col: Number(byLocalName(from, "col")[0]?.textContent ?? -1),
      mediaPath,
      crop: readCrop(pic),
    }];
  });
};

/**
 * Extracts pictures placed over cells of the first worksheet, applying Excel's crop.
 * Row/col are 0-based sheet coordinates of the cell the picture's top-left corner sits in.
 */
export const extractSheetImages = async (data: ArrayBuffer): Promise<SheetImage[]> => {
  const zip = await JSZip.loadAsync(data);
  const sheetPath = await firstSheetPath(zip);
  if (!sheetPath) return [];

  const drawingPaths = (await readRelationships(zip, sheetPath))
    .filter((r) => r.type.endsWith("/drawing"))
    .map((r) => r.target);

  const images: SheetImage[] = [];
  for (const drawingPath of drawingPaths) {
    for (const anchor of await readAnchors(zip, drawingPath)) {
      const media = zip.file(anchor.mediaPath);
      if (!media) continue;
      const extension = anchor.mediaPath.split(".").pop()?.toLowerCase() ?? "";
      const blob = new Blob([await media.async("arraybuffer")], { type: MIME_TYPES[extension] ?? "" });
      const dataUrl = await compressImage(blob, anchor.crop);
      if (dataUrl) images.push({ row: anchor.row, col: anchor.col, dataUrl });
    }
  }
  return images;
};
