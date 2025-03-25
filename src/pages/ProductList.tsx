
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Search, QrCode, Download, Upload, Plus } from "lucide-react";
import ProductCard, { Product } from "@/components/ProductCard";
import { getProducts, searchProducts, getProductImage } from "@/services/productService";
import { downloadQRCode, downloadAllQRCodes } from "@/services/qrService";

const ProductList: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, navigate]);

  // Load products
  useEffect(() => {
    if (isAuthenticated) {
      loadProducts();
    }
  }, [isAuthenticated]);

  const loadProducts = () => {
    setIsLoading(true);
    try {
      // Get products from localStorage
      const loadedProducts = getProducts();
      
      // Enhance products with image URLs if available
      const enhancedProducts = loadedProducts.map(product => ({
        ...product,
        imageUrl: getProductImage(product.product_code)
      }));
      
      setProducts(enhancedProducts);
    } catch (error) {
      console.error('Error loading products:', error);
      toast.error('Failed to load products');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleDownloadQR = async (product: Product) => {
    try {
      await downloadQRCode(product);
      toast.success(`QR code for ${product.product_code} downloaded`);
    } catch (error) {
      toast.error('Failed to download QR code');
    }
  };

  const handleDownloadAllQRs = async () => {
    if (products.length === 0) {
      toast.error('No products available');
      return;
    }

    try {
      setIsLoading(true);
      await downloadAllQRCodes(products);
      toast.success('All QR codes downloaded as ZIP');
    } catch (error) {
      toast.error('Failed to download QR codes');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter products based on search query
  const filteredProducts = searchQuery 
    ? searchProducts(products, searchQuery)
    : products;

  if (!isAuthenticated) {
    return null; // Don't render anything while redirecting
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow container px-4 py-8">
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Products</h1>
              <p className="text-muted-foreground mt-1">
                {products.length} products in your inventory
              </p>
            </div>
            <div className="flex gap-2 self-stretch sm:self-auto">
              <Button
                variant="outline"
                onClick={handleDownloadAllQRs}
                disabled={products.length === 0 || isLoading}
              >
                <Download className="mr-2 h-4 w-4" />
                All QRs
              </Button>
              <Button onClick={() => navigate("/import")}>
                <Upload className="mr-2 h-4 w-4" />
                Import
              </Button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by product code or description..."
              value={searchQuery}
              onChange={handleSearch}
              className="pl-10"
            />
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="loader"></div>
            </div>
          ) : filteredProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onDownloadQR={handleDownloadQR}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              {searchQuery ? (
                <div className="space-y-4">
                  <p className="text-muted-foreground text-lg">No products match your search</p>
                  <Button variant="outline" onClick={() => setSearchQuery("")}>
                    Clear Search
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                    <QrCode className="h-10 w-10 text-primary" />
                  </div>
                  <h3 className="text-2xl font-semibold">No products found</h3>
                  <p className="text-muted-foreground">
                    Import products to get started with your inventory
                  </p>
                  <Button onClick={() => navigate("/import")}>
                    <Plus className="mr-2 h-4 w-4" />
                    Import Products
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
