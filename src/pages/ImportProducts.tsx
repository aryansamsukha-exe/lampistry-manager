
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Loader, FilePlus2, FileUp, PackageCheck } from "lucide-react";
import FileUploader from "@/components/FileUploader";
import { processExcelFile, getProducts, saveProducts } from "@/services/productService";
import { Product } from "@/components/ProductCard";

const ImportProducts: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  // Redirect if not authenticated
  React.useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, navigate]);

  const handleExcelSelect = (file: File) => {
    setExcelFile(file);
  };

  const handleZipSelect = (file: File) => {
    setZipFile(file);
  };

  const handleImport = async () => {
    if (!excelFile) {
      toast.error("Please select an Excel file to import");
      return;
    }

    setIsLoading(true);
    try {
      // Process Excel file
      const importedProducts = await processExcelFile(excelFile);
      
      if (importedProducts.length === 0) {
        toast.error("No products found in the Excel file");
        return;
      }

      // Get existing products (if any)
      const existingProducts = getProducts();
      
      // Create a map of existing products by product_code for easy lookup
      const existingProductMap = new Map<string, Product>();
      existingProducts.forEach(product => {
        existingProductMap.set(product.product_code, product);
      });
      
      // Merge or add new products
      const mergedProducts = importedProducts.map(newProduct => {
        const existingProduct = existingProductMap.get(newProduct.product_code);
        return existingProduct 
          ? { ...existingProduct, ...newProduct, id: existingProduct.id }
          : newProduct;
      });
      
      // Save the merged products
      saveProducts(mergedProducts);
      
      // Handle ZIP file with images if provided
      // In a real app, you would process the ZIP file to extract images
      // and associate them with products
      if (zipFile) {
        // This is a placeholder for the actual ZIP processing
        toast.info("Processing image ZIP file...");
        
        // In a real implementation, you would process the ZIP file
        // For now, we just simulate a delay
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      toast.success(`Successfully imported ${mergedProducts.length} products`);
      navigate("/products");
    } catch (error) {
      console.error('Import error:', error);
      toast.error(error instanceof Error ? error.message : "Failed to import products");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthenticated) {
    return null; // Don't render anything while redirecting
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow container px-4 py-8 max-w-5xl mx-auto">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Import Products</h1>
            <p className="text-muted-foreground mt-2">
              Import your product data from Excel and upload product images.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FilePlus2 className="h-5 w-5" />
                  Excel Data Import
                </CardTitle>
                <CardDescription>
                  Upload an Excel file with your product data.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FileUploader
                  onFileSelect={handleExcelSelect}
                  accept=".xlsx,.xls"
                  label="Upload Excel File"
                />
              </CardContent>
              <CardFooter className="flex flex-col space-y-2">
                <p className="text-xs text-muted-foreground w-full">
                  The Excel file should contain columns: Sno, product_code, dimensions, price, cbm, description
                </p>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileUp className="h-5 w-5" />
                  Product Images (Optional)
                </CardTitle>
                <CardDescription>
                  Upload a ZIP file containing your product images.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FileUploader
                  onFileSelect={handleZipSelect}
                  accept=".zip"
                  label="Upload ZIP File"
                />
              </CardContent>
              <CardFooter>
                <p className="text-xs text-muted-foreground">
                  Image files should be named with the corresponding product_code.
                </p>
              </CardFooter>
            </Card>
          </div>

          <div className="flex justify-end gap-4">
            <Button
              variant="outline"
              onClick={() => navigate("/products")}
            >
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={isLoading || !excelFile}
              className="min-w-[120px]"
            >
              {isLoading ? (
                <>
                  <Loader className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <PackageCheck className="mr-2 h-4 w-4" />
                  Import Products
                </>
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ImportProducts;
