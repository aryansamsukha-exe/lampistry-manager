
import { Product } from "@/components/ProductCard";
import { toast } from "sonner";
import * as XLSX from 'xlsx';

// Local storage keys
const PRODUCTS_STORAGE_KEY = 'lampqr_products';
const IMAGES_STORAGE_KEY = 'lampqr_images';

// Mock database using localStorage
export const getProducts = (): Product[] => {
  try {
    const storedProducts = localStorage.getItem(PRODUCTS_STORAGE_KEY);
    return storedProducts ? JSON.parse(storedProducts) : [];
  } catch (error) {
    console.error('Error getting products:', error);
    return [];
  }
};

export const saveProducts = (products: Product[]): void => {
  try {
    localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(products));
  } catch (error) {
    console.error('Error saving products:', error);
    toast.error('Failed to save products');
  }
};

// Save a product image
export const saveProductImage = (productCode: string, imageDataUrl: string): void => {
  try {
    const storedImages = localStorage.getItem(IMAGES_STORAGE_KEY);
    const images = storedImages ? JSON.parse(storedImages) : {};
    images[productCode] = imageDataUrl;
    localStorage.setItem(IMAGES_STORAGE_KEY, JSON.stringify(images));
  } catch (error) {
    console.error('Error saving image:', error);
    toast.error('Failed to save image');
  }
};

// Get a product image
export const getProductImage = (productCode: string): string | undefined => {
  try {
    const storedImages = localStorage.getItem(IMAGES_STORAGE_KEY);
    const images = storedImages ? JSON.parse(storedImages) : {};
    return images[productCode];
  } catch (error) {
    console.error('Error getting image:', error);
    return undefined;
  }
};

// Process Excel file
export const processExcelFile = async (file: File): Promise<Product[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        console.log('File loaded, processing Excel data...');
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Get the first worksheet
        const worksheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[worksheetName];
        
        // Convert to JSON with header: 1 to get array of arrays first
        // This helps us handle files with different header names or formats
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (rawData.length < 2) {
          throw new Error('Excel file has insufficient data. It should have headers and at least one data row.');
        }
        
        // Extract headers (first row)
        const headers = rawData[0] as string[];
        console.log('Excel headers:', headers);
        
        // Find column indexes for each required field
        const findColumnIndex = (possibleNames: string[]): number => {
          return headers.findIndex(header => {
            if (!header) return false;
            const headerStr = String(header).toLowerCase().trim();
            return possibleNames.some(name => headerStr === name || headerStr.includes(name));
          });
        };
        
        const snoIndex = findColumnIndex(['sno', 's.no', 'serial', 'serial no', 'serial number']);
        const codeIndex = findColumnIndex(['product_code', 'productcode', 'code', 'product code']);
        const dimIndex = findColumnIndex(['dimensions', 'dimension', 'size', 'measurements']);
        const priceIndex = findColumnIndex(['price', 'cost', 'amount', 'value']);
        const cbmIndex = findColumnIndex(['cbm', 'cubic meter', 'volume']);
        const descIndex = findColumnIndex(['description', 'desc', 'details', 'info']);
        
        console.log('Column indexes:', { snoIndex, codeIndex, dimIndex, priceIndex, cbmIndex, descIndex });
        
        if (snoIndex === -1 || codeIndex === -1) {
          throw new Error('Required columns not found. Excel file must have at least "Sno" and "product_code" columns.');
        }
        
        // Map data rows to Product objects
        const products: Product[] = [];
        
        // Start from row 1 (skip headers)
        for (let i = 1; i < rawData.length; i++) {
          const row = rawData[i] as any[];
          
          // Skip empty rows
          if (!row || row.length === 0) continue;
          
          // Make sure we have the minimum required data (sno and product_code)
          if (row[snoIndex] === undefined || row[codeIndex] === undefined) {
            console.warn(`Skipping row ${i + 1} due to missing required data`);
            continue;
          }
          
          // Convert sno to number, default to row index if not a valid number
          let sno = parseInt(String(row[snoIndex]));
          if (isNaN(sno)) {
            sno = i; // Use row index as fallback
          }
          
          // Create product object
          const product: Product = {
            id: `product-${Date.now()}-${i}`,
            sno: sno,
            product_code: String(row[codeIndex] || '').trim(),
            dimensions: dimIndex >= 0 ? String(row[dimIndex] || 'N/A') : 'N/A',
            price: priceIndex >= 0 ? parseFloat(String(row[priceIndex] || '0')) || 0 : 0,
            cbm: cbmIndex >= 0 ? String(row[cbmIndex] || 'N/A') : 'N/A',
            description: descIndex >= 0 ? String(row[descIndex] || '') : '',
          };
          
          products.push(product);
        }
        
        if (products.length === 0) {
          throw new Error('No valid products found in the Excel file.');
        }
        
        // Sort by sno
        products.sort((a, b) => a.sno - b.sno);
        
        console.log(`Successfully processed ${products.length} products`);
        resolve(products);
      } catch (error) {
        console.error('Error processing Excel file:', error);
        reject(new Error(error instanceof Error ? error.message : 'Failed to process Excel file. Please check the format.'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsArrayBuffer(file);
  });
};

// Process zip file with images
export const processImageZip = async (file: File): Promise<Map<string, string>> => {
  // In a real implementation, you would use a library like JSZip
  // This is a simplified mock version
  return new Promise((resolve) => {
    setTimeout(() => {
      // Mock result - in real implementation, extract images and create object URLs
      const mockImageMap = new Map<string, string>();
      resolve(mockImageMap);
    }, 1000);
  });
};

// Search products
export const searchProducts = (products: Product[], query: string): Product[] => {
  if (!query.trim()) return products;
  
  const lowerQuery = query.toLowerCase().trim();
  return products.filter((product) => 
    product.product_code.toLowerCase().includes(lowerQuery) ||
    product.description.toLowerCase().includes(lowerQuery)
  );
};
