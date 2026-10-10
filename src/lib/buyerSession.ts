const SESSION_KEY = "pm.buyerSession";
const TRACKING_KEY = "pm.exhibitionTracking";
const TRACKING_TTL_MS = 3 * 24 * 60 * 60 * 1000;

const randomId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      });

export const newSubmissionId = randomId;

/** Anonymous per-browser ID used for analytics and rate limiting. Contains no personal data. */
export const getBuyerSessionId = (): string => {
  try {
    const existing = localStorage.getItem(SESSION_KEY);
    if (existing && /^[0-9a-f-]{36}$/.test(existing)) return existing;
    const id = randomId();
    localStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return randomId();
  }
};

export const isValidTrackingCode = (code: string | null | undefined): code is string =>
  !!code && /^[a-z0-9-]{3,40}$/.test(code);

/** Remembers the exhibition a visitor arrived from (e.g. a stand QR) for a few days. */
export const rememberTrackingCode = (code: string | null | undefined) => {
  const normalized = code?.trim().toLowerCase();
  if (!isValidTrackingCode(normalized)) return;
  try {
    localStorage.setItem(TRACKING_KEY, JSON.stringify({ code: normalized, at: Date.now() }));
  } catch {
    // Storage unavailable (private mode); tracking falls back to the live exhibition.
  }
};

export const getTrackingCode = (): string | null => {
  try {
    const raw = localStorage.getItem(TRACKING_KEY);
    if (!raw) return null;
    const { code, at } = JSON.parse(raw) as { code: string; at: number };
    if (Date.now() - at > TRACKING_TTL_MS || !isValidTrackingCode(code)) {
      localStorage.removeItem(TRACKING_KEY);
      return null;
    }
    return code;
  } catch {
    return null;
  }
};
