import { Product } from "@/components/ProductCard";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { supabase } from "@/integrations/supabase/client";

// Get products for the current user
export const getProducts = async (): Promise<Product[]> => {
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session?.user) {
      console.error('No authenticated user found');
      return [];
    }
    
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('sno', { ascending: true });
    
    if (error) {
      console.error('Error fetching products:', error);
      throw error;
    }
    
    // Map database products to Product model
    const products: Product[] = data.map(item => ({
      id: item.id,
      sno: item.sno,
      product_code: item.product_code,
      dimensions: item.dimensions,
      length: item.length,
      width: item.width,
      height: item.height,
      price: item.price,
      cbm: item.cbm,
      description: item.description || '',
    }));
    
    // Get product images
    await enhanceProductsWithImages(products);
    
    return products;
  } catch (error) {
    console.error('Error getting products:', error);
    return [];
  }
};

// Save products for the current user
export const saveProducts = async (products: Product[]): Promise<void> => {
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session?.user) {
      toast.error('You must be logged in to save products');
      return;
    }
    
    const userId = session.session.user.id;
    
    // Delete existing products for this user
    const { error: deleteError } = await supabase
      .from('products')
      .delete()
      .neq('id', 'placeholder'); // Delete all rows (RLS ensures only the user's rows)
    
    if (deleteError) {
      console.error('Error deleting existing products:', deleteError);
      throw deleteError;
    }
    
    // Insert new products
    const productsToInsert = products.map(product => ({
      id: product.id,
      sno: product.sno,
      product_code: product.product_code,
      dimensions: product.dimensions,
      length: product.length,
      width: product.width,
      height: product.height,
      price: product.price,
      cbm: product.cbm,
      description: product.description,
      user_id: userId
    }));
    
    const { error: insertError } = await supabase
      .from('products')
      .insert(productsToInsert);
    
    if (insertError) {
      console.error('Error inserting products:', insertError);
      throw insertError;
    }
    
    toast.success('Products saved successfully');
  } catch (error) {
    console.error('Error saving products:', error);
    toast.error('Failed to save products');
  }
};

// Save a product image
export const saveProductImage = async (productCode: string, imageDataUrl: string): Promise<void> => {
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session?.user) {
      toast.error('You must be logged in to save product images');
      return;
    }
    
    const userId = session.session.user.id;
    
    // Check if image exists for this product
    const { data: existingImages } = await supabase
      .from('product_images')
      .select('id')
      .eq('product_code', productCode)
      .single();
    
    if (existingImages) {
      // Update existing image
      const { error } = await supabase
        .from('product_images')
        .update({ image_url: imageDataUrl })
        .eq('product_code', productCode);
      
      if (error) {
        console.error('Error updating product image:', error);
        throw error;
      }
    } else {
      // Insert new image
      const { error } = await supabase
        .from('product_images')
        .insert({
          product_code: productCode,
          image_url: imageDataUrl,
          user_id: userId
        });
      
      if (error) {
        console.error('Error inserting product image:', error);
        throw error;
      }
    }
  } catch (error) {
    console.error('Error saving image:', error);
    toast.error('Failed to save image');
  }
};

// Get a product image
export const getProductImage = async (productCode: string): Promise<string | undefined> => {
  try {
    const { data, error } = await supabase
      .from('product_images')
      .select('image_url')
      .eq('product_code', productCode)
      .maybeSingle();
    
    if (error) {
      console.error('Error getting product image:', error);
      return undefined;
    }
    
    return data?.image_url;
  } catch (error) {
    console.error('Error getting image:', error);
    return undefined;
  }
};

// Enhance products with their images
const enhanceProductsWithImages = async (products: Product[]): Promise<void> => {
  try {
    const productCodes = products.map(p => p.product_code);
    
    // Fetch all images for these products in a single query
    const { data, error } = await supabase
      .from('product_images')
      .select('product_code, image_url')
      .in('product_code', productCodes);
    
    if (error) {
      console.error('Error fetching product images:', error);
      return;
    }
    
    // Create a map for quick lookup
    const imageMap = new Map<string, string>();
    data.forEach(item => {
      imageMap.set(item.product_code, item.image_url);
    });
    
    // Add images to products
    products.forEach(product => {
      product.imageUrl = imageMap.get(product.product_code);
    });
  } catch (error) {
    console.error('Error enhancing products with images:', error);
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
        
        // Convert to JSON with header: 1 to get array of arrays first
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
        const lengthIndex = findColumnIndex(['length', 'l']);
        const widthIndex = findColumnIndex(['width', 'w', 'breadth', 'b']);
        const heightIndex = findColumnIndex(['height', 'h']);
        const dimIndex = findColumnIndex(['dimensions', 'dimension', 'size', 'measurements']);
        const priceIndex = findColumnIndex(['price', 'cost', 'amount', 'value']);
        const cbmIndex = findColumnIndex(['cbm', 'cubic meter', 'volume']);
        const descIndex = findColumnIndex(['description', 'desc', 'details', 'info']);
        
        console.log('Column indexes:', { 
          snoIndex, 
          codeIndex, 
          lengthIndex,
          widthIndex,
          heightIndex,
          dimIndex, 
          priceIndex, 
          cbmIndex, 
          descIndex 
        });
        
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
            price: priceIndex >= 0 ? parseFloat(String(row[priceIndex] || '0')) || 0 : 0,
            cbm: cbmIndex >= 0 ? String(row[cbmIndex] || 'N/A') : 'N/A',
            description: descIndex >= 0 ? String(row[descIndex] || '') : '',
          };
          
          // Add separate dimensions if available
          if (lengthIndex >= 0 && row[lengthIndex] !== undefined) {
            product.length = String(row[lengthIndex]);
          }
          
          if (widthIndex >= 0 && row[widthIndex] !== undefined) {
            product.width = String(row[widthIndex]);
          }
          
          if (heightIndex >= 0 && row[heightIndex] !== undefined) {
            product.height = String(row[heightIndex]);
          }
          
          // Add legacy dimensions if separate dimensions not available
          if (dimIndex >= 0 && (!product.length || !product.width || !product.height)) {
            product.dimensions = String(row[dimIndex] || 'N/A');
          }
          
          // If we have l, w, h but no legacy dimensions, create a calculated dimensions string
          if (product.length && product.width && product.height && !product.dimensions) {
            product.dimensions = `${product.length} × ${product.width} × ${product.height}`;
          }
          
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
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const zip = new JSZip();
        const result = await zip.loadAsync(e.target?.result as ArrayBuffer);
        const imageMap = new Map<string, string>();
        
        // Process each file in the ZIP
        const promises = Object.keys(result.files).map(async (fileName) => {
          const zipEntry = result.files[fileName];
          
          // Skip directories
          if (zipEntry.dir) return;
          
          // Get product code from filename (remove extension)
          const fileNameWithoutPath = fileName.split('/').pop() || '';
          const productCode = fileNameWithoutPath.split('.')[0];
          
          // Skip if no product code or not an image
          if (!productCode || !fileNameWithoutPath.match(/\.(jpe?g|png|gif|bmp|webp)$/i)) {
            return;
          }
          
          try {
            // Get file data
            const fileData = await zipEntry.async('blob');
            
            // Convert to base64
            const reader = new FileReader();
            reader.readAsDataURL(fileData);
            
            return new Promise((resolveFile) => {
              reader.onload = (e) => {
                if (e.target?.result) {
                  imageMap.set(productCode, e.target.result.toString());
                }
                resolveFile(null);
              };
            });
          } catch (error) {
            console.error(`Error processing file ${fileName}:`, error);
          }
        });
        
        await Promise.all(promises);
        resolve(imageMap);
      } catch (error) {
        console.error('Error processing ZIP file:', error);
        reject(new Error('Failed to process ZIP file. Make sure it contains valid images.'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read ZIP file'));
    };
    
    reader.readAsArrayBuffer(file);
  });
};

// Search products
export const searchProducts = (products: Product[], query: string): Product[] => {
  if (!query.trim()) return products;
  
  const lowerQuery = query.toLowerCase().trim();
  
  // Debug search
  console.log('Searching for:', lowerQuery);
  console.log('Products to search:', products.length);
  
  const results = products.filter((product) => {
    // Exact match for product_code gets highest priority
    if (product.product_code.toLowerCase() === lowerQuery) {
      console.log(`Exact match found for product: ${product.product_code}`);
      return true;
    }
    
    // Partial match for product_code
    const codeMatch = product.product_code.toLowerCase().includes(lowerQuery);
    
    // Partial match for description
    const descMatch = product.description && product.description.toLowerCase().includes(lowerQuery);
    
    console.log(`Product ${product.product_code}: code match = ${codeMatch}, desc match = ${descMatch}`);
    
    return codeMatch || descMatch;
  });
  
  console.log('Search results:', results.length);
  return results;
};

// Get a product by product code - Updated to use Supabase
export const getProductByCode = async (productCode: string): Promise<Product | undefined> => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('product_code', productCode)
      .maybeSingle();
      
    if (error) {
      console.error('Error fetching product:', error);
      return undefined;
    }
    
    if (!data) {
      return undefined;
    }
    
    // Convert to Product type
    const product: Product = {
      id: data.id,
      sno: data.sno,
      product_code: data.product_code,
      dimensions: data.dimensions,
      length: data.length,
      width: data.width,
      height: data.height,
      price: data.price,
      cbm: data.cbm,
      description: data.description || '',
    };
    
    // Get image if available
    const imageUrl = await getProductImage(productCode);
    if (imageUrl) {
      product.imageUrl = imageUrl;
    }
    
    return product;
  } catch (error) {
    console.error('Error getting product by code:', error);
    return undefined;
  }
};
