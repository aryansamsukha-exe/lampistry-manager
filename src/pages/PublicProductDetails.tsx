import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ImageIcon, Loader, Package } from "lucide-react";
import { Product } from "@/components/ProductCard";
import { toast } from "sonner";
import { getPublicProductByCode } from "@/services/publicProductService";

const PublicProductDetails: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
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
    // Just go back to the previous page if possible instead of redirecting to root
    if (window.history.length > 1) {
      window.history.back();
    } else {
      // If no history, go to homepage
      window.location.href = "/";
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 mb-4">
          <Package className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Product Not Found</h1>
        <p className="text-muted-foreground text-center mb-6">
          The product you're looking for cannot be found or has been removed.
        </p>
        <Button variant="outline" onClick={() => window.history.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Card className="overflow-hidden">
        <CardHeader className="p-6 pb-3">
          <CardTitle className="text-2xl">Product Details</CardTitle>
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
            <div>{product.product_code}</div>
            
            <div className="font-medium">Serial Number:</div>
            <div>{product.sno}</div>
            
            <div className="font-medium">Dimensions:</div>
            <div>{getDimensionsDisplay()}</div>
            
            <div className="font-medium">Price:</div>
            <div>${product.price.toFixed(2)}</div>
            
            <div className="font-medium">CBM:</div>
            <div>{product.cbm}</div>
            
            <div className="font-medium col-span-2 mt-4">Description:</div>
            <div className="col-span-2">{product.description || "No description available."}</div>
          </div>
          
          <div className="mt-8 flex justify-center">
            <Button 
              variant="outline" 
              onClick={handleBackButton}
              className="w-full md:w-auto"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PublicProductDetails;
