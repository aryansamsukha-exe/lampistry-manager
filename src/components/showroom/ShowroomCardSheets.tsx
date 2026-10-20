import React from "react";
import type { ShowroomItem } from "@/services/showroomService";
import { cardTitle, formatCardPrice, formatCardSize } from "@/lib/showroomCard";

export const CARDS_PER_SHEET = 8; // 2 × 4 cards of 99 × 68 mm on A4

const chunk = <T,>(items: T[], size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, i * size + size));

type CardItem = Pick<
  ShowroomItem,
  "id" | "product_code" | "description" | "finish" | "length" | "width" | "height" | "price" | "image_url"
>;

const ShowroomCard: React.FC<{ item: CardItem }> = ({ item }) => {
  const size = formatCardSize(item);
  const price = formatCardPrice(item.price);
  return (
    <div className="sr-card">
      <div className="sr-photo">
        {item.image_url ? <img src={item.image_url} alt={item.product_code ?? ""} /> : <span>No photo</span>}
      </div>
      <div className="sr-details">
        <div>
          {item.product_code && <p className="sr-code">{item.product_code}</p>}
          <h3 className="sr-title">{cardTitle(item)}</h3>
          <div className="sr-rule" />
          <dl className="sr-specs">
            {item.finish && (<div><dt>Finish</dt><dd>{item.finish}</dd></div>)}
            {size && (<div><dt>Size</dt><dd>{size}</dd></div>)}
          </dl>
        </div>
        {price && <p className="sr-price">{price}</p>}
      </div>
    </div>
  );
};

export const ShowroomCardSheets: React.FC<{ items: CardItem[] }> = ({ items }) => (
  <div className="sr-doc">
    <style>{SHOWROOM_CARD_CSS}</style>
    {chunk(items, CARDS_PER_SHEET).map((sheet, i) => (
      <section key={i} className="sr-sheet">
        {sheet.map((item) => <ShowroomCard key={item.id} item={item} />)}
      </section>
    ))}
  </div>
);

const SHOWROOM_CARD_CSS = `
.sr-doc { --ink: #1c1917; --muted: #78716c; --faint: #a8a29e; --accent: #a8916b; --line: #e7e1d8; color: var(--ink); font-family: Inter, system-ui, sans-serif; }
.sr-doc *, .sr-doc *::before, .sr-doc *::after { box-sizing: border-box; }
.sr-sheet {
  page: showroom; width: 210mm; height: 297mm; padding: 12.5mm 6mm; background: #fff;
  display: grid; grid-template-columns: repeat(2, 99mm); grid-template-rows: repeat(4, 68mm); align-content: start;
  margin: 0 auto 10mm; box-shadow: 0 2px 12px rgba(28, 25, 23, .14);
}
.sr-card {
  width: 99mm; height: 68mm; padding: 4mm; display: flex; gap: 4mm; overflow: hidden;
  outline: .25mm dashed #c7c2bc; outline-offset: -.125mm;
}
.sr-photo { position: relative; flex: 0 0 44mm; border: .25mm solid var(--line); background: #fff; }
.sr-photo img { position: absolute; inset: 1.5mm; width: calc(100% - 3mm); height: calc(100% - 3mm); object-fit: contain; }
.sr-photo span { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  font-size: 6pt; letter-spacing: .2em; text-transform: uppercase; color: var(--faint); background: #faf8f5; }
.sr-details { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: space-between; padding: 1mm 0 .5mm; }
.sr-code { margin: 0 0 1.2mm; font-size: 6.5pt; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; color: var(--accent); }
.sr-title {
  margin: 0; font-family: "Cormorant Garamond", Georgia, serif; font-weight: 600; font-size: 13pt; line-height: 1.08;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
.sr-rule { width: 9mm; height: .3mm; background: var(--accent); margin: 2.5mm 0; }
.sr-specs { margin: 0; display: flex; flex-direction: column; gap: 1.4mm; }
.sr-specs dt { font-size: 5.5pt; letter-spacing: .2em; text-transform: uppercase; color: var(--faint); }
.sr-specs dd { margin: .3mm 0 0; font-size: 7.5pt; font-weight: 500; color: #44403c; overflow-wrap: anywhere; }
.sr-price { margin: 0; font-family: "Cormorant Garamond", Georgia, serif; font-weight: 700; font-size: 24pt; line-height: 1; color: var(--ink); }

@media print {
  @page showroom { size: A4; margin: 0; }
  .sr-sheet { margin: 0; box-shadow: none; break-after: page; page-break-after: always; }
  .sr-sheet:last-child { break-after: auto; page-break-after: auto; }
  .sr-doc, .sr-doc * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;
