import { describe, expect, it } from "vitest";
import { emptyEnquiryForm, validateEnquiryForm, type EnquiryForm } from "./enquiryValidation";
import { categorizeProduct } from "./productCategories";

const validForm = (): EnquiryForm => ({
  ...emptyEnquiryForm(),
  full_name: "Asha Mehta",
  company_name: "Mehta Interiors",
  phone: "+91 98765 43210",
  buyer_type: "retailer",
  city: "Mumbai",
  country: "India",
});

describe("validateEnquiryForm", () => {
  it("accepts a complete form", () => {
    expect(validateEnquiryForm(validForm())).toEqual({});
  });

  it("requires the short list of mandatory fields", () => {
    const errors = validateEnquiryForm(emptyEnquiryForm());
    expect(Object.keys(errors).sort()).toEqual(
      ["buyer_type", "city", "company_name", "country", "full_name", "phone"].sort()
    );
  });

  it("checks phone, WhatsApp and email formats", () => {
    const errors = validateEnquiryForm({ ...validForm(), phone: "12345", whatsapp: "abc", email: "not-an-email" });
    expect(errors.phone).toBeDefined();
    expect(errors.whatsapp).toBeDefined();
    expect(errors.email).toBeDefined();
  });

  it("allows an empty optional email and WhatsApp", () => {
    expect(validateEnquiryForm({ ...validForm(), email: " ", whatsapp: "" })).toEqual({});
  });
});

describe("categorizeProduct", () => {
  it.each([
    ["MARBLE HANGING LAMP", "Hanging Lamp"],
    ["IRON TABLE LAMP WITH SHADE", "Table Lamp"],
    ["BRASS FLOOR LAMP", "Floor Lamp"],
    ["WALL SCONCE", "Wall Lamp"],
    ["GLASS LANTERN", "Other Lighting"],
    ["WOODEN SIDE TABLE", "Furniture"],
    ["CERAMIC VASE", "Décor"],
    ["", "Décor"],
  ])("%s → %s", (description, category) => {
    expect(categorizeProduct(description)).toBe(category);
  });
});
