
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
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Get the first worksheet
        const worksheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[worksheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        // Map to our Product type
        const products = jsonData.map((row: any, index) => ({
          id: `product-${Date.now()}-${index}`,
          sno: row.Sno || index + 1,
          product_code: row.product_code || `PROD-${index + 1}`,
          dimensions: row.dimensions || 'N/A',
          price: parseFloat(row.price) || 0,
          cbm: row.cbm || 'N/A',
          description: row.description || '',
        })) as Product[];
        
        // Sort by sno
        products.sort((a, b) => a.sno - b.sno);
        
        resolve(products);
      } catch (error) {
        console.error('Error processing Excel file:', error);
        reject(new Error('Failed to process Excel file. Please check the format.'));
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
