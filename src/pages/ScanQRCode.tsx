
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader, ArrowLeft, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import QRScanner from "@/components/QRScanner";

const ScanQRCode: React.FC = () => {
  const [processing, setProcessing] = useState(false);
  const navigate = useNavigate();

  const handleScanSuccess = (decodedText: string) => {
    console.log("Successfully scanned QR code:", decodedText);
    setProcessing(true);
    
    try {
      // Try to extract product code from the scanned URL
      let productCode: string | null = null;
      let publicPath: string | null = null;
      
      try {
        // Try to parse as URL
        const url = new URL(decodedText);
        console.log("Parsed URL:", url.toString());
        
        if (/^\/public\/product\/[0-9a-f-]+$/i.test(url.pathname)) {
          publicPath = url.pathname;
        } else if (url.searchParams.has('code')) {
          productCode = url.searchParams.get('code');
          console.log("Found product code in URL parameter:", productCode);
        } else {
          // Try to extract code from pathname
          const pathParts = url.pathname.split('/');
          const lastPart = pathParts[pathParts.length - 1];
          if (lastPart && /^[A-Za-z0-9._-]+$/.test(lastPart)) {
            productCode = lastPart;
            console.log("Extracted product code from pathname:", productCode);
          }
        }
      } catch (error) {
        console.log("Not a URL, checking if direct product code:", decodedText);
        // Not a URL, check if it's a direct product code
        const trimmed = decodedText.trim();
        if (trimmed !== '' && /^[A-Za-z0-9._/-]+$/.test(trimmed)) {
          productCode = trimmed;
          console.log("Using direct product code:", productCode);
        }
      }
      
      if (publicPath) {
        navigate(publicPath);
        toast.success("QR code scanned successfully!");
      } else if (productCode) {
        console.log("Navigating to product with code:", productCode);
        // Redirect to public product page
        const publicProductUrl = `/public/product?code=${encodeURIComponent(productCode)}`;
        console.log("Public product URL:", publicProductUrl);
        navigate(publicProductUrl);
        toast.success("QR code scanned successfully!");
      } else {
        console.error("Invalid QR code content:", decodedText);
        toast.error("Invalid QR code. Please scan a valid product QR code.");
      }
    } catch (error) {
      console.error("Error processing QR code:", error);
      toast.error("Error processing QR code. Please try again.");
    } finally {
      setProcessing(false);
    }
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
        </div>
      </main>
    </div>
  );
};

export default ScanQRCode;
