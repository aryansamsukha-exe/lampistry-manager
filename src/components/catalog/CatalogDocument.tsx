import React from "react";
import type { Product } from "@/components/ProductCard";
import brandLogo from "@/assets/anjani-art-logo.png";
import { BRAND_NAME, formatItemSize, formatNetWeight, formatPackingSize } from "@/lib/productDisplay";
import { formatCbm } from "@/services/catalogService";

export type CatalogLayout = "1" | "2" | "4" | "6";

export const CATALOG_LAYOUTS: { value: CatalogLayout; label: string }[] = [
  { value: "1", label: "1 per page" },
  { value: "2", label: "2 per page" },
  { value: "4", label: "4 per page" },
  { value: "6", label: "6 per page" },
];

export type CatalogDocumentOptions = {
  title: string;
  subtitle: string;
  layout: CatalogLayout;
  showContents: boolean;
  contact: string;
};

const CONTENTS_PER_PAGE = 30;
const SMALL_WORDS = new Set(["a", "an", "and", "as", "at", "by", "for", "in", "of", "on", "or", "the", "to", "with"]);

const chunk = <T,>(items: T[], size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, i * size + size));

/** Descriptions are imported in capitals ("WOODEN FLOOR LAMP"); catalogues read better in title case. */
const titleCase = (text: string) =>
  text
    .toLowerCase()
    .split(/(\s+)/)
    .map((word, i) => (i > 0 && SMALL_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join("");

const productTitle = (p: Product) => (p.description?.trim() ? titleCase(p.description.trim()) : p.product_code);

const cbmText = (p: Product) => {
  const cbm = formatCbm(p);
  return cbm === "—" ? null : `${cbm} m³`;
};

type Spec = [label: string, value: string | null | undefined];

const specsFor = (p: Product, detailed: boolean): Spec[] => {
  const specs: Spec[] = [
    ["Size", formatItemSize(p)],
    ["Finish", p.finish],
  ];
  if (detailed) {
    specs.push(["Packing", formatPackingSize(p)], ["CBM", cbmText(p)], ["Net weight", formatNetWeight(p)]);
  }
  return specs.filter(([, value]) => value);
};

const ProductImage: React.FC<{ product: Product; className?: string }> = ({ product, className = "" }) => (
  <div className={`cat-img ${className}`}>
    {product.imageUrl ? (
      <img src={product.imageUrl} alt={product.product_code} loading="eager" decoding="async" />
    ) : (
      <span className="cat-img-empty">Image coming soon</span>
    )}
  </div>
);

const Eyebrow: React.FC<{ product: Product }> = ({ product }) => (
  <p className="cat-eyebrow">
    <span className="cat-code">{product.product_code}</span>
    {product.category && <span className="cat-category">{product.category}</span>}
  </p>
);

const Specs: React.FC<{ specs: Spec[] }> = ({ specs }) =>
  specs.length ? (
    <dl className="cat-specs">
      {specs.map(([label, value]) => (
        <div key={label} className="cat-spec">
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  ) : null;

const Qr: React.FC<{ src?: string }> = ({ src }) =>
  src ? (
    <div className="cat-qr">
      <img src={src} alt="" />
      <span>Scan for details</span>
    </div>
  ) : null;

const ProductTile: React.FC<{ product: Product; layout: CatalogLayout; qr?: string }> = ({ product, layout, qr }) => {
  const detailed = layout === "1" || layout === "2";
  return (
    <article className={`cat-tile cat-tile-${layout}`}>
      <ProductImage product={product} />
      <div className="cat-info">
        <div className="cat-info-text">
          <Eyebrow product={product} />
          <h3 className="cat-title">{productTitle(product)}</h3>
          <Specs specs={specsFor(product, detailed)} />
        </div>
        <Qr src={qr} />
      </div>
    </article>
  );
};

const Page: React.FC<{ title: string; contact: string; pageNo: number; children: React.ReactNode }> = ({
  title, contact, pageNo, children,
}) => (
  <section className="cat-page">
    <header className="cat-head">
      <img src={brandLogo} alt={BRAND_NAME} />
      <span>{title}</span>
    </header>
    <div className="cat-body">{children}</div>
    <footer className="cat-foot">
      <span>{contact}</span>
      <span>{String(pageNo).padStart(2, "0")}</span>
    </footer>
  </section>
);

const Cover: React.FC<{ products: Product[]; options: CatalogDocumentOptions }> = ({ products, options }) => {
  const featured = products.filter((p) => p.imageUrl).slice(0, 4);
  return (
    <section className="cat-page cat-cover">
      <img className="cat-cover-logo" src={brandLogo} alt={BRAND_NAME} />
      <div className="cat-rule" />
      {featured.length > 0 && (
        <div className={`cat-collage cat-collage-${featured.length}`}>
          {featured.map((p) => <ProductImage key={p.id} product={p} />)}
        </div>
      )}
      <div className="cat-cover-text">
        <p className="cat-cover-kicker">Collection</p>
        <h1>{options.title || "Product Collection"}</h1>
        {options.subtitle && <p className="cat-cover-sub">{options.subtitle}</p>}
        <div className="cat-rule cat-rule-short" />
        <p className="cat-cover-count">{products.length} {products.length === 1 ? "design" : "designs"}</p>
      </div>
      {options.contact && <p className="cat-cover-contact">{options.contact}</p>}
    </section>
  );
};

const BackCover: React.FC<{ options: CatalogDocumentOptions }> = ({ options }) => (
  <section className="cat-page cat-back">
    <img className="cat-cover-logo" src={brandLogo} alt={BRAND_NAME} />
    <div className="cat-rule cat-rule-short" />
    <h2>Thank you</h2>
    <p>For enquiries, samples and orders, please get in touch.</p>
    {options.contact && <p className="cat-back-contact">{options.contact}</p>}
  </section>
);

export const CatalogDocument: React.FC<{
  products: Product[];
  qrCodes: Map<string, string>;
  options: CatalogDocumentOptions;
}> = ({ products, qrCodes, options }) => {
  const perPage = Number(options.layout);
  const productPages = chunk(products, perPage);
  const contentsPages = options.showContents ? chunk(products, CONTENTS_PER_PAGE) : [];
  const firstProductPage = 2 + contentsPages.length;
  const pageOf = (index: number) => firstProductPage + Math.floor(index / perPage);
  const header = options.title || BRAND_NAME;

  return (
    <div className="cat-doc">
      <style>{CATALOG_CSS}</style>
      <Cover products={products} options={options} />

      {contentsPages.map((items, i) => (
        <Page key={`contents-${i}`} title={header} contact={options.contact} pageNo={2 + i}>
          {i === 0 && <h2 className="cat-section-title">The Collection</h2>}
          <div className="cat-contents">
            {items.map((p, j) => (
              <div key={p.id} className="cat-thumb">
                <ProductImage product={p} />
                <p className="cat-thumb-code">{p.product_code}</p>
                <p className="cat-thumb-page">p. {pageOf(i * CONTENTS_PER_PAGE + j)}</p>
              </div>
            ))}
          </div>
        </Page>
      ))}

      {productPages.map((items, i) => (
        <Page key={`page-${i}`} title={header} contact={options.contact} pageNo={firstProductPage + i}>
          <div className={`cat-grid cat-grid-${options.layout}`}>
            {items.map((p) => (
              <ProductTile key={p.id} product={p} layout={options.layout} qr={qrCodes.get(p.id)} />
            ))}
          </div>
        </Page>
      ))}

      <BackCover options={options} />
    </div>
  );
};

/** Resolves once every image in the element has loaded (or failed) and web fonts are ready. */
export const waitForCatalogAssets = async (root: HTMLElement | null) => {
  if (!root) return;
  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    images.map((img) =>
      img.complete ? Promise.resolve() : new Promise<void>((resolve) => {
        img.addEventListener("load", () => resolve(), { once: true });
        img.addEventListener("error", () => resolve(), { once: true });
      })
    )
  );
  await document.fonts?.ready;
};

const CATALOG_CSS = `
.cat-doc {
  --ink: #1c1917; --muted: #78716c; --faint: #a8a29e; --gold: #b08d57; --line: #ece5dc; --cream: #faf6f0;
  font-family: Inter, system-ui, sans-serif; color: var(--ink);
}
.cat-doc *, .cat-doc *::before, .cat-doc *::after { box-sizing: border-box; }
.cat-page {
  page: catalog; width: 210mm; height: 297mm; padding: 13mm 14mm 10mm; background: #fff;
  display: flex; flex-direction: column; overflow: hidden; position: relative;
  margin: 0 auto 10mm; box-shadow: 0 2px 14px rgba(28, 25, 23, .12);
}
.cat-head { display: flex; align-items: center; justify-content: space-between; padding-bottom: 3.5mm; border-bottom: .3mm solid var(--gold); }
.cat-head img { height: 10mm; width: auto; mix-blend-mode: multiply; }
.cat-head span { font-size: 7pt; letter-spacing: .28em; text-transform: uppercase; color: var(--muted); }
.cat-body { flex: 1; min-height: 0; padding: 7mm 0 6mm; display: flex; flex-direction: column; }
.cat-foot { display: flex; justify-content: space-between; padding-top: 3mm; border-top: .2mm solid var(--line);
  font-size: 6.5pt; letter-spacing: .2em; text-transform: uppercase; color: var(--faint); }

.cat-img { position: relative; background: #fff; border: .25mm solid var(--line); min-height: 0; }
.cat-img img { position: absolute; inset: 3mm; width: calc(100% - 6mm); height: calc(100% - 6mm); object-fit: contain; }
.cat-img-empty { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  font-size: 7pt; letter-spacing: .2em; text-transform: uppercase; color: var(--faint); background: var(--cream); }

.cat-eyebrow { display: flex; align-items: center; gap: 2.5mm; margin: 0 0 1.5mm; font-size: 7pt; letter-spacing: .22em; text-transform: uppercase; }
.cat-code { color: var(--gold); font-weight: 700; }
.cat-category { color: var(--faint); }
.cat-category::before { content: "•"; margin-right: 2.5mm; color: var(--line); }
.cat-title { font-family: "Cormorant Garamond", Georgia, serif; font-weight: 600; line-height: 1.1; margin: 0 0 3mm; color: var(--ink); }
.cat-specs { margin: 0; display: grid; gap: 1.6mm 6mm; }
.cat-spec { display: flex; flex-direction: column; gap: .4mm; }
.cat-spec dt { font-size: 6.2pt; letter-spacing: .2em; text-transform: uppercase; color: var(--faint); }
.cat-spec dd { margin: 0; font-size: 8.5pt; font-weight: 500; color: #44403c; }
.cat-qr { flex-shrink: 0; display: flex; flex-direction: column; align-items: center; gap: .8mm; }
.cat-qr img { display: block; }
.cat-qr span { font-size: 5.5pt; letter-spacing: .15em; text-transform: uppercase; color: var(--faint); white-space: nowrap; }

.cat-grid { flex: 1; min-height: 0; display: grid; gap: 7mm; }
.cat-tile { min-height: 0; display: flex; }
.cat-info { display: flex; justify-content: space-between; gap: 5mm; }
.cat-info-text { min-width: 0; }

.cat-grid-1 { grid-template-rows: minmax(0, 1fr); }
.cat-tile-1 { flex-direction: column; gap: 7mm; }
.cat-tile-1 .cat-img { flex: 1; }
.cat-tile-1 .cat-info { align-items: flex-end; }
.cat-tile-1 .cat-title { font-size: 28pt; }
.cat-tile-1 .cat-specs { grid-template-columns: repeat(3, auto); justify-content: start; }
.cat-tile-1 .cat-spec dd { font-size: 10pt; }
.cat-tile-1 .cat-qr img { width: 27mm; height: 27mm; }

.cat-grid-2 { grid-template-rows: repeat(2, minmax(0, 1fr)); }
.cat-tile-2 { gap: 7mm; }
.cat-tile-2 + .cat-tile-2 { border-top: .2mm solid var(--line); padding-top: 7mm; }
.cat-tile-2 .cat-img { flex: 0 0 60%; }
.cat-tile-2 .cat-info { flex: 1; flex-direction: column; justify-content: space-between; align-items: flex-start; padding: 2mm 0; }
.cat-tile-2 .cat-title { font-size: 20pt; }
.cat-tile-2 .cat-specs { grid-template-columns: 1fr; }
.cat-tile-2 .cat-qr { align-items: flex-start; }
.cat-tile-2 .cat-qr img { width: 22mm; height: 22mm; }

.cat-grid-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: repeat(2, minmax(0, 1fr)); }
.cat-grid-6 { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: repeat(3, minmax(0, 1fr)); gap: 6mm; }
.cat-tile-4, .cat-tile-6 { flex-direction: column; gap: 3.5mm; }
.cat-tile-4 .cat-img, .cat-tile-6 .cat-img { flex: 1; }
.cat-tile-4 .cat-info, .cat-tile-6 .cat-info { align-items: flex-end; }
.cat-tile-4 .cat-title { font-size: 14pt; margin-bottom: 2mm; }
.cat-tile-6 .cat-title { font-size: 12pt; margin-bottom: 1.5mm; }
.cat-tile-4 .cat-specs, .cat-tile-6 .cat-specs { grid-template-columns: repeat(2, auto); justify-content: start; gap: 1mm 5mm; }
.cat-tile-6 .cat-spec dd { font-size: 7.5pt; }
.cat-tile-4 .cat-qr img { width: 16mm; height: 16mm; }
.cat-tile-6 .cat-qr img { width: 13mm; height: 13mm; }
.cat-tile-6 .cat-qr span { display: none; }

.cat-cover, .cat-back { padding: 20mm 18mm 16mm; align-items: center; text-align: center; }
.cat-cover-logo { height: 34mm; width: auto; mix-blend-mode: multiply; }
.cat-rule { width: 100%; height: .3mm; background: var(--gold); margin: 9mm 0; flex-shrink: 0; }
.cat-rule-short { width: 22mm; margin: 6mm auto; }
.cat-collage { flex: 1; min-height: 0; width: 100%; display: grid; gap: 4mm; }
.cat-collage .cat-img { border-color: var(--line); }
.cat-collage-1 { grid-template: minmax(0, 1fr) / 1fr; }
.cat-collage-2 { grid-template: minmax(0, 1fr) / repeat(2, 1fr); }
.cat-collage-3 { grid-template: repeat(2, minmax(0, 1fr)) / repeat(2, 1fr); }
.cat-collage-3 .cat-img:first-child { grid-row: span 2; }
.cat-collage-4 { grid-template: repeat(2, minmax(0, 1fr)) / repeat(2, 1fr); }
.cat-cover-text { padding-top: 10mm; }
.cat-cover-kicker { margin: 0 0 3mm; font-size: 8pt; letter-spacing: .45em; text-transform: uppercase; color: var(--gold); }
.cat-cover h1 { margin: 0; font-family: "Cormorant Garamond", Georgia, serif; font-weight: 600; font-size: 40pt; line-height: 1.05; }
.cat-cover-sub { margin: 3mm 0 0; font-size: 12pt; color: var(--muted); letter-spacing: .08em; }
.cat-cover-count { margin: 0; font-size: 7.5pt; letter-spacing: .3em; text-transform: uppercase; color: var(--faint); }
.cat-cover-contact, .cat-back-contact { margin: 8mm 0 0; font-size: 8pt; letter-spacing: .2em; text-transform: uppercase; color: var(--muted); }

.cat-back { justify-content: center; }
.cat-back h2 { margin: 0 0 4mm; font-family: "Cormorant Garamond", Georgia, serif; font-weight: 600; font-size: 30pt; }
.cat-back p { margin: 0; font-size: 10pt; color: var(--muted); }

.cat-section-title { margin: 0 0 6mm; font-family: "Cormorant Garamond", Georgia, serif; font-weight: 600; font-size: 22pt; }
.cat-contents { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 5mm 4mm; align-content: start; }
.cat-thumb .cat-img { aspect-ratio: 1; }
.cat-thumb .cat-img img { inset: 1.5mm; width: calc(100% - 3mm); height: calc(100% - 3mm); }
.cat-thumb-code { margin: 1.5mm 0 0; font-size: 7pt; font-weight: 700; letter-spacing: .1em; color: var(--ink); }
.cat-thumb-page { margin: 0; font-size: 6pt; color: var(--faint); }

@media print {
  @page catalog { size: A4; margin: 0; }
  .cat-page { margin: 0; box-shadow: none; break-after: page; page-break-after: always; }
  .cat-page:last-child { break-after: auto; page-break-after: auto; }
  .cat-doc, .cat-doc * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;
