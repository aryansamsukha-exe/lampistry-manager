import React, { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle, ArrowLeft, CheckCircle2, CloudUpload, ImageIcon, ListChecks, Loader, MessageCircle, Minus, Plus,
  QrCode, Send, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BRAND_NAME } from "@/lib/productDisplay";
import { PRODUCT_CATEGORIES } from "@/lib/productCategories";
import { MAX_QUANTITY, shortlistStore, useShortlist, type ShortlistItem } from "@/lib/shortlist";
import {
  BUYER_TYPES, emptyEnquiryForm, validateEnquiryForm, type ContactFields, type EnquiryForm, type EnquiryFormErrors,
} from "@/lib/enquiryValidation";
import { newSubmissionId } from "@/lib/buyerSession";
import { getPublicProducts } from "@/services/publicProductService";
import { submitShortlistEnquiry } from "@/services/buyerEnquiryService";
import {
  forgetSavedShortlist, getSavedContact, resumeShortlist, startShortlistSync, useShortlistToken, whatsappSelfLink,
} from "@/services/savedShortlistService";
import SaveShortlistDialog from "@/components/SaveShortlistDialog";

const DRAFT_KEY = "pm.enquiryDraft";

const loadDraft = (): EnquiryForm => {
  const base = withContact(emptyEnquiryForm(), getSavedContact());
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    const draft = raw ? (JSON.parse(raw) as Partial<EnquiryForm>) : {};
    return { ...withContact({ ...base, ...draft }, getSavedContact()), consent_to_contact: false };
  } catch {
    return base;
  }
};

/** Fills empty name/company/phone/email fields from the contact saved with the shortlist. */
const withContact = (form: EnquiryForm, contact: ContactFields | null): EnquiryForm =>
  contact
    ? {
        ...form,
        full_name: form.full_name || contact.full_name,
        company_name: form.company_name || contact.company_name,
        phone: form.phone || contact.phone,
        email: form.email || contact.email,
      }
    : form;

const SERVER_FIELD_MESSAGES: Record<string, string> = {
  items: "Please check the quantities and notes in your shortlist.",
};

type Step = "review" | "details" | "done";

const ItemRow: React.FC<{ item: ShortlistItem; unavailable: boolean }> = ({ item, unavailable }) => {
  const [showDetails, setShowDetails] = useState(!!(item.finish || item.customization || item.notes));
  const setQuantity = (quantity: number) => shortlistStore.update(item.productId, { quantity });

  return (
    <div className={`rounded-2xl border bg-white p-4 shadow-sm ${unavailable ? "border-red-200" : "border-stone-200"}`}>
      <div className="flex gap-4">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-stone-100 bg-white">
          {item.imageUrl ? (
            <img src={item.imageUrl} alt={item.productCode} className="h-full w-full object-contain" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-stone-300"><ImageIcon className="h-8 w-8" /></div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link to={`/public/product/${item.productId}`} className="text-xs font-semibold uppercase tracking-widest text-stone-400 hover:underline">
                {item.productCode}
              </Link>
              <p className="line-clamp-2 text-sm font-medium text-stone-800">{item.description || "Product"}</p>
              {item.itemSize && <p className="text-xs text-stone-500">{item.itemSize}</p>}
            </div>
            <button
              type="button"
              aria-label={`Remove ${item.productCode}`}
              onClick={() => shortlistStore.remove(item.productId)}
              className="rounded-lg p-2 text-stone-400 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          {unavailable && (
            <p className="mt-1 flex items-center gap-1 text-xs font-medium text-red-600">
              <AlertTriangle className="h-3.5 w-3.5" /> No longer available. Please remove it.
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-lg border border-stone-300">
              <button type="button" aria-label="Decrease quantity" className="p-2 text-stone-600 disabled:opacity-40"
                disabled={item.quantity <= 1} onClick={() => setQuantity(item.quantity - 1)}>
                <Minus className="h-4 w-4" />
              </button>
              <input
                aria-label="Quantity"
                inputMode="numeric"
                className="w-16 border-x border-stone-300 py-1.5 text-center text-sm outline-none"
                value={item.quantity}
                onChange={(e) => setQuantity(Number(e.target.value.replace(/\D/g, "")) || 1)}
              />
              <button type="button" aria-label="Increase quantity" className="p-2 text-stone-600 disabled:opacity-40"
                disabled={item.quantity >= MAX_QUANTITY} onClick={() => setQuantity(item.quantity + 1)}>
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <span className="text-xs text-stone-500">pcs</span>
            <button type="button" className="text-xs font-medium text-amber-700 hover:underline" onClick={() => setShowDetails((v) => !v)}>
              {showDetails ? "Hide details" : "Add finish / customisation / remarks"}
            </button>
          </div>
        </div>
      </div>
      {showDetails && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Requested finish</Label>
            <Input maxLength={300} value={item.finish} placeholder="e.g. antique brass"
              onChange={(e) => shortlistStore.update(item.productId, { finish: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Customisation</Label>
            <Input maxLength={1000} value={item.customization} placeholder="e.g. size, colour, branding"
              onChange={(e) => shortlistStore.update(item.productId, { customization: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Remarks</Label>
            <Textarea rows={2} maxLength={1000} value={item.notes}
              onChange={(e) => shortlistStore.update(item.productId, { notes: e.target.value })} />
          </div>
        </div>
      )}
    </div>
  );
};

const FieldError: React.FC<{ message?: string }> = ({ message }) =>
  message ? <p className="mt-1 text-xs text-red-600">{message}</p> : null;

const Shortlist: React.FC = () => {
  const items = useShortlist();
  const [step, setStep] = useState<Step>("review");
  const [unavailable, setUnavailable] = useState<Set<string>>(new Set());
  const [checking, setChecking] = useState(true);
  const [form, setForm] = useState<EnquiryForm>(loadDraft);
  const [errors, setErrors] = useState<EnquiryFormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const [submittedItems, setSubmittedItems] = useState<ShortlistItem[]>([]);
  const [confirmationEmailed, setConfirmationEmailed] = useState(false);
  const submissionId = useRef<string | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const shortlistToken = useShortlistToken();
  const [showSave, setShowSave] = useState(false);
  const savedContact = getSavedContact();

  useEffect(() => {
    if (shortlistToken) setForm((current) => withContact(current, getSavedContact()));
  }, [shortlistToken]);

  // On open: reopen a saved shortlist from a link, then check every product is still available.
  useEffect(() => {
    startShortlistSync();
    const resumeToken = searchParams.get("resume");
    const init = async () => {
      if (resumeToken) {
        setSearchParams({}, { replace: true });
        const resumed = await resumeShortlist(resumeToken);
        if (resumed.status === "ok") toast.success(`Welcome back${resumed.firstName ? `, ${resumed.firstName}` : ""}! Your shortlist is restored.`);
        else if (resumed.status === "not_found") toast.error("This shortlist link has expired or was already sent as a request.");
        else toast.error("Couldn't open the saved shortlist. Please check your connection.");
      }
      const ids = shortlistStore.get().map((item) => item.productId);
      if (ids.length === 0) return;
      const products = await getPublicProducts(ids);
      const available = new Set(products.map((p) => p.id));
      setUnavailable(new Set(ids.filter((id) => !available.has(id))));
      shortlistStore.refresh(products);
    };
    init().catch(() => undefined).finally(() => setChecking(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const { consent_to_contact: _consent, ...draft } = form;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // Draft saving is best effort.
    }
  }, [form]);

  // Any change to the shortlist or form makes the next submit a new enquiry.
  useEffect(() => {
    submissionId.current = null;
  }, [items, form]);

  const presentUnavailable = items.filter((item) => unavailable.has(item.productId));
  const totalPieces = items.reduce((sum, item) => sum + item.quantity, 0);

  const set = <K extends keyof EnquiryForm>(key: K, value: EnquiryForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    const paired = (["full_name", "company_name"] as string[]).includes(key)
      ? { full_name: undefined, company_name: undefined }
      : (["phone", "email"] as string[]).includes(key)
        ? { phone: undefined, email: undefined }
        : {};
    setErrors((current) => ({ ...current, ...paired, [key]: undefined }));
  };

  const toggleCategory = (category: string) =>
    set(
      "interested_categories",
      form.interested_categories.includes(category)
        ? form.interested_categories.filter((c) => c !== category)
        : [...form.interested_categories, category]
    );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = validateEnquiryForm(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast.error("Please check the highlighted fields.");
      return;
    }
    if (items.length === 0 || presentUnavailable.length > 0) {
      setStep("review");
      return;
    }

    submissionId.current ??= newSubmissionId();
    setSubmitting(true);
    const result = await submitShortlistEnquiry(submissionId.current, form, items, shortlistToken);
    setSubmitting(false);

    switch (result.status) {
      case "ok":
        setReference(result.reference);
        setConfirmationEmailed(result.emailed);
        setSubmittedItems(items);
        forgetSavedShortlist();
        shortlistStore.clear();
        setStep("done");
        window.scrollTo({ top: 0 });
        break;
      case "validation":
        if (result.field in form) setErrors({ [result.field]: "Please check this field." });
        toast.error(SERVER_FIELD_MESSAGES[result.field] ?? "Please check the highlighted fields.");
        if (result.field === "items") setStep("review");
        break;
      case "unavailable_products":
        setUnavailable(new Set(result.productIds));
        setStep("review");
        toast.error("Some products are no longer available. Please remove them and try again.");
        break;
      case "rate_limited":
        toast.error("Too many requests from this device. Please try again a little later.");
        break;
      default:
        toast.error("We couldn't send your request. Please check your connection and try again.");
    }
  };

  const header = (
    <div className="bg-white border-b border-stone-200">
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-stone-500">{BRAND_NAME}</p>
        <p className="flex items-center gap-1.5 text-sm font-medium text-stone-700">
          <ListChecks className="h-4 w-4" /> Your shortlist
        </p>
      </div>
    </div>
  );

  if (step === "done" && reference) {
    return (
      <div className="min-h-screen bg-stone-50">
        {header}
        <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
          <div className="rounded-2xl border border-emerald-200 bg-white p-6 text-center shadow-sm">
            <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-emerald-600" />
            <h1 className="text-2xl font-serif font-bold text-stone-900">Quotation request received</h1>
            <p className="mt-2 text-stone-600">
              Thank you{form.full_name.trim() ? `, ${form.full_name.trim().split(" ")[0]}` : ""}. Our team will contact you about your request.
            </p>
            <div className="mx-auto mt-5 inline-block rounded-xl bg-stone-100 px-5 py-3">
              <p className="text-xs uppercase tracking-widest text-stone-500">Your reference</p>
              <p className="text-xl font-bold tracking-wide text-stone-900">{reference}</p>
            </div>
            {confirmationEmailed && (
              <p className="mt-4 text-sm text-stone-500">A confirmation with your product list is on its way to your email.</p>
            )}
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <p className="mb-3 text-sm font-semibold text-stone-700">Products requested</p>
            <ul className="divide-y divide-stone-100 text-sm">
              {submittedItems.map((item) => (
                <li key={item.productId} className="flex justify-between gap-3 py-2">
                  <span className="min-w-0 truncate"><b>{item.productCode}</b> {item.description}</span>
                  <span className="shrink-0 text-stone-500">× {item.quantity}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0 && checking) {
    return (
      <div className="min-h-screen bg-stone-50">
        {header}
        <div className="flex justify-center py-16"><Loader className="h-8 w-8 animate-spin text-stone-400" /></div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-stone-50">
        {header}
        <div className="max-w-md mx-auto px-6 py-16 text-center">
          <QrCode className="mx-auto mb-4 h-14 w-14 text-stone-300" />
          <h1 className="text-xl font-bold text-stone-900">Your shortlist is empty</h1>
          <p className="mt-2 text-stone-500">
            Scan the QR code on any product tag and tap <b>Add to shortlist</b>. When you're done, come back here to request a wholesale quotation for everything at once.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 pb-28">
      {header}
      <SaveShortlistDialog open={showSave} onOpenChange={setShowSave} />
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {step === "review" ? (
          <>
            <div>
              <h1 className="text-2xl font-serif font-bold text-stone-900">Review your shortlist</h1>
              <p className="text-sm text-stone-500">
                {items.length} product{items.length === 1 ? "" : "s"} · {totalPieces} pcs. Set quantities, then request a quotation. Keep scanning product tags to add more.
              </p>
            </div>
            {shortlistToken ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Saved — changes are kept automatically.</span>
                {savedContact?.phone && (
                  <a href={whatsappSelfLink(savedContact.phone, shortlistToken)} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 font-semibold underline">
                    <MessageCircle className="h-4 w-4" /> Send link to my WhatsApp
                  </a>
                )}
              </div>
            ) : (
              <button type="button" onClick={() => setShowSave(true)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-left text-sm text-amber-900">
                <span className="flex items-center gap-2"><CloudUpload className="h-4 w-4 shrink-0" /> Don't lose your selection — save it with your name and WhatsApp.</span>
                <span className="shrink-0 font-semibold underline">Save</span>
              </button>
            )}
            {presentUnavailable.length > 0 && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <span>{presentUnavailable.length} product(s) are no longer available.</span>
                <button type="button" className="font-semibold underline"
                  onClick={() => presentUnavailable.forEach((item) => shortlistStore.remove(item.productId))}>
                  Remove them
                </button>
              </div>
            )}
            {items.map((item) => (
              <ItemRow key={item.productId} item={item} unavailable={unavailable.has(item.productId)} />
            ))}
          </>
        ) : (
          <form id="enquiry-form" onSubmit={submit} className="space-y-5" noValidate>
            <button type="button" onClick={() => setStep("review")} className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800">
              <ArrowLeft className="h-4 w-4" /> Back to shortlist ({items.length})
            </button>
            <div>
              <h1 className="text-2xl font-serif font-bold text-stone-900">Request wholesale quotation</h1>
              <p className="text-sm text-stone-500">
                Tell us how to reach you. Your name or company, and a phone/WhatsApp number or email, are enough. Fields marked * are required.
              </p>
            </div>
            <div className="grid gap-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:grid-cols-2">
              <div>
                <Label htmlFor="full_name">Full name</Label>
                <Input id="full_name" autoComplete="name" maxLength={120} value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
              </div>
              <div>
                <Label htmlFor="company_name">Company</Label>
                <Input id="company_name" autoComplete="organization" maxLength={160} value={form.company_name} onChange={(e) => set("company_name", e.target.value)} />
              </div>
              <div className="sm:col-span-2 -mt-3">
                <FieldError message={errors.full_name ?? errors.company_name} />
              </div>
              <div>
                <Label htmlFor="phone">Phone / WhatsApp (with country code)</Label>
                <Input id="phone" type="tel" autoComplete="tel" placeholder="+91 98765 43210" maxLength={32} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" maxLength={254} value={form.email} onChange={(e) => set("email", e.target.value)} />
              </div>
              <div className="sm:col-span-2 -mt-3">
                <FieldError message={errors.phone ?? errors.email} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="whatsapp">WhatsApp (if different from phone)</Label>
                <Input id="whatsapp" type="tel" maxLength={32} value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} />
                <FieldError message={errors.whatsapp} />
              </div>
              <div className="sm:col-span-2">
                <Label>Business type *</Label>
                <Select value={form.buyer_type} onValueChange={(value) => set("buyer_type", value as EnquiryForm["buyer_type"])}>
                  <SelectTrigger><SelectValue placeholder="Choose one" /></SelectTrigger>
                  <SelectContent>
                    {BUYER_TYPES.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FieldError message={errors.buyer_type} />
              </div>
              <div>
                <Label htmlFor="city">City *</Label>
                <Input id="city" autoComplete="address-level2" maxLength={120} value={form.city} onChange={(e) => set("city", e.target.value)} />
                <FieldError message={errors.city} />
              </div>
              <div>
                <Label htmlFor="country">Country *</Label>
                <Input id="country" autoComplete="country-name" maxLength={120} value={form.country} onChange={(e) => set("country", e.target.value)} />
                <FieldError message={errors.country} />
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <div>
                <Label>Interested in</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {PRODUCT_CATEGORIES.map((category) => {
                    const active = form.interested_categories.includes(category);
                    return (
                      <button key={category} type="button" onClick={() => toggleCategory(category)}
                        className={`rounded-full border px-3 py-1 text-sm ${active ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 text-stone-600 hover:bg-stone-100"}`}>
                        {category}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <Label htmlFor="order_scale">Expected order size</Label>
                <Input id="order_scale" maxLength={300} placeholder="e.g. 1 container per quarter, 200 pcs per design"
                  value={form.order_scale} onChange={(e) => set("order_scale", e.target.value)} />
                <FieldError message={errors.order_scale} />
              </div>
              <div>
                <Label htmlFor="requirements">Requirements or message</Label>
                <Textarea id="requirements" rows={3} maxLength={2000} value={form.requirements} onChange={(e) => set("requirements", e.target.value)} />
                <FieldError message={errors.requirements} />
              </div>
              <label className="flex items-start gap-3 text-sm text-stone-600">
                <Checkbox checked={form.consent_to_contact} onCheckedChange={(checked) => set("consent_to_contact", checked === true)} className="mt-0.5" />
                <span>I agree that {BRAND_NAME} may contact me about this request and future collections by phone, WhatsApp or email.</span>
              </label>
            </div>
          </form>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 backdrop-blur">
        <div className="max-w-2xl mx-auto px-4 py-3">
          {step === "review" ? (
            <button
              type="button"
              disabled={checking || presentUnavailable.length > 0}
              onClick={() => { setStep("details"); window.scrollTo({ top: 0 }); }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-3 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-50"
            >
              {checking ? <Loader className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Request wholesale quotation ({items.length})
            </button>
          ) : (
            <button
              type="submit"
              form="enquiry-form"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-3 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-50"
            >
              {submitting ? <Loader className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {submitting ? "Sending…" : "Send quotation request"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Shortlist;
