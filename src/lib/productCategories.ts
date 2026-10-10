export const PRODUCT_CATEGORIES = [
  "Hanging Lamp",
  "Table Lamp",
  "Floor Lamp",
  "Wall Lamp",
  "Other Lighting",
  "Furniture",
  "Décor",
] as const;

// Keep in sync with the category UPDATE in supabase/exhibition-phase2.sql.
const RULES: [RegExp, string][] = [
  [/HANGING|PENDANT|CHANDELIER|CEILING/, "Hanging Lamp"],
  [/FLOOR/, "Floor Lamp"],
  [/WALL/, "Wall Lamp"],
  [/TABLE LAMP|DESK LAMP|BEDSIDE/, "Table Lamp"],
  [/LAMP|LIGHT|LANTERN|SCONCE/, "Other Lighting"],
  [/CHAIR|STOOL|BENCH|TABLE|SHELF|CABINET|CONSOLE|SOFA|DESK|RACK|TROLLEY|SIDEBOARD/, "Furniture"],
];

/** Best-guess category from a product description; staff can change it afterwards. */
export const categorizeProduct = (description?: string | null): string => {
  const text = (description ?? "").toUpperCase();
  return RULES.find(([pattern]) => pattern.test(text))?.[1] ?? "Décor";
};
