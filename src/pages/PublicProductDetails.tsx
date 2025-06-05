
import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ImageIcon, Loader, Package, ExternalLink } from "lucide-react";
import { Product } from "@/components/ProductCard";
import { toast } from "sonner";
import { getPublicProductByCode } from "@/services/publicProductService";

const PublicProductDetails: React.FC = () => {
  const [searchParams] = useSearchParams();
  const productCode = searchParams.get("code");
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProductDetails = async () => {
      if (!productCode) {
        setIsLoading(false);
        return;
      }

      console.log("Fetching public product with code:", productCode);
      
      try {
        const productData = await getPublicProductByCode(productCode);
        
        if (productData) {
          console.log("Product data retrieved:", productData);
          setProduct(productData);
        } else {
          console.log("No product found with code:", productCode);
          toast.error("Product not found");
        }
      } catch (error) {
        console.error("Error fetching product:", error);
        toast.error("Failed to load product details");
      } finally {
        setIsLoading(false);
      }
    };

    fetchProductDetails();
  }, [productCode]);

  // Format dimensions for display in the standardized format "length × width × height"
  const getDimensionsDisplay = () => {
    if (!product) return "N/A";
    
    if (product.length && product.width && product.height) {
      return `${product.length} × ${product.width} × ${product.height}`;
    } else if (product.dimensions) {
      return product.dimensions;
    }
    return "N/A";
  };

  const handleBackButton = () => {
    // Check if we have history to go back to
    if (window.history.length > 1) {
      window.history.back();
    } else {
      // If no history, go to the main site
      window.location.href = "/";
    }
  };

  const handleViewMoreProducts = () => {
    // Redirect to the main application
    window.location.href = "/";
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background">
        <div className="text-center">
          <Loader className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading product details...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 mb-4">
          <Package className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Product Not Found</h1>
        <p className="text-muted-foreground text-center mb-6 max-w-md">
          The product you're looking for cannot be found. It may have been removed or the QR code is invalid.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleBackButton}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
          <Button onClick={handleViewMoreProducts}>
            <ExternalLink className="mr-2 h-4 w-4" />
            View More Products
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Card className="overflow-hidden">
          <CardHeader className="p-6 pb-3">
            <CardTitle className="text-2xl">Product Details</CardTitle>
            <p className="text-sm text-muted-foreground">
              Scanned product information
            </p>
          </CardHeader>
          
          <CardContent className="p-6">
            <div className="mb-6">
              {product.imageUrl ? (
                <AspectRatio ratio={4/3} className="bg-secondary rounded-md overflow-hidden">
                  <img
                    src={product.imageUrl}
                    alt={product.product_code}
                    className="object-cover w-full h-full"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/placeholder.svg";
                    }}
                  />
                </AspectRatio>
              ) : (
                <div className="flex items-center justify-center bg-secondary rounded-md h-[300px]">
                  <ImageIcon className="h-16 w-16 text-muted-foreground" />
                </div>
              )}
            </div>
            
            <Separator className="my-6" />
            
            <div className="grid grid-cols-2 gap-y-4 text-sm">
              <div className="font-medium">Product Code:</div>
              <div className="font-mono">{product.product_code}</div>
              
              <div className="font-medium">Serial Number:</div>
              <div>{product.sno}</div>
              
              <div className="font-medium">Dimensions:</div>
              <div>{getDimensionsDisplay()}</div>
              
              <div className="font-medium">Price:</div>
              <div className="text-lg font-semibold text-primary">${product.price.toFixed(2)}</div>
              
              <div className="font-medium">CBM:</div>
              <div>{product.cbm}</div>
              
              <div className="font-medium col-span-2 mt-4">Description:</div>
              <div className="col-span-2 text-muted-foreground">
                {product.description || "No description available."}
              </div>
            </div>
            
            <div className="mt-8 flex flex-col sm:flex-row gap-2">
              <Button 
                variant="outline" 
                onClick={handleBackButton}
                className="flex-1"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button 
                onClick={handleViewMoreProducts}
                className="flex-1"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                View More Products
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PublicProductDetails;
