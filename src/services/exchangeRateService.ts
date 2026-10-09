const RATE_URL = "https://open.er-api.com/v6/latest/USD";
const CACHE_KEY = "usdToInrRate";
const CACHE_MS = 12 * 60 * 60 * 1000;
/** Used only when the live rate cannot be fetched and nothing is cached. */
const FALLBACK_USD_TO_INR = 96;

type CachedRate = { rate: number; fetchedAt: number };

const readCache = (): CachedRate | null => {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null") as CachedRate | null;
    return cached && cached.rate > 0 ? cached : null;
  } catch {
    return null;
  }
};

/** USD → INR rate, refreshed at most every 12 hours. */
export const getUsdToInrRate = async (): Promise<number> => {
  const cached = readCache();
  if (cached && Date.now() - cached.fetchedAt < CACHE_MS) return cached.rate;

  try {
    const response = await fetch(RATE_URL);
    const data = await response.json();
    const rate = Number(data?.rates?.INR);
    if (!response.ok || !(rate > 0)) throw new Error("No INR rate in response");
    localStorage.setItem(CACHE_KEY, JSON.stringify({ rate, fetchedAt: Date.now() }));
    return rate;
  } catch (error) {
    console.error("Could not fetch USD to INR rate:", error);
    return cached?.rate ?? FALLBACK_USD_TO_INR;
  }
};

export const formatInr = (amount: number) =>
  `₹${Math.round(amount).toLocaleString("en-IN")}`;
