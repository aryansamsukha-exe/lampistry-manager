
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { QrCode, Download, Package, Loader } from "lucide-react";
import { getProducts, getProductImage } from "@/services/productService";
import { createQRWithText, downloadQRCode, downloadAllQRCodes } from "@/services/qrService";
import { Product } from "@/components/ProductCard";
import { AspectRatio } from "@/components/ui/aspect-ratio";

const QRCodes: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [qrCodes, setQRCodes] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, navigate]);

  // Load products and generate QR codes
  useEffect(() => {
    if (isAuthenticated) {
      loadProductsAndGenerateQRs();
    }
  }, [isAuthenticated]);

  const loadProductsAndGenerateQRs = async () => {
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

      // Generate QR codes for all products
      const qrCodesMap = new Map<string, string>();
      await Promise.all(
        enhancedProducts.map(async (product) => {
          try {
            const qrDataUrl = await createQRWithText(product);
            qrCodesMap.set(product.id, qrDataUrl);
          } catch (error) {
            console.error(`Error generating QR code for ${product.product_code}:`, error);
          }
        })
      );
      
      setQRCodes(qrCodesMap);
    } catch (error) {
      console.error('Error loading products:', error);
      toast.error('Failed to load products');
    } finally {
      setIsLoading(false);
    }
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
      setIsDownloading(true);
      await downloadAllQRCodes(products);
      toast.success('All QR codes downloaded as ZIP');
    } catch (error) {
      toast.error('Failed to download QR codes');
    } finally {
      setIsDownloading(false);
    }
  };

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
              <h1 className="text-3xl font-bold tracking-tight">QR Codes</h1>
              <p className="text-muted-foreground mt-1">
                Generate and download QR codes for your products
              </p>
            </div>
            <Button
              onClick={handleDownloadAllQRs}
              disabled={products.length === 0 || isDownloading}
            >
              {isDownloading ? (
                <>
                  <Loader className="mr-2 h-4 w-4 animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Download All QR Codes
                </>
              )}
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="loader"></div>
            </div>
          ) : products.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {products.map((product) => (
                <Card key={product.product_code}>
                  <CardHeader>
                    <CardTitle className="text-lg">{product.product_code}</CardTitle>
                    <CardDescription>
                      {product.dimensions}
                      {product.breadth && product.height && ` | ${product.breadth}×${product.height}`}
                      {' | '}${product.price.toFixed(2)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex justify-center">
                    <div className="w-48 bg-white p-2 rounded-md shadow-sm">
                      {qrCodes.has(product.id) ? (
                        <AspectRatio ratio={1}>
                          <img
                            src={qrCodes.get(product.id)}
                            alt={`QR code for ${product.product_code}`}
                            className="w-full h-full"
                          />
                        </AspectRatio>
                      ) : (
                        <div className="flex justify-center items-center h-full">
                          <div className="loader"></div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/products?search=${product.product_code}`)}
                    >
                      <Package className="mr-2 h-4 w-4" />
                      View Product
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleDownloadQR(product)}
                      disabled={!qrCodes.has(product.id)}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                <QrCode className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-2xl font-semibold mt-4">No products found</h3>
              <p className="text-muted-foreground mt-2">
                Import products to generate QR codes
              </p>
              <Button className="mt-4" onClick={() => navigate("/import")}>
                Import Products
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default QRCodes;
