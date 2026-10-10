import { supabase } from "@/integrations/supabase/client";
import { getBuyerSessionId, getTrackingCode } from "@/lib/buyerSession";
import type { EnquiryForm } from "@/lib/enquiryValidation";
import type { ShortlistItem } from "@/lib/shortlist";

// The public RPCs are not in the generated types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export type ProductEventSource = "product_qr" | "exhibition_qr" | "catalog" | "shortlist" | "direct";

/** Fire-and-forget analytics; failures never affect the buyer. */
export const trackProductEvent = (
  productId: string,
  eventType: "view" | "shortlist_add",
  source: ProductEventSource = "product_qr"
) => {
  let referrerHost: string | null = null;
  try {
    referrerHost = document.referrer ? new URL(document.referrer).host : null;
  } catch {
    referrerHost = null;
  }
  db.rpc("track_product_event", {
    p_product_id: productId,
    p_session_id: getBuyerSessionId(),
    p_event_type: eventType,
    p_tracking_code: getTrackingCode(),
    p_source: source,
    p_referrer_host: referrerHost,
  }).then(({ error }: { error: unknown }) => {
    if (error) console.warn("Analytics event not recorded", error);
  });
};

export type SubmitEnquiryResult =
  | { status: "ok"; reference: string }
  | { status: "validation"; field: string }
  | { status: "unavailable_products"; productIds: string[] }
  | { status: "rate_limited" | "invalid_request" | "network" };

export const submitShortlistEnquiry = async (
  submissionId: string,
  form: EnquiryForm,
  items: ShortlistItem[],
  shortlistToken: string | null
): Promise<SubmitEnquiryResult> => {
  const payload = {
    submission_id: submissionId,
    session_id: getBuyerSessionId(),
    tracking_code: getTrackingCode(),
    shortlist_token: shortlistToken,
    lead: {
      ...form,
      email: form.email.trim(),
      interested_categories: form.interested_categories,
    },
    items: items.map((item) => ({
      product_id: item.productId,
      quantity: item.quantity,
      finish: item.finish.trim(),
      customization: item.customization.trim(),
      notes: item.notes.trim(),
    })),
  };

  const { data, error } = await db.rpc("submit_shortlist_enquiry", { p_payload: payload });
  if (error || !data) return { status: "network" };
  if (data.ok) return { status: "ok", reference: data.reference };
  if (data.error === "validation") return { status: "validation", field: data.field };
  if (data.error === "unavailable_products") return { status: "unavailable_products", productIds: data.product_ids ?? [] };
  return { status: data.error === "rate_limited" ? "rate_limited" : "invalid_request" };
};
