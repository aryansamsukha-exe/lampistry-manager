
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader, ArrowLeft, ScanLine, Package, DollarSign, Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";
import QRScanner from "@/components/QRScanner";

// Type for product details extracted from QR code
interface ProductDetails {
  code: string;
  price: number;
  dimensions: string;
  description: string;
}

const ScanQRCode: React.FC = () => {
  const [processing, setProcessing] = useState(false);
  const [productDetails, setProductDetails] = useState<ProductDetails | null>(null);
  const navigate = useNavigate();

  const handleScanSuccess = (decodedText: string) => {
    console.log("Successfully scanned QR code:", decodedText);
    setProcessing(true);
    
    try {
      // Try to parse the QR content as JSON (new format with embedded details)
      try {
        const parsedDetails = JSON.parse(decodedText);
        console.log("Parsed product details:", parsedDetails);
        
        // Validate that this is a product details object
        if (parsedDetails && parsedDetails.code) {
          console.log("Found valid product details in QR code");
          setProductDetails(parsedDetails);
          toast.success("QR code scanned successfully!");
        } else {
          // If not a valid product details object, try legacy URL format
          handleLegacyQRCode(decodedText);
        }
      } catch (error) {
        // Not valid JSON, try legacy URL format
        console.log("Not valid JSON, trying legacy URL format");
        handleLegacyQRCode(decodedText);
      }
    } catch (error) {
      console.error("Error processing QR code:", error);
      toast.error("Error processing QR code. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const handleLegacyQRCode = (decodedText: string) => {
    // Handle the old URL format QR codes for backward compatibility
    let productCode: string | null = null;
    
    try {
      const url = new URL(decodedText);
      console.log("Parsed URL:", url.toString());
      
      if (url.searchParams.has('code')) {
        productCode = url.searchParams.get('code');
        console.log("Found product code in URL parameter:", productCode);
      } else {
        // Try to extract code from pathname
        const pathParts = url.pathname.split('/');
        const lastPart = pathParts[pathParts.length - 1];
        if (lastPart && /^[A-Za-z0-9-]+$/.test(lastPart)) {
          productCode = lastPart;
          console.log("Extracted product code from pathname:", productCode);
        }
      }
    } catch (error) {
      console.log("Not a URL, checking if direct product code:", decodedText);
      // Not a URL, check if it's a direct product code
      if (decodedText.trim() !== '' && /^[A-Za-z0-9-]+$/.test(decodedText.trim())) {
        productCode = decodedText.trim();
        console.log("Using direct product code:", productCode);
      }
    }
    
    if (productCode) {
      console.log("Navigating to product with code:", productCode);
      // Redirect to public product page for legacy QR codes
      const publicProductUrl = `/public/product?code=${encodeURIComponent(productCode)}`;
      console.log("Public product URL:", publicProductUrl);
      navigate(publicProductUrl);
      toast.success("QR code scanned successfully!");
    } else {
      console.error("Invalid QR code content:", decodedText);
      toast.error("Invalid QR code. Please scan a valid product QR code.");
    }
  };

  const handleBackToScan = () => {
    setProductDetails(null);
  };

  if (processing) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <Loader className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Processing QR code...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow container px-4 py-8 max-w-md mx-auto">
        <div className="space-y-6">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate(-1)}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          {productDetails ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-xl">
                  <Package className="mr-2 h-5 w-5" />
                  Product Details
                </CardTitle>
                <CardDescription>
                  Scanned from QR code
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3">
                  <div className="flex items-start">
                    <div className="mr-2 h-5 w-5 text-muted-foreground">
                      <Package className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">Product Code</p>
                      <p className="text-muted-foreground">{productDetails.code}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <div className="mr-2 h-5 w-5 text-muted-foreground">
                      <DollarSign className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">Price</p>
                      <p className="text-muted-foreground">
                        ${typeof productDetails.price === 'number' ? 
                          productDetails.price.toFixed(2) : 
                          productDetails.price}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <div className="mr-2 h-5 w-5 text-muted-foreground">
                      <Ruler className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">Dimensions</p>
                      <p className="text-muted-foreground">{productDetails.dimensions}</p>
                    </div>
                  </div>
                  
                  {productDetails.description && (
                    <div className="flex items-start pt-2 border-t">
                      <div>
                        <p className="font-medium">Description</p>
                        <p className="text-muted-foreground">{productDetails.description}</p>
                      </div>
                    </div>
                  )}
                </div>
                
                <Button 
                  variant="outline" 
                  className="w-full mt-4" 
                  onClick={handleBackToScan}
                >
                  <ScanLine className="mr-2 h-4 w-4" />
                  Scan Another Code
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-xl">
                  <ScanLine className="mr-2 h-5 w-5" />
                  Scan QR Code
                </CardTitle>
                <CardDescription>
                  Scan a product QR code with your camera or upload an image
                </CardDescription>
              </CardHeader>
              <CardContent>
                <QRScanner onScanSuccess={handleScanSuccess} />
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default ScanQRCode;
