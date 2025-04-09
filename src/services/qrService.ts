
import { Product } from "@/components/ProductCard";
import QRCode from "qrcode";
import JSZip from "jszip";
import { saveAs } from "file-saver";

// Generate QR code for a product with a proper URL for redirection
export const generateQRCode = async (product: Product, size = 200): Promise<string> => {
  try {
    // Create an absolute URL that will work when scanned from a mobile device
    // First, get the current domain from the window location
    const domain = window.location.origin;
    
    // Create a proper URL that points to the public product details
    // We're only including the product code in the URL, removing dimensions
    const redirectUrl = `${domain}/public/product?code=${encodeURIComponent(product.product_code)}`;
    
    console.log("Generated QR redirect URL:", redirectUrl);
    
    // Generate QR code as data URL with the redirect URL
    return await QRCode.toDataURL(redirectUrl, {
      width: size,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H', // Higher error correction for better scanning
    });
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }
};

// Format dimensions for display in the standardized format "length × width × height"
const getDimensionsDisplay = (product: Product): string => {
  if (product.length && product.width && product.height) {
    return `${product.length} × ${product.width} × ${product.height}`;
  } else if (product.dimensions) {
    return product.dimensions;
  }
  return "N/A";
};

// Create QR code with product code, dimensions and price text
export const createQRWithText = async (product: Product): Promise<string> => {
  try {
    const qrDataUrl = await generateQRCode(product);
    
    // Create a canvas to compose the QR code and text
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Failed to create canvas context');
    }
    
    // Load the QR code image
    const qrImage = new Image();
    await new Promise((resolve, reject) => {
      qrImage.onload = resolve;
      qrImage.onerror = reject;
      qrImage.src = qrDataUrl;
    });
    
    // Calculate needed extra space for three lines of text
    const extraHeight = 80; // Space for product code, dimensions, and price
    
    // Set canvas size to fit QR code plus text area
    canvas.width = qrImage.width;
    canvas.height = qrImage.height + extraHeight;
    
    // Fill with white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw QR code
    ctx.drawImage(qrImage, 0, 0);
    
    // Add product code text
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(product.product_code, canvas.width / 2, qrImage.height + 20);
    
    // Add dimensions text
    ctx.font = '14px Arial';
    const dimensions = getDimensionsDisplay(product);
    ctx.fillText(dimensions, canvas.width / 2, qrImage.height + 40);
    
    // Add price text
    const price = `$${product.price.toFixed(2)}`;
    ctx.fillText(price, canvas.width / 2, qrImage.height + 60);
    
    // Convert to data URL
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Error creating QR with text:', error);
    throw new Error('Failed to create QR code with text');
  }
};

// Download QR code for a single product
export const downloadQRCode = async (product: Product): Promise<void> => {
  try {
    const qrWithTextDataUrl = await createQRWithText(product);
    
    // Create a temporary link element to trigger download
    const link = document.createElement('a');
    link.href = qrWithTextDataUrl;
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
      const qrWithTextDataUrl = await createQRWithText(product);
      // Convert data URL to binary
      const data = qrWithTextDataUrl.split(',')[1];
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
