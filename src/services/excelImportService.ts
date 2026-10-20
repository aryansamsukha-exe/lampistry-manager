import * as XLSX from "xlsx";
import type { Product } from "@/components/ProductCard";
import { withCalculatedCbm } from "@/services/catalogService";
import { extractSheetImages } from "@/services/excelImageService";
import { categorizeProduct } from "@/lib/productCategories";

type Cell = string | number | boolean | null;

const SNO_NAMES = ["sno", "s.no", "s. no", "serial", "sr.no", "sr no"];
const CODE_NAMES = ["product_code", "productcode", "item code", "product code", "code"];
const HEADER_SEARCH_ROWS = 30;

const text = (value: Cell | undefined) => (value === null || value === undefined ? "" : String(value).trim());
const normalized = (value: Cell | undefined) => text(value).toLowerCase().replace(/\s+/g, " ");

const matches = (value: Cell | undefined, names: string[]) => {
  const header = normalized(value);
  return header !== "" && names.some((name) => header === name || header.includes(name));
};

/** Copies each merged cell's value into every cell the merge covers. */
const fillMergedCells = (rows: Cell[][], merges: XLSX.Range[], origin: XLSX.CellAddress) => {
  for (const merge of merges) {
    const top = merge.s.r - origin.r;
    const left = merge.s.c - origin.c;
    const value = rows[top]?.[left] ?? null;
    if (value === null) continue;
    for (let r = top; r <= merge.e.r - origin.r; r++) {
      rows[r] = rows[r] ?? [];
      for (let c = left; c <= merge.e.c - origin.c; c++) {
        if (rows[r][c] === null || rows[r][c] === undefined) rows[r][c] = value;
      }
    }
  }
};

const findHeaderRow = (rows: Cell[][]) =>
  rows.slice(0, HEADER_SEARCH_ROWS).findIndex(
    (row) => row?.some((cell) => matches(cell, SNO_NAMES)) && row.some((cell) => matches(cell, CODE_NAMES))
  );

type DimensionColumns = { length: number; width: number; height: number };

/**
 * Finds L/W/H columns in the row under the headers. A group whose header mentions
 * packing/carton/box is the packing size; the first other group is the item size.
 */
const findDimensionColumns = (headers: Cell[], subHeaders: Cell[]) => {
  const item: DimensionColumns = { length: -1, width: -1, height: -1 };
  const packing: DimensionColumns = { length: -1, width: -1, height: -1 };
  const keys: Record<string, keyof DimensionColumns> = {
    l: "length", length: "length", w: "width", width: "width", b: "width", breadth: "width", h: "height", height: "height",
  };

  subHeaders.forEach((cell, col) => {
    const key = keys[normalized(cell)];
    if (!key) return;
    const target = /pack|carton|box|master/.test(normalized(headers[col])) ? packing : item;
    if (target[key] === -1) target[key] = col;
  });
  return { item, packing };
};

const hasAll = (columns: DimensionColumns) => columns.length >= 0 && columns.width >= 0 && columns.height >= 0;

/**
 * Reads products from the first worksheet. Handles title rows above the table, a second
 * header row with L/W/H (item and packing size), merged cells shared by several rows,
 * and pictures placed in the photo column.
 * With requireCode: false, rows that have a description but no item code are kept too.
 */
export const processExcelFile = async (
  file: File,
  { withImages = true, requireCode = true } = {}
): Promise<Product[]> => {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: "array" });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!worksheet?.["!ref"]) throw new Error("The first sheet of the Excel file is empty.");

  const origin = XLSX.utils.decode_range(worksheet["!ref"]).s;
  const merges = worksheet["!merges"] ?? [];
  const rows = XLSX.utils.sheet_to_json<Cell[]>(worksheet, { header: 1, defval: null, blankrows: true });
  fillMergedCells(rows, merges, origin);

  const headerRow = findHeaderRow(rows);
  if (headerRow === -1) {
    throw new Error('Required columns not found. The sheet needs "S.No" and "Item Code" (or "product_code") columns.');
  }

  const headers = rows[headerRow];
  const subHeaders = rows[headerRow + 1] ?? [];
  const column = (names: string[]) => headers.findIndex((cell) => matches(cell, names));

  const sno = column(SNO_NAMES);
  const code = column(CODE_NAMES);
  const photo = column(["photo", "image", "picture"]);
  const description = column(["description", "desc", "details"]);
  const finish = column(["finish", "color", "colour", "material"]);
  const price = column(["price", "rate", "cost", "amount", "fob"]);
  const cbm = column(["cbm", "cubic meter", "volume"]);
  const netWeight = column(["net weight", "net wt", "weight"]);

  const dims = findDimensionColumns(headers, subHeaders);
  const hasSubHeaderRow = hasAll(dims.item) || hasAll(dims.packing);
  if (!hasAll(dims.item)) dims.item = findDimensionColumns(headers, headers).item;
  const size = hasAll(dims.item) ? -1 : column(["size", "dimensions", "dimension", "measurements"]);

  const firstDataRow = headerRow + (hasSubHeaderRow ? 2 : 1);
  const productRows = new Map<number, Product>();

  for (let i = firstDataRow; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const cell = (col: number) => (col >= 0 ? text(row[col]) : "");
    const productCode = text(row[code]);
    if (!productCode && (requireCode || !cell(description))) continue;

    const parsedSno = parseInt(cell(sno), 10);

    const product: Product = {
      id: "",
      sno: Number.isNaN(parsedSno) ? i : parsedSno,
      product_code: productCode,
      price: parseFloat(cell(price)) || 0,
      cbm: cell(cbm) || "N/A",
      description: cell(description),
      category: categorizeProduct(cell(description)),
      finish: cell(finish) || undefined,
      net_weight: cell(netWeight) || undefined,
      length: cell(dims.item.length) || undefined,
      width: cell(dims.item.width) || undefined,
      height: cell(dims.item.height) || undefined,
      packing_length: cell(dims.packing.length) || undefined,
      packing_width: cell(dims.packing.width) || undefined,
      packing_height: cell(dims.packing.height) || undefined,
    };

    if (size >= 0 && cell(size)) {
      product.dimensions = cell(size);
      const parts = product.dimensions.split(/\s*[x×*]\s*/);
      if (parts.length === 3) [product.length, product.width, product.height] = parts.map((p) => p.trim());
    }
    if (product.length && product.width && product.height && !product.dimensions) {
      product.dimensions = `${product.length} × ${product.width} × ${product.height}`;
    }

    productRows.set(i, product);
  }

  if (productRows.size === 0) throw new Error("No valid products found in the Excel file.");

  if (withImages) await attachSheetImages(data, productRows, merges, origin, photo);

  return [...productRows.values()].map(withCalculatedCbm).sort((a, b) => a.sno - b.sno);
};

/**
 * Gives each product the picture placed on its row. A picture in a merged photo cell
 * belongs to every row of the merge (same design in several sizes).
 */
const attachSheetImages = async (
  data: ArrayBuffer,
  productRows: Map<number, Product>,
  merges: XLSX.Range[],
  origin: XLSX.CellAddress,
  photoColumn: number
) => {
  let images;
  try {
    images = await extractSheetImages(data);
  } catch (error) {
    console.error("Could not read pictures from the Excel file:", error);
    return;
  }

  const photoCol = photoColumn >= 0 ? photoColumn + origin.c : null;
  for (const image of images) {
    if (photoCol !== null && image.col !== photoCol) continue;

    const merge = merges.find(
      (m) => image.row >= m.s.r && image.row <= m.e.r && image.col >= m.s.c && image.col <= m.e.c
    );
    const firstRow = (merge ? merge.s.r : image.row) - origin.r;
    const lastRow = (merge ? merge.e.r : image.row) - origin.r;

    for (let r = firstRow; r <= lastRow; r++) {
      const product = productRows.get(r);
      if (product && !product.imageUrl) product.imageUrl = image.dataUrl;
    }
  }
};
