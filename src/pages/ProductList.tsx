import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import {
  Search, QrCode, Download, Upload, Plus, Loader, ScanLine, BookOpen, Folder, ChevronLeft, ChevronRight, ImageIcon, Zap,
} from "lucide-react";
import {
  isInlineImage, migrateInlineImagesToStorage, type MigrationProgress,
} from "@/services/imageStorageService";
import ProductCard, { Product } from "@/components/ProductCard";
import { getProducts, searchProducts, getProductByCode } from "@/services/productService";
import { downloadQRCode, downloadAllQRCodes } from "@/services/qrService";
import {
  getImportBatches, getSavedBatchFilter, saveBatchFilter, type ImportBatch,
} from "@/services/importBatchService";

const NO_BATCH = "no-batch";
const ROOT = "all";

type ProductFolder = {
  id: string;
  name: string;
  subtitle: string;
  products: Product[];
};

const FolderCard: React.FC<{ folder: ProductFolder; onOpen: () => void }> = ({ folder, onOpen }) => {
  const previews = folder.products.filter((p) => p.imageUrl).slice(0, 4);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group text-left rounded-xl border bg-card shadow-sm hover:shadow-md hover:border-primary/40 transition overflow-hidden"
    >
      <div className="grid grid-cols-2 grid-rows-2 gap-0.5 aspect-[4/3] bg-muted">
        {previews.length > 0 ? (
          Array.from({ length: 4 }).map((_, i) =>
            previews[i] ? (
              <img
                key={previews[i].id}
                src={previews[i].imageUrl}
                alt={previews[i].product_code}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              <div key={i} className="flex items-center justify-center bg-muted">
                <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
              </div>
            )
          )
        ) : (
          <div className="col-span-2 row-span-2 flex items-center justify-center">
            <Folder className="h-16 w-16 text-primary/40" />
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Folder className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold truncate">{folder.name}</p>
          <p className="text-sm text-muted-foreground truncate">
            {folder.products.length} products · {folder.subtitle}
          </p>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition" />
      </div>
    </button>
  );
};

const ProductList: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [openFolder, setOpenFolder] = useState<string>(getSavedBatchFilter);
  const [isLoading, setIsLoading] = useState(false);
  const [migration, setMigration] = useState<MigrationProgress | null>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, loadingSession } = useAuth();

  useEffect(() => {
    const searchFromUrl = searchParams.get("search");
    if (searchFromUrl) setSearchQuery(searchFromUrl);
  }, [searchParams]);

  useEffect(() => {
    if (!loadingSession && isAuthenticated) loadData();
  }, [isAuthenticated, loadingSession]);

  useEffect(() => {
    if (!loadingSession && !isAuthenticated) navigate("/login");
  }, [isAuthenticated, navigate, loadingSession]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [loadedProducts, batchList] = await Promise.all([
        getProducts(),
        getImportBatches(),
      ]);
      setProducts(loadedProducts);
      setBatches(batchList);
      setOpenFolder((current) =>
        current === ROOT || current === NO_BATCH || batchList.some((b) => b.id === current)
          ? current
          : ROOT
      );

      const searchFromUrl = searchParams.get("search");
      if (searchFromUrl) {
        const found = await getProductByCode(searchFromUrl);
        if (found) toast.success(`Found product: ${found.product_code}`);
      }
    } catch {
      toast.error("Failed to load products");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    saveBatchFilter(openFolder);
  }, [openFolder]);

  const handleDownloadQR = async (product: Product) => {
    try {
      await downloadQRCode(product);
      toast.success(`QR code for ${product.product_code} downloaded`);
    } catch {
      toast.error("Failed to download QR code");
    }
  };

  const handleDownloadAllQRs = async () => {
    if (products.length === 0) { toast.error("No products available"); return; }
    try {
      setIsLoading(true);
      await downloadAllQRCodes(products);
      toast.success("All QR codes downloaded as ZIP");
    } catch {
      toast.error("Failed to download QR codes");
    } finally {
      setIsLoading(false);
    }
  };

  const folders = useMemo<ProductFolder[]>(() => {
    const formatDate = (iso: string) =>
      new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));

    const list: ProductFolder[] = batches.map((b) => ({
      id: b.id,
      name: b.batch_name,
      subtitle: `Imported ${formatDate(b.created_at)}`,
      products: products.filter((p) => p.import_batch_id === b.id),
    }));

    const unbatched = products.filter((p) => !p.import_batch_id);
    if (unbatched.length > 0) {
      list.push({ id: NO_BATCH, name: "Older products", subtitle: "Before batches", products: unbatched });
    }
    return list;
  }, [products, batches]);

  const currentFolder = folders.find((f) => f.id === openFolder);
  const isRoot = !currentFolder;
  const showFolders = isRoot && !searchQuery;

  const visibleProducts = useMemo(() => {
    const list = currentFolder ? currentFolder.products : products;
    return searchQuery ? searchProducts(list, searchQuery) : list;
  }, [currentFolder, products, searchQuery]);

  const batchName = (id?: string | null) => {
    if (!id) return null;
    return batches.find((b) => b.id === id)?.batch_name ?? null;
  };

  const inlineImageCount = useMemo(() => products.filter((p) => isInlineImage(p.imageUrl)).length, [products]);

  const handleMoveImages = async () => {
    setMigration({ done: 0, total: 0, moved: 0, failed: 0 });
    try {
      const result = await migrateInlineImagesToStorage(setMigration);
      if (result.failed > 0) {
        toast.warning(`Moved ${result.moved} photos. ${result.failed} could not be moved; try again.`);
      } else {
        toast.success(`Moved ${result.moved} photos. Pages will now load much faster.`);
      }
      await loadData();
    } catch (error) {
      console.error("Error moving photos:", error);
      toast.error("Could not move photos. Make sure supabase/product-image-storage.sql has been run.");
    } finally {
      setMigration(null);
    }
  };

  const goToRoot = () => {
    setOpenFolder(ROOT);
    setSearchQuery("");
  };

  if (loadingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow container px-4 py-8">
        <div className="space-y-6">
          {/* header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              {currentFolder && (
                <button
                  type="button"
                  onClick={goToRoot}
                  className="mb-1 flex items-center text-sm text-muted-foreground hover:text-primary"
                >
                  <ChevronLeft className="h-4 w-4" /> All folders
                </button>
              )}
              <h1 className="text-3xl font-bold tracking-tight">
                {currentFolder ? currentFolder.name : "Products"}
              </h1>
              <p className="text-muted-foreground mt-1">
                {currentFolder
                  ? `${currentFolder.products.length} products in this folder`
                  : `${products.length} products in ${folders.length} ${folders.length === 1 ? "folder" : "folders"}`}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                onClick={() =>
                  navigate(currentFolder && currentFolder.id !== NO_BATCH ? `/catalog?batch=${currentFolder.id}` : "/catalog")
                }
              >
                <BookOpen className="mr-2 h-4 w-4" /> Create Catalog
              </Button>
              <Button variant="outline" onClick={() => navigate("/scan")}>
                <ScanLine className="mr-2 h-4 w-4" /> Scan QR
              </Button>
              <Button variant="outline" onClick={handleDownloadAllQRs} disabled={products.length === 0 || isLoading}>
                <Download className="mr-2 h-4 w-4" /> All QRs
              </Button>
              <Button onClick={() => navigate("/import")}>
                <Upload className="mr-2 h-4 w-4" /> Import
              </Button>
            </div>
          </div>

          {(inlineImageCount > 0 || migration) && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
              <div>
                <p className="font-medium text-amber-900">
                  {migration
                    ? `Moving photos to fast storage… ${migration.done} of ${migration.total || "?"}`
                    : `${inlineImageCount} photos are stored in a slow format`}
                </p>
                <p className="text-amber-800">
                  {migration
                    ? "Keep this page open until it finishes."
                    : "They make this page load slowly. Move them once to fast storage; nothing else changes."}
                </p>
              </div>
              <Button onClick={handleMoveImages} disabled={!!migration} className="shrink-0">
                {migration ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
                {migration ? "Moving…" : "Speed up photos"}
              </Button>
            </div>
          )}

          {/* search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={
                currentFolder
                  ? `Search in ${currentFolder.name}…`
                  : "Search all products by code or description…"
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {searchQuery && (
            <p className="text-sm text-muted-foreground">
              {visibleProducts.length} {visibleProducts.length === 1 ? "match" : "matches"}
              {currentFolder ? ` in ${currentFolder.name}` : " across all folders"}
            </p>
          )}

          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : showFolders && folders.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {folders.map((folder) => (
                <FolderCard key={folder.id} folder={folder} onOpen={() => setOpenFolder(folder.id)} />
              ))}
            </div>
          ) : visibleProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {visibleProducts.map((product) => (
                <div key={`${product.product_code}-${product.id}`} className="space-y-1">
                  <ProductCard
                    product={product}
                    onDownloadQR={handleDownloadQR}
                    onImageUpdate={loadData}
                    onProductDelete={loadData}
                    onProductUpdate={(updated) =>
                      setProducts((list) => list.map((p) => (p.id === updated.id ? updated : p)))
                    }
                  />
                  {isRoot && batchName(product.import_batch_id) && (
                    <Badge variant="secondary" className="text-[10px] font-normal w-full justify-center py-0.5 truncate">
                      {batchName(product.import_batch_id)}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              {searchQuery ? (
                <div className="space-y-4">
                  <p className="text-muted-foreground text-lg">No products match your search</p>
                  <Button variant="outline" onClick={() => setSearchQuery("")}>Clear Search</Button>
                </div>
              ) : currentFolder ? (
                <div className="space-y-4">
                  <p className="text-muted-foreground text-lg">This folder is empty</p>
                  <Button variant="outline" onClick={goToRoot}>Back to all folders</Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                    <QrCode className="h-10 w-10 text-primary" />
                  </div>
                  <h3 className="text-2xl font-semibold">No products found</h3>
                  <p className="text-muted-foreground">Import products to get started with your inventory</p>
                  <Button onClick={() => navigate("/import")}>
                    <Plus className="mr-2 h-4 w-4" /> Import Products
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ProductList;
