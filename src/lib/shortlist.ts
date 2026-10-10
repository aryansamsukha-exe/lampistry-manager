import { useSyncExternalStore } from "react";
import type { PublicProduct } from "@/services/publicProductService";
import { formatItemSize } from "@/lib/productDisplay";

export const MAX_SHORTLIST_ITEMS = 100;
export const MAX_QUANTITY = 100000;
const STORAGE_KEY = "pm.shortlist.v1";

export type ShortlistItem = {
  productId: string;
  productCode: string;
  description: string;
  imageUrl?: string;
  itemSize?: string;
  quantity: number;
  finish: string;
  customization: string;
  notes: string;
  addedAt: number;
};

export type ShortlistEdits = Partial<Pick<ShortlistItem, "quantity" | "finish" | "customization" | "notes">>;

export const clampQuantity = (value: number) =>
  Number.isFinite(value) ? Math.min(MAX_QUANTITY, Math.max(1, Math.round(value))) : 1;

export const addToList = (items: ShortlistItem[], product: PublicProduct, now = Date.now()): ShortlistItem[] => {
  if (items.some((item) => item.productId === product.id) || items.length >= MAX_SHORTLIST_ITEMS) return items;
  return [
    ...items,
    {
      productId: product.id,
      productCode: product.product_code,
      description: product.description,
      imageUrl: product.imageUrl,
      itemSize: formatItemSize(product) ?? undefined,
      quantity: 1,
      finish: "",
      customization: "",
      notes: "",
      addedAt: now,
    },
  ];
};

export const removeFromList = (items: ShortlistItem[], productId: string) =>
  items.filter((item) => item.productId !== productId);

export const updateInList = (items: ShortlistItem[], productId: string, edits: ShortlistEdits) =>
  items.map((item) =>
    item.productId === productId
      ? { ...item, ...edits, quantity: clampQuantity(edits.quantity ?? item.quantity) }
      : item
  );

/** Refreshes snapshot details (code, photo, size) from current public product data. */
export const refreshFromProducts = (items: ShortlistItem[], products: PublicProduct[]) => {
  const byId = new Map(products.map((p) => [p.id, p]));
  return items.map((item) => {
    const product = byId.get(item.productId);
    return product
      ? {
          ...item,
          productCode: product.product_code,
          description: product.description,
          imageUrl: product.imageUrl,
          itemSize: formatItemSize(product) ?? undefined,
        }
      : item;
  });
};

const isShortlistItem = (value: unknown): value is ShortlistItem => {
  const item = value as ShortlistItem;
  return !!item && typeof item.productId === "string" && typeof item.productCode === "string";
};

export const parseStoredList = (raw: string | null): ShortlistItem[] => {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isShortlistItem).slice(0, MAX_SHORTLIST_ITEMS).map((item) => ({
      ...item,
      quantity: clampQuantity(Number(item.quantity)),
      finish: item.finish ?? "",
      customization: item.customization ?? "",
      notes: item.notes ?? "",
    }));
  } catch {
    return [];
  }
};

// ── browser store shared by all components and tabs ──

const listeners = new Set<() => void>();
let cache: ShortlistItem[] | null = null;

const read = (): ShortlistItem[] => {
  if (cache === null) {
    try {
      cache = parseStoredList(localStorage.getItem(STORAGE_KEY));
    } catch {
      cache = [];
    }
  }
  return cache;
};

const write = (items: ShortlistItem[]) => {
  cache = items;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage full or unavailable; the shortlist still works for this page view.
  }
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    cache = null;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
};

export const shortlistStore = {
  add: (product: PublicProduct) => write(addToList(read(), product)),
  remove: (productId: string) => write(removeFromList(read(), productId)),
  update: (productId: string, edits: ShortlistEdits) => write(updateInList(read(), productId, edits)),
  refresh: (products: PublicProduct[]) => write(refreshFromProducts(read(), products)),
  clear: () => write([]),
};

const EMPTY: ShortlistItem[] = [];

export const useShortlist = () => useSyncExternalStore(subscribe, read, () => EMPTY);
