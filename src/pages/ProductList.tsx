import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import {
  Search, QrCode, Download, Upload, Plus, Loader, ScanLine, BookOpen, Filter,
} from "lucide-react";
import ProductCard, { Product } from "@/components/ProductCard";
import { getProducts, searchProducts, getProductByCode } from "@/services/productService";
import { downloadQRCode, downloadAllQRCodes } from "@/services/qrService";
import { getImportBatches, type ImportBatch } from "@/services/importBatchService";

const ProductList: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [batchFilter, setBatchFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(false);
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

  const filteredProducts = useMemo(() => {
    let list =
      batchFilter === "all"
        ? products
        : batchFilter === "no-batch"
        ? products.filter((p) => !p.import_batch_id)
        : products.filter((p) => p.import_batch_id === batchFilter);

    if (searchQuery) list = searchProducts(list, searchQuery);
    return list;
  }, [products, batchFilter, searchQuery]);

  // batch name lookup
  const batchName = (id?: string | null) => {
    if (!id) return null;
    return batches.find((b) => b.id === id)?.batch_name ?? null;
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
              <h1 className="text-3xl font-bold tracking-tight">Products</h1>
              <p className="text-muted-foreground mt-1">
                {products.length} products in your inventory
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={() => navigate("/catalog")}>
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

          {/* filters */}
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by product code or description…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="w-full sm:w-64">
              <Label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1">
                <Filter className="w-3 h-3" /> Filter by batch
              </Label>
              <Select value={batchFilter} onValueChange={setBatchFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products ({products.length})</SelectItem>
                  {batches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.batch_name} ({b.product_count})
                    </SelectItem>
                  ))}
                  <SelectItem value="no-batch">No batch (legacy)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* results count */}
          {(searchQuery || batchFilter !== "all") && (
            <p className="text-sm text-muted-foreground">
              Showing {filteredProducts.length} of {products.length} products
            </p>
          )}

          {/* product grid */}
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredProducts.map((product) => (
                <div key={`${product.product_code}-${product.id}`} className="space-y-1">
                  <ProductCard
                    product={product}
                    onDownloadQR={handleDownloadQR}
                    onImageUpdate={loadData}
                    onProductDelete={loadData}
                  />
                  {/* batch badge below card */}
                  {batchName(product.import_batch_id) && (
                    <Badge variant="secondary" className="text-[10px] font-normal w-full justify-center py-0.5 truncate">
                      {batchName(product.import_batch_id)}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              {searchQuery || batchFilter !== "all" ? (
                <div className="space-y-4">
                  <p className="text-muted-foreground text-lg">No products match your filter</p>
                  <div className="flex gap-2 justify-center">
                    {searchQuery && (
                      <Button variant="outline" onClick={() => setSearchQuery("")}>Clear Search</Button>
                    )}
                    {batchFilter !== "all" && (
                      <Button variant="outline" onClick={() => setBatchFilter("all")}>Clear Batch Filter</Button>
                    )}
                  </div>
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
