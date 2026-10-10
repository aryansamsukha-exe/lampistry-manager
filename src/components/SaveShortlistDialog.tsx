import React, { useState } from "react";
import { CheckCircle2, Copy, Loader, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { BRAND_NAME } from "@/lib/productDisplay";
import { contactErrors, type ContactFields, type EnquiryFormErrors } from "@/lib/enquiryValidation";
import {
  getSavedContact, getShortlistToken, saveShortlist, shortlistResumeUrl, skipSavePrompt, whatsappSelfLink,
} from "@/services/savedShortlistService";

type Props = { open: boolean; onOpenChange: (open: boolean) => void };

const emptyContact: ContactFields = { full_name: "", company_name: "", phone: "", email: "" };

const FieldError: React.FC<{ message?: string }> = ({ message }) =>
  message ? <p className="mt-1 text-xs text-red-600">{message}</p> : null;

const SaveShortlistDialog: React.FC<Props> = ({ open, onOpenChange }) => {
  const [contact, setContact] = useState<ContactFields>(() => getSavedContact() ?? emptyContact);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<EnquiryFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  const set = (key: keyof ContactFields) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setContact((current) => ({ ...current, [key]: e.target.value }));
    setErrors({});
  };

  const close = (skipped: boolean) => {
    if (skipped && !token) skipSavePrompt();
    onOpenChange(false);
  };

  const copyLink = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(shortlistResumeUrl(token));
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy the link");
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = contactErrors(contact);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    const result = await saveShortlist(contact, consent);
    setSaving(false);
    if (result.status === "ok") {
      setToken(getShortlistToken());
      return;
    }
    if (result.status === "validation") {
      setErrors({ [result.field]: "Please check this field." });
    } else if (result.status === "rate_limited") {
      toast.error("Too many attempts from this device. Please try again later.");
    } else {
      toast.error("Couldn't save right now. Your shortlist is still kept on this phone.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close(true))}>
      <DialogContent className="max-w-sm rounded-2xl">
        {token ? (
          <div className="space-y-4 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
            <DialogHeader>
              <DialogTitle className="text-center">Shortlist saved</DialogTitle>
              <DialogDescription className="text-center">
                Keep scanning product tags — everything you add is saved automatically. Keep the link to open your list on any phone.
              </DialogDescription>
            </DialogHeader>
            {contact.phone.trim() && (
              <a
                href={whatsappSelfLink(contact.phone, token)}
                target="_blank"
                rel="noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                <MessageCircle className="h-4 w-4" /> Send link to my WhatsApp
              </a>
            )}
            <button type="button" onClick={copyLink}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-stone-300 px-4 py-3 text-sm font-medium text-stone-700 hover:bg-stone-100">
              <Copy className="h-4 w-4" /> Copy link
            </button>
            <button type="button" onClick={() => close(false)} className="w-full py-2 text-sm text-stone-500 hover:text-stone-800">
              Continue browsing
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3" noValidate>
            <DialogHeader>
              <DialogTitle>Save your shortlist</DialogTitle>
              <DialogDescription>
                So you don't lose your selection while scanning other products, and our team can follow up on it with you.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="save-name">Your name</Label>
                <Input id="save-name" autoComplete="name" maxLength={120} value={contact.full_name} onChange={set("full_name")} />
              </div>
              <div>
                <Label htmlFor="save-company">Company</Label>
                <Input id="save-company" autoComplete="organization" maxLength={160} value={contact.company_name} onChange={set("company_name")} />
              </div>
            </div>
            <FieldError message={errors.full_name ?? errors.company_name} />
            <div>
              <Label htmlFor="save-phone">WhatsApp number (with country code)</Label>
              <Input id="save-phone" type="tel" autoComplete="tel" placeholder="+91 98765 43210" maxLength={32}
                value={contact.phone} onChange={set("phone")} />
            </div>
            <div>
              <Label htmlFor="save-email">Email</Label>
              <Input id="save-email" type="email" autoComplete="email" maxLength={254} value={contact.email} onChange={set("email")} />
            </div>
            <FieldError message={errors.phone ?? errors.email} />
            <p className="text-xs text-stone-500">Name or company, plus WhatsApp or email, is enough.</p>
            <label className="flex items-start gap-3 text-xs text-stone-600">
              <Checkbox checked={consent} onCheckedChange={(checked) => setConsent(checked === true)} className="mt-0.5" />
              <span>{BRAND_NAME} may contact me about these products by phone, WhatsApp or email.</span>
            </label>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => close(true)}
                className="flex-1 rounded-xl border border-stone-300 px-4 py-3 text-sm font-medium text-stone-600 hover:bg-stone-100">
                Skip
              </button>
              <button type="submit" disabled={saving}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-3 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-50">
                {saving && <Loader className="h-4 w-4 animate-spin" />} Save
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SaveShortlistDialog;
