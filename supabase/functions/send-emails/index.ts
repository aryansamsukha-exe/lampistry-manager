// Sends queued rows from public.email_outbox through Resend.
// Triggered by a Database Webhook on INSERT into email_outbox (and optionally on a schedule for retries).
// It ignores the request body and only sends what is already queued, so extra calls are harmless.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   RESEND_API_KEY   Resend API key
//   EMAIL_FROM       e.g. "Anjani Art <sales@anjaniart.com>" (domain verified in Resend)
//   EMAIL_REPLY_TO   optional, where buyer replies should go
//   PUBLIC_APP_URL   e.g. https://productmanagement.vercel.app
import { createClient } from "jsr:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "";
const EMAIL_REPLY_TO = Deno.env.get("EMAIL_REPLY_TO") || undefined;
const PUBLIC_APP_URL = (Deno.env.get("PUBLIC_APP_URL") ?? "https://productmanagement.vercel.app").replace(/\/+$/, "");
const BRAND = "ANJANI ART";
const MAX_ATTEMPTS = 5;

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

type OutboxRow = {
  id: string;
  kind: string;
  to_email: string;
  payload: Record<string, unknown>;
  attempts: number;
};

type Email = { subject: string; html: string; text: string };

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const layout = (heading: string, body: string) => `<!doctype html>
<html><body style="margin:0;background:#f5f5f4;font-family:Arial,Helvetica,sans-serif;color:#1c1917">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden">
        <tr><td style="padding:20px 28px;border-bottom:2px solid #b8862b;text-align:center;letter-spacing:4px;font-weight:bold;color:#b8862b">${BRAND}</td></tr>
        <tr><td style="padding:28px">
          <h1 style="margin:0 0 16px;font-size:22px">${escapeHtml(heading)}</h1>
          ${body}
        </td></tr>
        <tr><td style="padding:16px 28px;background:#fafaf9;color:#78716c;font-size:12px;text-align:center">
          You received this email because this address was entered on ${BRAND}'s product page.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

const button = (href: string, label: string) =>
  `<a href="${escapeHtml(href)}" style="display:inline-block;background:#1c1917;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:bold">${escapeHtml(label)}</a>`;

type ShortlistPayload = {
  token?: string;
  name?: string | null;
  item_count?: number;
  items?: { code: string; description?: string | null; quantity?: number }[];
};

const renderShortlistLink = (payload: ShortlistPayload): Email => {
  if (!payload.token || !/^[0-9a-f]{64}$/.test(payload.token)) throw new Error("Missing shortlist token");
  const url = `${PUBLIC_APP_URL}/shortlist?resume=${payload.token}`;
  const items = payload.items ?? [];
  const count = payload.item_count ?? items.length;
  const greeting = payload.name ? `Hello ${payload.name},` : "Hello,";
  const rows = items
    .map((item) => `<tr>
      <td style="padding:6px 0;border-bottom:1px solid #f5f5f4;font-weight:bold;white-space:nowrap">${escapeHtml(item.code)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f5f5f4;color:#57534e">${escapeHtml(item.description)}</td>
      <td style="padding:6px 0;border-bottom:1px solid #f5f5f4;text-align:right;white-space:nowrap">× ${escapeHtml(item.quantity ?? 1)}</td>
    </tr>`)
    .join("");
  const more = count > items.length ? `<p style="color:#78716c;font-size:13px">…and ${count - items.length} more.</p>` : "";

  const html = layout("Your shortlist is saved", `
    <p style="margin:0 0 12px">${escapeHtml(greeting)}</p>
    <p style="margin:0 0 20px;line-height:1.5">You saved ${count} product${count === 1 ? "" : "s"} to your shortlist. Use the button below to open it on any phone or computer, add more products, and request a wholesale quotation when you're ready.</p>
    <p style="margin:0 0 24px">${button(url, "Open my shortlist")}</p>
    ${rows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">${rows}</table>${more}` : ""}
    <p style="margin:24px 0 0;color:#78716c;font-size:12px;line-height:1.5">Keep this link private — anyone with it can see and change your shortlist.</p>
  `);

  const text = [
    greeting,
    "",
    `You saved ${count} product${count === 1 ? "" : "s"} to your ${BRAND} shortlist.`,
    `Open it here: ${url}`,
    "",
    ...items.map((item) => `- ${item.code} ${item.description ?? ""} x ${item.quantity ?? 1}`),
    "",
    "Keep this link private — anyone with it can see and change your shortlist.",
  ].join("\n");

  return { subject: `Your ${BRAND} shortlist`, html, text };
};

type EnquiryPayload = {
  reference?: string;
  name?: string | null;
  items?: {
    code: string;
    description?: string | null;
    quantity?: number;
    finish?: string | null;
    customization?: string | null;
    notes?: string | null;
  }[];
};

const renderEnquiryConfirmation = (payload: EnquiryPayload): Email => {
  if (!payload.reference) throw new Error("Missing enquiry reference");
  const items = payload.items ?? [];
  const greeting = payload.name ? `Hello ${payload.name},` : "Hello,";
  const extras = (item: NonNullable<EnquiryPayload["items"]>[number]) =>
    [
      item.finish && `Finish: ${item.finish}`,
      item.customization && `Customisation: ${item.customization}`,
      item.notes && `Remarks: ${item.notes}`,
    ].filter(Boolean) as string[];

  const rows = items
    .map((item) => `<tr>
      <td style="padding:8px 0;border-bottom:1px solid #f5f5f4;vertical-align:top">
        <b>${escapeHtml(item.code)}</b> <span style="color:#57534e">${escapeHtml(item.description)}</span>
        ${extras(item).map((line) => `<div style="color:#78716c;font-size:12px">${escapeHtml(line)}</div>`).join("")}
      </td>
      <td style="padding:8px 0;border-bottom:1px solid #f5f5f4;text-align:right;vertical-align:top;white-space:nowrap">× ${escapeHtml(item.quantity ?? 1)} pcs</td>
    </tr>`)
    .join("");

  const html = layout("We've received your quotation request", `
    <p style="margin:0 0 12px">${escapeHtml(greeting)}</p>
    <p style="margin:0 0 20px;line-height:1.5">Thank you for your interest in ${BRAND}. Our team will review your selection and contact you with a wholesale quotation.</p>
    <p style="margin:0 0 20px;padding:12px 16px;background:#f5f5f4;border-radius:10px">
      Your reference: <b style="font-size:18px;letter-spacing:1px">${escapeHtml(payload.reference)}</b>
    </p>
    <p style="margin:0 0 8px;font-weight:bold">Products requested (${items.length})</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">${rows}</table>
    <p style="margin:24px 0 0;color:#78716c;font-size:13px;line-height:1.5">Please quote your reference when you contact us. You can reply to this email with any questions.</p>
  `);

  const text = [
    greeting,
    "",
    `Thank you for your interest in ${BRAND}. Our team will review your selection and contact you with a wholesale quotation.`,
    `Your reference: ${payload.reference}`,
    "",
    "Products requested:",
    ...items.map((item) =>
      [`- ${item.code} ${item.description ?? ""} x ${item.quantity ?? 1} pcs`, ...extras(item).map((line) => `    ${line}`)].join("\n")
    ),
  ].join("\n");

  return { subject: `Quotation request received — ${payload.reference}`, html, text };
};

const render = (row: OutboxRow): Email => {
  switch (row.kind) {
    case "shortlist_link":
      return renderShortlistLink(row.payload as ShortlistPayload);
    case "enquiry_confirmation":
      return renderEnquiryConfirmation(row.payload as EnquiryPayload);
    default:
      throw new Error(`No template for email kind "${row.kind}"`);
  }
};

const sendViaResend = async (row: OutboxRow, email: Email) => {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": row.id,
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [row.to_email],
      reply_to: EMAIL_REPLY_TO,
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
  });
  if (!response.ok) throw new Error(`Resend ${response.status}: ${(await response.text()).slice(0, 300)}`);
};

Deno.serve(async () => {
  if (!RESEND_API_KEY || !EMAIL_FROM) {
    return Response.json({ error: "RESEND_API_KEY and EMAIL_FROM secrets are required" }, { status: 500 });
  }

  const { data, error } = await db.rpc("claim_email_outbox", { p_limit: 20 });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  let sent = 0;
  let failed = 0;
  for (const row of (data ?? []) as OutboxRow[]) {
    try {
      await sendViaResend(row, render(row));
      await db.from("email_outbox")
        .update({ status: "sent", sent_at: new Date().toISOString(), last_error: null, locked_at: null })
        .eq("id", row.id);
      sent++;
    } catch (err) {
      const giveUp = row.attempts >= MAX_ATTEMPTS;
      await db.from("email_outbox")
        .update({
          status: giveUp ? "failed" : "pending",
          last_error: String(err).slice(0, 500),
          locked_at: null,
          next_attempt_at: new Date(Date.now() + 2 ** row.attempts * 60_000).toISOString(),
        })
        .eq("id", row.id);
      failed++;
    }
  }

  return Response.json({ sent, failed });
});
