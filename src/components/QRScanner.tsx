
import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeResult } from "html5-qrcode";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, File, StopCircle, Upload } from "lucide-react";
import { toast } from "sonner";

// Configuration for the scanner
const qrConfig = {
  fps: 10,
  qrbox: { width: 250, height: 250 },
  aspectRatio: 1,
};

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
}

const QRScanner: React.FC<QRScannerProps> = ({ onScanSuccess }) => {
  const [scanning, setScanning] = useState(false);
  const [fileScanning, setFileScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize scanner when component mounts
  useEffect(() => {
    scannerRef.current = new Html5Qrcode("reader");

    // Cleanup scanner when component unmounts
    return () => {
      if (scannerRef.current && scanning) {
        scannerRef.current.stop().catch(error => {
          console.error("Failed to stop scanner:", error);
        });
      }
    };
  }, []);

  const startScanner = async () => {
    if (!scannerRef.current) return;

    try {
      setScanning(true);
      await scannerRef.current.start(
        { facingMode: "environment" },
        qrConfig,
        handleScanSuccess,
        undefined
      );
    } catch (error) {
      console.error("Failed to start scanner:", error);
      toast.error("Failed to access camera. Please check permissions.");
      setScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        setScanning(false);
      } catch (error) {
        console.error("Failed to stop scanner:", error);
      }
    }
  };

  const handleScanSuccess = (decodedText: string, result: Html5QrcodeResult) => {
    console.log(`QR Code scanned: ${decodedText}`, result);
    stopScanner();
    onScanSuccess(decodedText);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (fileList && fileList.length > 0 && scannerRef.current) {
      const file = fileList[0];
      
      setFileScanning(true);
      try {
        const decodedText = await scannerRef.current.scanFile(file, true);
        onScanSuccess(decodedText);
      } catch (error) {
        console.error("QR Code scan error:", error);
        toast.error("Could not find a valid QR code in the selected image");
      } finally {
        setFileScanning(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    }
  };

  const promptFileUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-6">
          <div 
            id="reader" 
            className={`w-full overflow-hidden bg-secondary aspect-square rounded-md flex items-center justify-center ${scanning ? '' : 'hidden'}`}
          />
          
          {!scanning && (
            <div className="w-full aspect-square rounded-md bg-secondary flex items-center justify-center">
              <div className="text-center p-6">
                <Camera className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">
                  Tap "Start Camera" to scan a QR code
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {scanning ? (
              <Button 
                variant="destructive" 
                className="w-full" 
                onClick={stopScanner}
                disabled={fileScanning}
              >
                <StopCircle className="mr-2 h-4 w-4" />
                Stop Camera
              </Button>
            ) : (
              <Button 
                variant="default" 
                className="w-full" 
                onClick={startScanner}
                disabled={fileScanning}
              >
                <Camera className="mr-2 h-4 w-4" />
                Start Camera
              </Button>
            )}
            
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={promptFileUpload}
              disabled={scanning || fileScanning}
            >
              {fileScanning ? (
                <>
                  <Upload className="mr-2 h-4 w-4 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <File className="mr-2 h-4 w-4" />
                  Upload Image
                </>
              )}
            </Button>
            
            <input 
              ref={fileInputRef}
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleFileUpload}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default QRScanner;
