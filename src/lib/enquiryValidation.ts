export const BUYER_TYPES = [
  { value: "retailer", label: "Retailer" },
  { value: "wholesaler", label: "Wholesaler" },
  { value: "distributor", label: "Distributor" },
  { value: "interior_designer", label: "Interior designer" },
  { value: "architect", label: "Architect" },
  { value: "hospitality", label: "Hospitality (hotel / restaurant)" },
  { value: "importer", label: "Importer" },
  { value: "project_buyer", label: "Project buyer" },
  { value: "other", label: "Other" },
] as const;

export type BuyerType = (typeof BUYER_TYPES)[number]["value"];

export type EnquiryForm = {
  full_name: string;
  company_name: string;
  email: string;
  phone: string;
  whatsapp: string;
  buyer_type: BuyerType | "";
  city: string;
  country: string;
  interested_categories: string[];
  order_scale: string;
  requirements: string;
  consent_to_contact: boolean;
};

export type EnquiryFormErrors = Partial<Record<keyof EnquiryForm, string>>;

export const emptyEnquiryForm = (): EnquiryForm => ({
  full_name: "",
  company_name: "",
  email: "",
  phone: "",
  whatsapp: "",
  buyer_type: "",
  city: "",
  country: "",
  interested_categories: [],
  order_scale: "",
  requirements: "",
  consent_to_contact: false,
});

export const phoneDigits = (value: string) => value.replace(/\D/g, "");

const isPhone = (value: string) => {
  const digits = phoneDigits(value).length;
  return digits >= 7 && digits <= 15 && value.trim().length <= 32;
};

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export type ContactFields = Pick<EnquiryForm, "full_name" | "company_name" | "phone" | "email">;

/** A buyer needs a name or a company, and a phone/WhatsApp number or an email. Mirrors _contact_error() in SQL. */
export const contactErrors = (contact: ContactFields): EnquiryFormErrors => {
  const errors: EnquiryFormErrors = {};
  const name = contact.full_name.trim();
  const company = contact.company_name.trim();
  const phone = contact.phone.trim();
  const email = contact.email.trim();

  if (name && (name.length < 2 || name.length > 120)) errors.full_name = "Please enter your full name.";
  if (company.length > 160) errors.company_name = "Company name is too long.";
  if (!name && !company) errors.full_name = "Please enter your name or your company name.";
  if (phone && !isPhone(phone)) errors.phone = "Please enter a valid number with country code.";
  if (email && (email.length > 254 || !EMAIL_PATTERN.test(email))) errors.email = "Please enter a valid email address.";
  if (!phone && !email) errors.phone = "Please enter a WhatsApp/phone number or an email.";
  return errors;
};

// Mirrors the checks in submit_shortlist_enquiry (supabase/exhibition-phase2.sql).
export const validateEnquiryForm = (form: EnquiryForm): EnquiryFormErrors => {
  const errors = contactErrors(form);

  if (form.whatsapp.trim() && !isPhone(form.whatsapp)) errors.whatsapp = "Please enter a valid WhatsApp number.";
  if (!form.buyer_type) errors.buyer_type = "Please choose what best describes your business.";
  if (!form.city.trim()) errors.city = "Please enter your city.";
  if (!form.country.trim()) errors.country = "Please enter your country.";
  if (form.order_scale.length > 300) errors.order_scale = "Please keep this under 300 characters.";
  if (form.requirements.length > 2000) errors.requirements = "Please keep this under 2000 characters.";
  return errors;
};
