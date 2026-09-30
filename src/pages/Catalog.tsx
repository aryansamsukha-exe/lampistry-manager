import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, BookOpen, Check, ChevronDown, Copy, Download, Filter,
  Grid2x2, Grid3x3, ImageOff, Layers, Loader, Package, PackageOpen,
  Printer, QrCode, Save, Search, Settings, SortAsc, Star, Trash2,
  X, Eye, LayoutGrid, Columns2, LayoutList, Plus, AlertTriangle,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/context/AuthContext";
import type { Product } from "@/components/ProductCard";
import { getProducts, searchProducts } from "@/services/productService";
import { formatCbm } from "@/services/catalogService";
import { getImportBatches, type ImportBatch } from "@/services/importBatchService";
import {
  getSavedCatalogs, saveCatalog, deleteCatalog, getCatalogProductIds,
  type SavedCatalog,
} from "@/services/catalogGenerationService";
import { generateQRCode } from "@/services/qrService";
import { toast } from "sonner";

// ─── helpers ───────────────────────────────────────────────────────────────

const dim = (p: Product) =>
  p.length && p.width && p.height
    ? `${p.length} × ${p.width} × ${p.height} cm`
    : p.dimensions || "—";

const fmtPrice = (n: number) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

// ─── product selection card ─────────────────────────────────────────────────

const SelectionCard: React.FC<{
  product: Product;
  selected: boolean;
  onToggle: () => void;
}> = ({ product, selected, onToggle }) => (
  <div
    onClick={onToggle}
    className={`group relative cursor-pointer rounded-xl overflow-hidden border-2 transition-all duration-200 bg-white
      ${selected
        ? "border-stone-900 shadow-lg ring-1 ring-stone-900/20"
        : "border-stone-200 hover:border-stone-400 hover:shadow-md"
      }`}
  >
    {/* checkbox */}
    <div className={`absolute top-3 right-3 z-10 w-6 h-6 rounded-md flex items-center justify-center transition-all
      ${selected ? "bg-stone-900 text-white" : "bg-white border-2 border-stone-300 group-hover:border-stone-500"}`}
    >
      {selected && <Check className="w-3.5 h-3.5" />}
    </div>

    {/* image */}
    <div className="aspect-[4/3] bg-stone-50 overflow-hidden">
      {product.imageUrl ? (
        <img
          src={product.imageUrl}
          alt={product.product_code}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-stone-300">
          <ImageOff className="w-8 h-8" />
          <span className="text-xs">No image</span>
        </div>
      )}
    </div>

    {/* details */}
    <div className="p-4">
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="font-mono text-sm font-semibold text-stone-800 truncate">{product.product_code}</p>
        <p className="text-sm font-semibold text-amber-700 whitespace-nowrap">{fmtPrice(product.price)}</p>
      </div>
      {product.description && (
        <p className="text-xs text-stone-500 mb-2 line-clamp-2 leading-relaxed">{product.description}</p>
      )}
      <div className="text-xs text-stone-400 space-y-0.5">
        <p>{dim(product)}</p>
        <p>CBM: {formatCbm(product)}</p>
      </div>
    </div>
  </div>
);

// ─── catalog product card (for preview) ─────────────────────────────────────

const CatalogProductCard: React.FC<{
  product: Product;
  qrDataUrl?: string;
  layout: string;
}> = ({ product, qrDataUrl, layout }) => {
  const isLarge = layout === "1";
  const isMedium = layout === "2";

  return (
    <div className={`catalog-product-card bg-white border border-stone-200 rounded-lg overflow-hidden
      ${isLarge ? "flex gap-0 h-full" : "flex flex-col"}`}
    >
      <div className={`bg-stone-50 overflow-hidden flex-shrink-0
        ${isLarge ? "w-1/2 aspect-auto min-h-[400px]" : isMedium ? "aspect-[4/3]" : "aspect-[3/2]"}`}
      >
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.product_code}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-300 flex-col gap-2">
            <ImageOff className="w-10 h-10" />
            <span className="text-xs">No image</span>
          </div>
        )}
      </div>

      <div className={`p-5 flex flex-col justify-between flex-1 ${isLarge ? "p-8" : ""}`}>
        <div>
          <p className="font-mono text-xs font-semibold text-stone-400 mb-1 tracking-wide">{product.product_code}</p>
          <h3 className={`font-serif text-stone-900 font-semibold leading-tight mb-2 ${isLarge ? "text-2xl" : "text-lg"}`}>
            {product.description || "Product details on request"}
          </h3>
          <div className={`grid gap-x-6 gap-y-2 text-sm mt-4 ${isLarge ? "grid-cols-2" : "grid-cols-2"}`}>
            <div>
              <p className="text-xs uppercase tracking-widest text-stone-400 mb-1">Dimensions</p>
              <p className="text-stone-700 font-medium">{dim(product)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-stone-400 mb-1">CBM</p>
              <p className="text-stone-700 font-medium">{formatCbm(product)} m³</p>
            </div>
          </div>
        </div>

        <div className={`flex items-end justify-between mt-4 pt-4 border-t border-stone-100 ${isLarge ? "mt-6 pt-6" : ""}`}>
          <div>
            <p className="text-xs uppercase tracking-widest text-stone-400 mb-1">Price</p>
            <p className={`font-bold text-stone-900 ${isLarge ? "text-3xl" : "text-xl"}`}>{fmtPrice(product.price)}</p>
          </div>
          {qrDataUrl && (
            <div className="text-right">
              <img src={qrDataUrl} alt="QR" className={`${isLarge ? "w-24 h-24" : "w-16 h-16"} rounded`} />
              <p className="text-[10px] text-stone-400 mt-1">Scan for details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── QR card (for QR-card printing) ─────────────────────────────────────────

const QRCard: React.FC<{
  product: Product;
  qrDataUrl: string;
  options: QRCardOptions;
}> = ({ product, qrDataUrl, options }) => (
  <div className="qr-card bg-white border border-stone-200 rounded-xl flex flex-col items-center p-6 text-center gap-3 break-inside-avoid">
    <div className="text-xs font-semibold uppercase tracking-widest text-stone-400">ProductMaster</div>
    {options.showImage && product.imageUrl && (
      <img src={product.imageUrl} alt={product.product_code} className="w-24 h-24 object-cover rounded-lg" />
    )}
    {options.showQR && (
      <div className="p-3 bg-white rounded-lg border border-stone-100 shadow-sm">
        <img src={qrDataUrl} alt="QR Code" className="w-32 h-32" />
      </div>
    )}
    {options.showCode && (
      <p className="font-mono text-sm font-bold text-stone-800">{product.product_code}</p>
    )}
    {options.showDescription && product.description && (
      <p className="text-xs text-stone-600 font-medium leading-snug px-1">{product.description}</p>
    )}
    {options.showDimensions && (
      <p className="text-xs text-stone-500">{dim(product)}</p>
    )}
    {options.showPrice && (
      <p className="text-base font-bold text-stone-900">{fmtPrice(product.price)}</p>
    )}
    {options.showCbm && (
      <p className="text-xs text-stone-400">CBM: {formatCbm(product)}</p>
    )}
    <p className="text-[10px] text-stone-300 uppercase tracking-widest">Scan for details</p>
  </div>
);

// ─── types ───────────────────────────────────────────────────────────────────

type QRCardOptions = {
  showImage: boolean;
  showQR: boolean;
  showCode: boolean;
  showDescription: boolean;
  showDimensions: boolean;
  showPrice: boolean;
  showCbm: boolean;
};

type CatalogConfig = {
  name: string;
  coverTitle: string;
  coverSubtitle: string;
  layout: "1" | "2" | "4";
};

type PrintMode = "catalog" | "qr-cards";

// ─── main component ───────────────────────────────────────────────────────────

const Catalog: React.FC = () => {
  const { isAuthenticated, loadingSession } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const printAreaRef = useRef<HTMLDivElement>(null);

  // data
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [savedCatalogs, setSavedCatalogs] = useState<SavedCatalog[]>([]);

  // selection state
  const [selectedBatchId, setSelectedBatchId] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"code" | "price-asc" | "price-desc" | "newest">("code");
  const [filterImage, setFilterImage] = useState<"all" | "with" | "without">("all");

  // ui state
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"select" | "preview" | "qr-cards" | "saved">("select");
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editingCatalogId, setEditingCatalogId] = useState<string | undefined>();

  // catalog config
  const [config, setConfig] = useState<CatalogConfig>({
    name: "",
    coverTitle: "Product Collection",
    coverSubtitle: new Date().getFullYear().toString(),
    layout: "2",
  });

  // QR card options
  const [qrCardLayout, setQrCardLayout] = useState<"1" | "4" | "6" | "8">("4");
  const [qrOptions, setQrOptions] = useState<QRCardOptions>({
    showImage: true, showQR: true, showCode: true,
    showDescription: true, showDimensions: true, showPrice: true, showCbm: true,
  });

  // generated QR codes (lazy, only for selected)
  const [qrMap, setQrMap] = useState<Map<string, string>>(new Map());
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);

  // ── load data ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!loadingSession && !isAuthenticated) navigate("/login");
  }, [isAuthenticated, loadingSession, navigate]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const init = async () => {
      try {
        const [prods, batchList, cats] = await Promise.all([
          getProducts(),
          getImportBatches(),
          getSavedCatalogs(),
        ]);
        setAllProducts(prods);
        setBatches(batchList);
        setSavedCatalogs(cats);

        // pre-select batch from URL param (e.g. after import)
        const batchParam = searchParams.get("batch");
        if (batchParam && batchList.some((b) => b.id === batchParam)) {
          setSelectedBatchId(batchParam);
        }
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [isAuthenticated, searchParams]);

  // ── filtered / sorted product list ────────────────────────────────────────

  const visibleProducts = useMemo(() => {
    let list =
      selectedBatchId === "all"
        ? allProducts
        : selectedBatchId === "no-batch"
        ? allProducts.filter((p) => !p.import_batch_id)
        : allProducts.filter((p) => p.import_batch_id === selectedBatchId);

    if (filterImage === "with") list = list.filter((p) => p.imageUrl);
    if (filterImage === "without") list = list.filter((p) => !p.imageUrl);
    if (query.trim()) list = searchProducts(list, query);

    list = [...list].sort((a, b) => {
      if (sortBy === "price-asc") return a.price - b.price;
      if (sortBy === "price-desc") return b.price - a.price;
      if (sortBy === "newest")
        return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
      return a.product_code.localeCompare(b.product_code);
    });

    return list;
  }, [allProducts, selectedBatchId, filterImage, query, sortBy]);

  const selectedProducts = useMemo(
    () => allProducts.filter((p) => selectedIds.has(p.id)),
    [allProducts, selectedIds]
  );

  const missingImageCount = selectedProducts.filter((p) => !p.imageUrl).length;

  // ── QR generation (lazy) ──────────────────────────────────────────────────

  const generateQRCodes = useCallback(async (products: Product[]) => {
    if (products.length === 0) return;
    setIsGeneratingQR(true);
    const map = new Map<string, string>(qrMap);
    const toGenerate = products.filter((p) => p.id && !map.has(p.id));
    await Promise.all(
      toGenerate.map(async (p) => {
        try {
          const url = await generateQRCode(p, 300);
          map.set(p.id, url);
        } catch {
          // skip
        }
      })
    );
    setQrMap(new Map(map));
    setIsGeneratingQR(false);
  }, [qrMap]);

  // ── selection helpers ──────────────────────────────────────────────────────

  const toggleProduct = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(visibleProducts.map((p) => p.id)));
  const clearAll = () => setSelectedIds(new Set());

  // ── move to preview ────────────────────────────────────────────────────────

  const handleCreateCatalog = async () => {
    if (selectedIds.size === 0) {
      toast.warning("Select at least one product to create a catalog.");
      return;
    }
    setShowConfigDialog(true);
  };

  const handleGoToPreview = async () => {
    setShowConfigDialog(false);
    setActiveTab("preview");
    await generateQRCodes(selectedProducts);
  };

  const handleGoToQRCards = async () => {
    if (selectedIds.size === 0) {
      toast.warning("Select products first.");
      return;
    }
    setActiveTab("qr-cards");
    await generateQRCodes(selectedProducts);
  };

  // ── save catalog ───────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!config.name.trim()) {
      toast.warning("Please enter a catalog name.");
      return;
    }
    setIsSaving(true);
    try {
      await saveCatalog({
        id: editingCatalogId,
        name: config.name,
        coverTitle: config.coverTitle,
        coverSubtitle: config.coverSubtitle,
        layout: config.layout,
        importBatchId: selectedBatchId !== "all" && selectedBatchId !== "no-batch" ? selectedBatchId : undefined,
        productIds: selectedProducts.map((p) => p.id),
      });
      const cats = await getSavedCatalogs();
      setSavedCatalogs(cats);
      toast.success("Catalog saved.");
      setShowSaveDialog(false);
      setEditingCatalogId(undefined);
    } catch (err) {
      console.error(err);
      toast.error("Failed to save catalog.");
    } finally {
      setIsSaving(false);
    }
  };

  // ── open saved catalog ─────────────────────────────────────────────────────

  const handleOpenSavedCatalog = async (cat: SavedCatalog) => {
    try {
      const productIds = await getCatalogProductIds(cat.id);
      setSelectedIds(new Set(productIds));
      setConfig({
        name: cat.name,
        coverTitle: cat.cover_title ?? "Product Collection",
        coverSubtitle: cat.cover_subtitle ?? new Date().getFullYear().toString(),
        layout: (cat.layout as CatalogConfig["layout"]) || "2",
      });
      if (cat.import_batch_id) setSelectedBatchId(cat.import_batch_id);
      setEditingCatalogId(cat.id);
      setActiveTab("select");
      toast.success(`Opened "${cat.name}"`);
    } catch {
      toast.error("Failed to open catalog.");
    }
  };

  const handleDuplicateCatalog = async (cat: SavedCatalog) => {
    try {
      const productIds = await getCatalogProductIds(cat.id);
      await saveCatalog({
        name: `${cat.name} (Copy)`,
        coverTitle: cat.cover_title ?? undefined,
        coverSubtitle: cat.cover_subtitle ?? undefined,
        layout: cat.layout,
        productIds,
      });
      const cats = await getSavedCatalogs();
      setSavedCatalogs(cats);
      toast.success("Catalog duplicated.");
    } catch {
      toast.error("Failed to duplicate.");
    }
  };

  const handleDeleteCatalog = async (id: string) => {
    try {
      await deleteCatalog(id);
      setSavedCatalogs((prev) => prev.filter((c) => c.id !== id));
      toast.success("Catalog deleted.");
    } catch {
      toast.error("Failed to delete.");
    }
    setShowDeleteDialog(null);
  };

  // ── print ──────────────────────────────────────────────────────────────────

  const handlePrint = () => window.print();

  // ── render ─────────────────────────────────────────────────────────────────

  if (loadingSession || !isAuthenticated) return null;

  // Columns per row depending on layout
  const gridCols = config.layout === "1" ? 1 : config.layout === "2" ? 2 : 4;
  const qrCardsPerRow = qrCardLayout === "1" ? 1 : qrCardLayout === "4" ? 2 : qrCardLayout === "6" ? 3 : 4;

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      {/* ── print styles (injected as style tag) ──────────────────────────── */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .catalog-print-area {
            display: block !important;
            max-width: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .print-page {
            page-break-after: always;
            break-after: page;
          }
          .print-page:last-child {
            page-break-after: avoid;
            break-after: avoid;
          }
          .catalog-product-card, .qr-card {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          @page {
            size: A4;
            margin: 12mm;
          }
        }
      `}</style>

      {/* ── Navbar (hidden on print) ──────────────────────────────────────── */}
      <div className="no-print">
        <Navbar />
      </div>

      <main className="mx-auto max-w-7xl px-4 sm:px-8 py-6">
        {/* ── top bar ───────────────────────────────────────────────────── */}
        <div className="no-print mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-stone-900">Catalog Builder</h1>
            <p className="text-stone-500 mt-1 text-sm">
              Select products, configure your catalog, and print or save.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {activeTab !== "select" && (
              <Button variant="outline" size="sm" onClick={() => setActiveTab("select")}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Back to Selection
              </Button>
            )}
            {(activeTab === "preview" || activeTab === "qr-cards") && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setShowSaveDialog(true); }}
                >
                  <Save className="w-4 h-4 mr-1" /> Save Catalog
                </Button>
                <Button size="sm" onClick={handlePrint}>
                  <Printer className="w-4 h-4 mr-1" /> Print / PDF
                </Button>
              </>
            )}
          </div>
        </div>

        {/* ── tabs ─────────────────────────────────────────────────────── */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="no-print">
          <TabsList className="mb-6 bg-white border border-stone-200 h-10">
            <TabsTrigger value="select" className="gap-1.5">
              <Package className="w-3.5 h-3.5" /> Select Products
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-1.5">
              <Eye className="w-3.5 h-3.5" /> Catalog Preview
            </TabsTrigger>
            <TabsTrigger value="qr-cards" className="gap-1.5">
              <QrCode className="w-3.5 h-3.5" /> QR Cards
            </TabsTrigger>
            <TabsTrigger value="saved" className="gap-1.5">
              <Star className="w-3.5 h-3.5" /> Saved Catalogs
            </TabsTrigger>
          </TabsList>

          {/* ═══════════════════════════════════════════════════════════════
              TAB 1 — PRODUCT SELECTION
          ═══════════════════════════════════════════════════════════════ */}
          <TabsContent value="select">
            {isLoading ? (
              <div className="flex justify-center items-center py-32">
                <Loader className="w-8 h-8 animate-spin text-stone-400" />
              </div>
            ) : (
              <div className="space-y-5">
                {/* filters row */}
                <div className="bg-white rounded-xl border border-stone-200 p-4 flex flex-col gap-3">
                  {/* batch selector */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1">
                      <Label className="text-xs text-stone-500 mb-1 block">Import Batch</Label>
                      <Select value={selectedBatchId} onValueChange={setSelectedBatchId}>
                        <SelectTrigger className="bg-stone-50 border-stone-200 h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Products ({allProducts.length})</SelectItem>
                          {batches.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.batch_name} — {b.product_count} products
                            </SelectItem>
                          ))}
                          <SelectItem value="no-batch">No batch (legacy)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex-1">
                      <Label className="text-xs text-stone-500 mb-1 block">Image Filter</Label>
                      <Select value={filterImage} onValueChange={(v) => setFilterImage(v as typeof filterImage)}>
                        <SelectTrigger className="bg-stone-50 border-stone-200 h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All products</SelectItem>
                          <SelectItem value="with">With image only</SelectItem>
                          <SelectItem value="without">Without image</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex-1">
                      <Label className="text-xs text-stone-500 mb-1 block">Sort By</Label>
                      <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                        <SelectTrigger className="bg-stone-50 border-stone-200 h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="code">Product Code</SelectItem>
                          <SelectItem value="price-asc">Price: Low → High</SelectItem>
                          <SelectItem value="price-desc">Price: High → Low</SelectItem>
                          <SelectItem value="newest">Newest First</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* search + selection controls */}
                  <div className="flex flex-col sm:flex-row gap-3 items-center">
                    <div className="relative flex-1 w-full">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                      <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search product code or description…"
                        className="pl-9 bg-stone-50 h-9 border-stone-200"
                      />
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button variant="outline" size="sm" onClick={selectAll} className="h-9">
                        <Check className="w-3.5 h-3.5 mr-1" /> Select All
                      </Button>
                      <Button variant="ghost" size="sm" onClick={clearAll} className="h-9 text-stone-500">
                        <X className="w-3.5 h-3.5 mr-1" /> Clear
                      </Button>
                    </div>
                  </div>

                  {/* counts */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-stone-500">
                      {visibleProducts.length} products
                    </span>
                    <div className="flex items-center gap-2">
                      {selectedIds.size > 0 && (
                        <Badge variant="secondary" className="bg-stone-900 text-white">
                          {selectedIds.size} selected
                        </Badge>
                      )}
                      {missingImageCount > 0 && selectedIds.size > 0 && (
                        <Badge variant="secondary" className="bg-amber-100 text-amber-700 border border-amber-200">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          {missingImageCount} without image
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* product grid */}
                {visibleProducts.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-stone-300 py-24 text-center">
                    <PackageOpen className="w-12 h-12 text-stone-300 mx-auto mb-3" />
                    <p className="text-stone-500 font-medium">No products found</p>
                    {allProducts.length === 0 && (
                      <Button className="mt-4" onClick={() => navigate("/import")}>
                        <Plus className="w-4 h-4 mr-1" /> Import Products
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {visibleProducts.map((p) => (
                      <SelectionCard
                        key={p.id}
                        product={p}
                        selected={selectedIds.has(p.id)}
                        onToggle={() => toggleProduct(p.id)}
                      />
                    ))}
                  </div>
                )}

                {/* action bar */}
                {selectedIds.size > 0 && (
                  <div className="sticky bottom-4 flex justify-center">
                    <div className="bg-stone-900 text-white rounded-full px-6 py-3 flex items-center gap-4 shadow-2xl">
                      <span className="text-sm font-medium">{selectedIds.size} products selected</span>
                      <Separator orientation="vertical" className="h-5 bg-stone-600" />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-white hover:bg-white/10 rounded-full h-8"
                        onClick={handleGoToQRCards}
                      >
                        <QrCode className="w-4 h-4 mr-1.5" /> QR Cards
                      </Button>
                      <Button
                        size="sm"
                        className="bg-white text-stone-900 hover:bg-stone-100 rounded-full h-8"
                        onClick={handleCreateCatalog}
                      >
                        <BookOpen className="w-4 h-4 mr-1.5" /> Create Catalog
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* ═══════════════════════════════════════════════════════════════
              TAB 2 — CATALOG PREVIEW
          ═══════════════════════════════════════════════════════════════ */}
          <TabsContent value="preview">
            {selectedProducts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-stone-300 py-24 text-center">
                <BookOpen className="w-12 h-12 text-stone-300 mx-auto mb-3" />
                <p className="text-stone-500 mb-2">No products selected</p>
                <Button onClick={() => setActiveTab("select")}>Select Products</Button>
              </div>
            ) : (
              <>
                {/* layout picker (no-print) */}
                <div className="no-print mb-6 flex items-center gap-3 flex-wrap">
                  <p className="text-sm font-medium text-stone-600">Layout:</p>
                  {(["1", "2", "4"] as CatalogConfig["layout"][]).map((l) => (
                    <Button
                      key={l}
                      variant={config.layout === l ? "default" : "outline"}
                      size="sm"
                      onClick={() => setConfig((c) => ({ ...c, layout: l }))}
                      className="gap-1.5"
                    >
                      {l === "1" ? <Columns2 className="w-3.5 h-3.5" /> : l === "2" ? <Grid2x2 className="w-3.5 h-3.5" /> : <Grid3x3 className="w-3.5 h-3.5" />}
                      {l === "1" ? "1 / page" : l === "2" ? "2 / page" : "4 / page"}
                    </Button>
                  ))}
                  {isGeneratingQR && (
                    <span className="text-xs text-stone-400 flex items-center gap-1">
                      <Loader className="w-3 h-3 animate-spin" /> Generating QR codes…
                    </span>
                  )}
                </div>

                {/* ── printable area ──────────────────────────────────────── */}
                <div ref={printAreaRef} className="catalog-print-area space-y-0">
                  {/* cover page */}
                  <div className="print-page bg-stone-900 text-stone-50 rounded-2xl overflow-hidden min-h-[500px] flex flex-col items-center justify-center text-center p-12 relative">
                    {/* cover hero image (first product with image) */}
                    {(() => {
                      const hero = selectedProducts.find((p) => p.imageUrl);
                      return hero?.imageUrl ? (
                        <div className="absolute inset-0 opacity-20">
                          <img src={hero.imageUrl} alt="" className="w-full h-full object-cover" />
                        </div>
                      ) : null;
                    })()}
                    <div className="relative z-10 space-y-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-300">
                        Product Collection
                      </p>
                      <h1 className="font-serif text-5xl sm:text-6xl font-bold leading-tight max-w-2xl">
                        {config.coverTitle || "Product Collection"}
                      </h1>
                      {config.coverSubtitle && (
                        <p className="text-stone-300 text-xl">{config.coverSubtitle}</p>
                      )}
                      <p className="text-stone-400 text-sm mt-6">
                        {selectedProducts.length} products · Detailed specifications
                      </p>
                    </div>
                  </div>

                  {/* product pages */}
                  {Array.from(
                    { length: Math.ceil(selectedProducts.length / gridCols) },
                    (_, pageIndex) => {
                      const pageProducts = selectedProducts.slice(
                        pageIndex * gridCols,
                        (pageIndex + 1) * gridCols
                      );
                      return (
                        <div
                          key={pageIndex}
                          className={`print-page mt-6 grid gap-6 ${
                            gridCols === 1 ? "grid-cols-1" : gridCols === 2 ? "grid-cols-2" : "grid-cols-2"
                          }`}
                        >
                          {pageProducts.map((p) => (
                            <CatalogProductCard
                              key={p.id}
                              product={p}
                              qrDataUrl={qrMap.get(p.id)}
                              layout={config.layout}
                            />
                          ))}
                        </div>
                      );
                    }
                  )}

                  {/* footer */}
                  <p className="no-print text-center text-xs text-stone-400 uppercase tracking-widest mt-8 pt-6 border-t border-stone-200">
                    ProductMaster · {new Date().getFullYear()}
                  </p>
                </div>
              </>
            )}
          </TabsContent>

          {/* ═══════════════════════════════════════════════════════════════
              TAB 3 — QR CARDS
          ═══════════════════════════════════════════════════════════════ */}
          <TabsContent value="qr-cards">
            {selectedProducts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-stone-300 py-24 text-center">
                <QrCode className="w-12 h-12 text-stone-300 mx-auto mb-3" />
                <p className="text-stone-500 mb-2">No products selected</p>
                <Button onClick={() => setActiveTab("select")}>Select Products</Button>
              </div>
            ) : (
              <>
                {/* controls (no-print) */}
                <div className="no-print mb-6 grid sm:grid-cols-2 gap-6">
                  {/* layout */}
                  <div className="bg-white rounded-xl border border-stone-200 p-5">
                    <p className="text-sm font-semibold text-stone-700 mb-3">Cards per page</p>
                    <div className="flex gap-2 flex-wrap">
                      {(["1", "4", "6", "8"] as typeof qrCardLayout[]).map((l) => (
                        <Button
                          key={l}
                          variant={qrCardLayout === l ? "default" : "outline"}
                          size="sm"
                          onClick={() => setQrCardLayout(l)}
                        >
                          {l} {l === "1" ? "card" : "cards"}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* options */}
                  <div className="bg-white rounded-xl border border-stone-200 p-5">
                    <p className="text-sm font-semibold text-stone-700 mb-3">Card Contents</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(Object.keys(qrOptions) as Array<keyof QRCardOptions>).map((key) => (
                        <label key={key} className="flex items-center gap-2 cursor-pointer text-sm text-stone-600">
                          <Checkbox
                            checked={qrOptions[key]}
                            onCheckedChange={(v) => setQrOptions((o) => ({ ...o, [key]: !!v }))}
                          />
                          {key.replace("show", "").replace(/([A-Z])/g, " $1").trim()}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {isGeneratingQR && (
                  <div className="no-print flex items-center gap-2 text-stone-500 mb-4">
                    <Loader className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Generating QR codes…</span>
                  </div>
                )}

                {/* ── printable QR card grid ────────────────────────────── */}
                <div
                  className="catalog-print-area"
                  style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${qrCardsPerRow}, 1fr)`,
                    gap: "1.25rem",
                  }}
                >
                  {selectedProducts.map((p) => {
                    const qr = qrMap.get(p.id);
                    if (!qr) return null;
                    return (
                      <QRCard
                        key={p.id}
                        product={p}
                        qrDataUrl={qr}
                        options={qrOptions}
                      />
                    );
                  })}
                </div>
              </>
            )}
          </TabsContent>

          {/* ═══════════════════════════════════════════════════════════════
              TAB 4 — SAVED CATALOGS
          ═══════════════════════════════════════════════════════════════ */}
          <TabsContent value="saved">
            {savedCatalogs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-stone-300 py-24 text-center">
                <Layers className="w-12 h-12 text-stone-300 mx-auto mb-3" />
                <p className="text-stone-500 font-medium mb-1">No saved catalogs yet</p>
                <p className="text-stone-400 text-sm mb-4">Create and save your first catalog.</p>
                <Button onClick={() => setActiveTab("select")}>
                  <Plus className="w-4 h-4 mr-1" /> New Catalog
                </Button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {savedCatalogs.map((cat) => (
                  <div
                    key={cat.id}
                    className="bg-white rounded-xl border border-stone-200 p-5 hover:border-stone-400 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-stone-900 leading-tight">{cat.name}</h3>
                      <Badge variant="secondary" className="text-xs flex-shrink-0 bg-stone-100 text-stone-500">
                        {cat.layout}×/page
                      </Badge>
                    </div>
                    {cat.description && (
                      <p className="text-sm text-stone-500 mb-2">{cat.description}</p>
                    )}
                    <p className="text-xs text-stone-400 mb-4">
                      Created {fmtDate(cat.created_at)}
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" variant="outline" onClick={() => handleOpenSavedCatalog(cat)}>
                        <Eye className="w-3.5 h-3.5 mr-1" /> Open
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDuplicateCatalog(cat)}>
                        <Copy className="w-3.5 h-3.5 mr-1" /> Duplicate
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => setShowDeleteDialog(cat.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* ── Config Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Catalog Configuration</DialogTitle>
            <DialogDescription>Set your catalog title and layout before previewing.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm font-medium">Catalog Name *</Label>
              <Input
                value={config.name}
                onChange={(e) => setConfig((c) => ({ ...c, name: e.target.value }))}
                placeholder="October 2026 Furniture Collection"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Cover Title</Label>
              <Input
                value={config.coverTitle}
                onChange={(e) => setConfig((c) => ({ ...c, coverTitle: e.target.value }))}
                placeholder="FURNITURE COLLECTION"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Cover Subtitle</Label>
              <Input
                value={config.coverSubtitle}
                onChange={(e) => setConfig((c) => ({ ...c, coverSubtitle: e.target.value }))}
                placeholder="2026"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">Products per page</Label>
              <div className="flex gap-2 mt-1.5">
                {(["1", "2", "4"] as CatalogConfig["layout"][]).map((l) => (
                  <Button
                    key={l}
                    variant={config.layout === l ? "default" : "outline"}
                    size="sm"
                    onClick={() => setConfig((c) => ({ ...c, layout: l }))}
                    className="flex-1"
                  >
                    {l} / page
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfigDialog(false)}>Cancel</Button>
            <Button
              onClick={handleGoToPreview}
              disabled={!config.name.trim()}
            >
              <Eye className="w-4 h-4 mr-1.5" /> Preview Catalog
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Save Dialog ────────────────────────────────────────────────────── */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Save Catalog</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <div>
              <Label className="text-sm font-medium">Catalog Name *</Label>
              <Input
                value={config.name}
                onChange={(e) => setConfig((c) => ({ ...c, name: e.target.value }))}
                placeholder="My Catalog"
                className="mt-1.5"
              />
            </div>
            <p className="text-xs text-stone-500">
              {selectedProducts.length} products will be saved with this catalog.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving || !config.name.trim()}>
              {isSaving ? <Loader className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ─────────────────────────────────────────────────── */}
      <AlertDialog open={!!showDeleteDialog} onOpenChange={() => setShowDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Catalog?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the catalog only. Your products will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => showDeleteDialog && handleDeleteCatalog(showDeleteDialog)}
            >
              Delete Catalog
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Catalog;
