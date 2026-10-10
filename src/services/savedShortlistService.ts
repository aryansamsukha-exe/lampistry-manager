import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getBuyerSessionId, getTrackingCode } from "@/lib/buyerSession";
import { BRAND_NAME } from "@/lib/productDisplay";
import type { ContactFields } from "@/lib/enquiryValidation";
import { shortlistStore, toSavedItems, type SavedShortlistItem } from "@/lib/shortlist";
import { getPublicProducts } from "@/services/publicProductService";

// The public RPCs are not in the generated types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const TOKEN_KEY = "pm.shortlist.token";
const CONTACT_KEY = "pm.buyerContact";
const PROMPT_KEY = "pm.shortlist.savePrompt";
const SYNC_DELAY_MS = 1500;

export type BuyerContact = ContactFields;

const storage = {
  get: (key: string) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Storage unavailable; saving still works for this visit.
    }
  },
};

const isToken = (value: string | null): value is string => !!value && /^[0-9a-f]{64}$/.test(value);

// ── saved state shared by components ──

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
const subscribeSaved = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getShortlistToken = () => {
  const token = storage.get(TOKEN_KEY);
  return isToken(token) ? token : null;
};

export const useShortlistToken = () => useSyncExternalStore(subscribeSaved, getShortlistToken, () => null);

export const getSavedContact = (): BuyerContact | null => {
  try {
    const raw = storage.get(CONTACT_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<BuyerContact>;
    return {
      full_name: saved.full_name ?? "",
      company_name: saved.company_name ?? "",
      phone: saved.phone ?? "",
      email: saved.email ?? "",
    };
  } catch {
    return null;
  }
};

/** True once the buyer has saved or skipped the "save your shortlist" prompt. */
export const wasSavePromptAnswered = () => !!storage.get(PROMPT_KEY) || !!getShortlistToken();
export const skipSavePrompt = () => storage.set(PROMPT_KEY, "skipped");

// ── server calls ──

export type SaveShortlistResult =
  | { status: "ok"; emailed: boolean }
  | { status: "validation"; field: string }
  | { status: "rate_limited" | "error" };

export const saveShortlist = async (contact: BuyerContact, consent: boolean): Promise<SaveShortlistResult> => {
  const clean: BuyerContact = {
    full_name: contact.full_name.trim(),
    company_name: contact.company_name.trim(),
    phone: contact.phone.trim(),
    email: contact.email.trim(),
  };
  const { data, error } = await db.rpc("save_buyer_shortlist", {
    p_payload: {
      ...clean,
      session_id: getBuyerSessionId(),
      tracking_code: getTrackingCode(),
      consent_to_contact: consent,
      items: toSavedItems(shortlistStore.get()),
    },
  });
  if (error || !data) return { status: "error" };
  if (data.ok) {
    storage.set(TOKEN_KEY, data.token);
    storage.set(CONTACT_KEY, JSON.stringify(clean));
    storage.set(PROMPT_KEY, "saved");
    notify();
    return { status: "ok", emailed: data.emailed === true };
  }
  if (data.error === "validation") return { status: "validation", field: data.field };
  return { status: data.error === "rate_limited" ? "rate_limited" : "error" };
};

let syncTimer: ReturnType<typeof setTimeout> | undefined;
let syncStarted = false;

const syncNow = async () => {
  const token = getShortlistToken();
  if (!token) return;
  const { data, error } = await db.rpc("sync_buyer_shortlist", {
    p_token: token,
    p_items: toSavedItems(shortlistStore.get()),
  });
  if (error) console.warn("Shortlist not synced", error);
  else if (data && !data.ok && data.error === "not_found") forgetSavedShortlist();
};

/** Keeps the server copy up to date whenever the local shortlist changes. Safe to call repeatedly. */
export const startShortlistSync = () => {
  if (syncStarted) return;
  syncStarted = true;
  shortlistStore.subscribe(() => {
    if (!getShortlistToken()) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncNow, SYNC_DELAY_MS);
  });
};

/** After a quotation request is sent the list starts fresh; the saved contact is kept for prefilling. */
export const forgetSavedShortlist = () => {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
  notify();
};

export type ResumeResult = { status: "ok"; firstName: string; added: number } | { status: "not_found" | "error" };

/** Opens a saved shortlist from a link (e.g. sent to the buyer's WhatsApp) and merges it into this browser. */
export const resumeShortlist = async (token: string): Promise<ResumeResult> => {
  if (!isToken(token)) return { status: "not_found" };
  const { data, error } = await db.rpc("get_buyer_shortlist", { p_token: token });
  if (error || !data) return { status: "error" };
  if (!data.ok || data.submitted) return { status: "not_found" };

  const saved = (data.items ?? []) as SavedShortlistItem[];
  const products = await getPublicProducts(saved.map((item) => item.product_id));
  const before = shortlistStore.get().length;
  shortlistStore.merge(saved, products);
  storage.set(TOKEN_KEY, token);
  storage.set(PROMPT_KEY, "saved");
  notify();
  await syncNow();
  return { status: "ok", firstName: data.first_name ?? "", added: shortlistStore.get().length - before };
};

export const shortlistResumeUrl = (token: string) => `${window.location.origin}/shortlist?resume=${token}`;

/** WhatsApp "send to myself" link with the resume URL. */
export const whatsappSelfLink = (phone: string, token: string) =>
  `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(
    `My ${BRAND_NAME} shortlist: ${shortlistResumeUrl(token)}`
  )}`;
