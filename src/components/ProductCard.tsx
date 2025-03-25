
import React, { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QrCode, Download, ImageIcon, Info, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import FileUploader from "@/components/FileUploader";
import { saveProductImage } from "@/services/productService";
import { toast } from "sonner";

export type Product = {
  id: string;
  sno: number;
  product_code: string;
  dimensions: string;
  breadth?: string;  // Added breadth field
  height?: string;   // Added height field
  price: number;
  cbm: string;
  description: string;
  imageUrl?: string;
};

interface ProductCardProps {
  product: Product;
  onDownloadQR: (product: Product) => void;
  onImageUpdate?: () => void; // Callback to refresh product list after image update
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onDownloadQR, onImageUpdate }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [showImageUpload, setShowImageUpload] = useState(false);
  
  const productImage = product.imageUrl || "/placeholder.svg";
  
  const handleImageUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        const imageDataUrl = e.target.result.toString();
        saveProductImage(product.product_code, imageDataUrl);
        toast.success("Image uploaded successfully");
        setShowImageUpload(false);
        if (onImageUpdate) {
          onImageUpdate();
        }
      }
    };
    reader.onerror = () => {
      toast.error("Failed to read image file");
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
      <Card className="overflow-hidden transition-all hover:shadow-md">
        <CardHeader className="p-0 relative">
          <div className="image-container w-full">
            <AspectRatio ratio={4/3} className="bg-secondary">
              <img
                src={productImage}
                alt={product.product_code}
                className="object-cover w-full h-full"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/placeholder.svg";
                }}
              />
            </AspectRatio>
            <Button 
              variant="ghost" 
              size="icon"
              className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm hover:bg-background/90"
              onClick={() => setShowImageUpload(true)}
            >
              <Upload className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <CardTitle className="text-lg font-medium mb-2">{product.product_code}</CardTitle>
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm text-muted-foreground">
              {product.dimensions}
            </span>
            <span className="font-medium">${product.price.toFixed(2)}</span>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {product.description || "No description available."}
          </p>
        </CardContent>
        <CardFooter className="flex justify-between p-4 pt-0">
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => setShowDetails(true)}
          >
            <Info className="h-4 w-4" />
            Details
          </Button>
          <Button
            variant="default"
            size="sm"
            className="gap-1"
            onClick={() => onDownloadQR(product)}
          >
            <QrCode className="h-4 w-4" />
            QR Code
          </Button>
        </CardFooter>
      </Card>

      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-xl">Product Details</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="mx-auto w-full max-w-[200px]">
              {product.imageUrl ? (
                <AspectRatio ratio={1/1} className="bg-secondary rounded-md overflow-hidden">
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
                <div className="flex items-center justify-center bg-secondary rounded-md h-[200px]">
                  <ImageIcon className="h-12 w-12 text-muted-foreground" />
                </div>
              )}
            </div>
            
            <Separator />
            
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="font-medium">Product Code:</div>
              <div>{product.product_code}</div>
              
              <div className="font-medium">Serial Number:</div>
              <div>{product.sno}</div>
              
              <div className="font-medium">Dimensions:</div>
              <div>{product.dimensions}</div>
              
              {product.breadth && (
                <>
                  <div className="font-medium">Breadth:</div>
                  <div>{product.breadth}</div>
                </>
              )}
              
              {product.height && (
                <>
                  <div className="font-medium">Height:</div>
                  <div>{product.height}</div>
                </>
              )}
              
              <div className="font-medium">Price:</div>
              <div>${product.price.toFixed(2)}</div>
              
              <div className="font-medium">CBM:</div>
              <div>{product.cbm}</div>
              
              <div className="font-medium col-span-2">Description:</div>
              <div className="col-span-2">{product.description || "No description available."}</div>
            </div>
            
            <Separator />
            
            <Button
              className="w-full flex items-center justify-center gap-2"
              onClick={() => onDownloadQR(product)}
            >
              <Download className="h-4 w-4" />
              Download QR Code
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showImageUpload} onOpenChange={setShowImageUpload}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Upload Product Image</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <FileUploader
              onFileSelect={handleImageUpload}
              accept="image/*"
              label={`Upload image for ${product.product_code}`}
              maxSize={5} // 5MB max
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ProductCard;
