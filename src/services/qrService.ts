
import { Product } from "@/components/ProductCard";
import QRCode from "qrcode";
import JSZip from "jszip";
import { saveAs } from "file-saver";

// Generate QR code for a product
export const generateQRCode = async (product: Product, size = 200): Promise<string> => {
  try {
    // In a real app, this would be a URL to your product page
    // For demo purposes, we're encoding the product data in the QR code
    const productData = {
      id: product.id,
      code: product.product_code,
      price: product.price,
      dimensions: product.dimensions,
    };
    
    const dataString = JSON.stringify(productData);
    
    // Generate QR code as data URL
    return await QRCode.toDataURL(dataString, {
      width: size,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }
};

// Download QR code for a single product
export const downloadQRCode = async (product: Product): Promise<void> => {
  try {
    const qrDataUrl = await generateQRCode(product);
    
    // Create a temporary link element to trigger download
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `QR_${product.product_code}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Error downloading QR code:', error);
    throw new Error('Failed to download QR code');
  }
};

// Download all QR codes as a ZIP file
export const downloadAllQRCodes = async (products: Product[]): Promise<void> => {
  try {
    const zip = new JSZip();
    const qrFolder = zip.folder("qr_codes");
    
    if (!qrFolder) {
      throw new Error('Failed to create ZIP folder');
    }
    
    // Generate QR codes for all products and add to ZIP
    const promises = products.map(async (product) => {
      const qrDataUrl = await generateQRCode(product);
      // Convert data URL to binary
      const data = qrDataUrl.split(',')[1];
      qrFolder.file(`QR_${product.product_code}.png`, data, { base64: true });
    });
    
    await Promise.all(promises);
    
    // Generate ZIP file and trigger download
    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, "all_qr_codes.zip");
  } catch (error) {
    console.error('Error downloading QR codes:', error);
    throw new Error('Failed to download QR codes');
  }
};
