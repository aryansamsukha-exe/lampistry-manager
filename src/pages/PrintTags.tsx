import React, { useEffect, useMemo, useState } from "react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader, Printer, Search } from "lucide-react";
import { toast } from "sonner";
import type { Product } from "@/components/ProductCard";
import brandLogo from "@/assets/anjani-art-logo.png";
import { getProducts, searchProducts } from "@/services/productService";
import { getImportBatches, getSavedBatchFilter, type ImportBatch } from "@/services/importBatchService";
import { generateQRCode } from "@/services/qrService";
import { BRAND_NAME } from "@/lib/productDisplay";

const TAGS_PER_SHEET = 16; // 4 × 4 tags of 48 × 70 mm on A4
const NO_BATCH = "no-batch";
const ALL = "all";

const chunk = <T,>(items: T[], size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, i * size + size));

const TagRow: React.FC<{ label: string; value: string | null }> = ({ label, value }) =>
  value ? (
    <div className="tag-row">
      <span className="tag-label">{label}</span>
      <span className="tag-value">{value}</span>
    </div>
  ) : null;

const Tag: React.FC<{ product: Product; qr?: string }> = ({ product, qr }) => {
  return (
    <div className="tag">
      <div className="tag-header">
        <img className="tag-logo" src={brandLogo} alt={BRAND_NAME} />
      </div>
      <div className="tag-body">
        <div className="tag-qr">
          {qr ? <img src={qr} alt={`QR ${product.product_code}`} /> : <Loader className="h-5 w-5 animate-spin text-stone-300" />}
          <span className="tag-code">{product.product_code}</span>
          <span className="tag-scan">Scan for photos</span>
        </div>
        <div className="tag-details">
          <TagRow label="Finish:" value={product.finish ?? null} />
        </div>
      </div>
    </div>
  );
};

const PrintTags: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [folder, setFolder] = useState<string>(() => {
    const saved = getSavedBatchFilter();
    return saved || ALL;
  });
  const [query, setQuery] = useState("");
  const [deselected, setDeselected] = useState<Set<string>>(new Set());
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([getProducts(undefined, false), getImportBatches()])
      .then(([list, batchList]) => {
        setProducts(list);
        setBatches(batchList);
        setFolder((current) =>
          current === ALL || current === NO_BATCH || batchList.some((b) => b.id === current) ? current : ALL
        );
      })
      .catch(() => toast.error("Failed to load products"))
      .finally(() => setIsLoading(false));
  }, []);

  const visible = useMemo(() => {
    const inFolder =
      folder === ALL ? products
      : folder === NO_BATCH ? products.filter((p) => !p.import_batch_id)
      : products.filter((p) => p.import_batch_id === folder);
    return searchProducts(inFolder, query);
  }, [products, folder, query]);

  const selected = useMemo(() => visible.filter((p) => !deselected.has(p.id)), [visible, deselected]);
  const sheets = useMemo(() => chunk(selected, TAGS_PER_SHEET), [selected]);

  useEffect(() => {
    const missing = selected.filter((p) => !qrCodes[p.id]);
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      const generated: Record<string, string> = {};
      for (const product of missing) {
        try {
          generated[product.id] = await generateQRCode(product, 400);
        } catch (error) {
          console.error(`QR failed for ${product.product_code}:`, error);
        }
      }
      if (!cancelled) setQrCodes((current) => ({ ...current, ...generated }));
    })();
    return () => { cancelled = true; };
  }, [selected, qrCodes]);

  const toggle = (id: string) =>
    setDeselected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const setAll = (checked: boolean) =>
    setDeselected((current) => {
      const next = new Set(current);
      visible.forEach((p) => (checked ? next.delete(p.id) : next.add(p.id)));
      return next;
    });

  const qrReady = selected.every((p) => qrCodes[p.id]);

  return (
    <div className="min-h-screen bg-stone-100">
      <style>{`
        .tag-sheet {
          width: 210mm; height: 297mm; padding: 8.5mm 9mm; box-sizing: border-box; background: white;
          display: grid; grid-template-columns: repeat(4, 48mm); grid-auto-rows: 70mm; align-content: start;
          margin: 0 auto 10mm; box-shadow: 0 1px 6px rgba(0,0,0,.15);
        }
        .tag {
          width: 48mm; height: 70mm; box-sizing: border-box; padding: 3mm; overflow: hidden;
          outline: 0.25mm dashed #9ca3af; outline-offset: -0.125mm; text-align: center;
          display: flex; flex-direction: column; gap: 1mm; font-family: Arial, Helvetica, sans-serif; color: #111;
        }
        .tag-header { display: flex; justify-content: center; border-bottom: 0.3mm solid #b8862b; padding-bottom: 1mm; }
        .tag-logo { height: 15mm; width: auto; }
        .tag-body { display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 0.8mm; flex: 1; min-height: 0; }
        .tag-qr { flex-shrink: 0; display: flex; flex-direction: column; align-items: center; gap: 0.6mm; }
        .tag-qr img { width: 34mm; height: 34mm; }
        .tag-code { font-size: 12pt; font-weight: 700; line-height: 1.1; color: #111; }
        .tag-scan { font-size: 5.5pt; color: #555; }
        .tag-details { max-width: 100%; min-width: 0; display: flex; flex-direction: column; gap: 0.5mm; }
        .tag-details:empty { display: none; }
        .tag-row { display: flex; justify-content: center; gap: 1mm; font-size: 6.5pt; line-height: 1.2; }
        .tag-label { flex-shrink: 0; color: #555; }
        .tag-value { font-weight: 600; overflow-wrap: anywhere; }
        @media print {
          @page { size: A4; margin: 0; }
          html, body { background: white !important; }
          .no-print { display: none !important; }
          .print-area { padding: 0 !important; margin: 0 !important; }
          .tag-sheet { margin: 0; box-shadow: none; break-after: page; page-break-after: always; }
          .tag-sheet:last-child { break-after: auto; page-break-after: auto; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div className="no-print">
        <Navbar />
      </div>

      <main className="container px-4 py-8 print-area">
        <div className="no-print space-y-4 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Print Tags</h1>
              <p className="text-muted-foreground mt-1">
                48 × 70 mm tear-off cards, 16 per A4 sheet. Cut along the dashed lines.
              </p>
            </div>
            <Button onClick={() => window.print()} disabled={selected.length === 0 || !qrReady} className="gap-2">
              {qrReady ? <Printer className="h-4 w-4" /> : <Loader className="h-4 w-4 animate-spin" />}
              {qrReady
                ? `Print ${selected.length} tags (${sheets.length} ${sheets.length === 1 ? "sheet" : "sheets"})`
                : "Preparing QR codes…"}
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={folder} onValueChange={(value) => { setFolder(value); setDeselected(new Set()); }}>
              <SelectTrigger className="sm:w-72 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All products ({products.length})</SelectItem>
                {batches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.batch_name}</SelectItem>
                ))}
                <SelectItem value={NO_BATCH}>Older products</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-10 bg-white" placeholder="Search by code or description…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          </div>

          <div className="rounded-lg border bg-white">
            <div className="flex items-center justify-between border-b px-4 py-2 text-sm">
              <label className="flex items-center gap-2 font-medium">
                <Checkbox
                  checked={visible.length > 0 && selected.length === visible.length}
                  onCheckedChange={(checked) => setAll(checked === true)}
                />
                Select all
              </label>
              <span className="text-muted-foreground">{selected.length} of {visible.length} selected</span>
            </div>
            <div className="max-h-56 overflow-y-auto grid sm:grid-cols-2 lg:grid-cols-3 gap-x-4 px-4 py-2">
              {isLoading ? (
                <div className="py-6 col-span-full flex justify-center"><Loader className="h-5 w-5 animate-spin" /></div>
              ) : visible.map((p) => (
                <label key={p.id} className="flex items-center gap-2 py-1 text-sm cursor-pointer">
                  <Checkbox checked={!deselected.has(p.id)} onCheckedChange={() => toggle(p.id)} />
                  <span className="font-mono font-medium">{p.product_code}</span>
                  <span className="truncate text-muted-foreground">{p.description}</span>
                </label>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            When printing, choose paper size A4, margins "None" (or "Default") and scale 100% so the tags come out at the exact size.
          </p>
        </div>

        {sheets.map((sheet, i) => (
          <div key={i} className="tag-sheet">
            {sheet.map((product) => <Tag key={product.id} product={product} qr={qrCodes[product.id]} />)}
          </div>
        ))}
      </main>
    </div>
  );
};

export default PrintTags;
