import { Product } from "@/components/ProductCard";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from 'uuid';

// Get products for the current user
export const getProducts = async (): Promise<Product[]> => {
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session?.user) {
      console.error('No authenticated user found');
      return [];
    }
    
    console.log('Getting products for user:', session.session.user.id);
    
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('sno', { ascending: true });
    
    if (error) {
      console.error('Error fetching products:', error);
      throw error;
    }
    
    console.log('Products fetched:', data?.length || 0);
    
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
    console.log('Saving products for user:', userId);
    console.log('Number of products to save:', products.length);
    
    const productsToUpsert = products.map(product => ({
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
    
    const batchSize = 50;
    let successCount = 0;
    
    for (let i = 0; i < productsToUpsert.length; i += batchSize) {
      const batch = productsToUpsert.slice(i, i + batchSize);
      console.log(`Upserting batch ${i/batchSize + 1} of ${Math.ceil(productsToUpsert.length/batchSize)}, size: ${batch.length}`);
      
      const { error } = await supabase
        .from('products')
        .upsert(batch, { 
          onConflict: 'product_code,user_id',
          ignoreDuplicates: true
        });
      
      if (error) {
        console.error(`Error upserting batch ${i/batchSize + 1}:`, error);
        console.log('Continuing with next batch despite error');
      } else {
        successCount += batch.length;
        console.log(`Successfully upserted batch ${i/batchSize + 1}, total progress: ${successCount}/${productsToUpsert.length}`);
      }
    }
    
    if (successCount > 0) {
      toast.success(`Products saved successfully (${successCount}/${productsToUpsert.length})`);
    } else {
      toast.error('Failed to save any products');
      throw new Error('Failed to save products');
    }
  } catch (error) {
    console.error('Error saving products:', error);
    toast.error('Failed to save products');
    throw error;
  }
};

// Delete a product by its ID
export const deleteProduct = async (productId: string): Promise<boolean> => {
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session?.user) {
      toast.error('You must be logged in to delete products');
      return false;
    }
    
    const userId = session.session.user.id;
    console.log(`Deleting product with ID: ${productId} for user: ${userId}`);
    
    const { data: productData } = await supabase
      .from('products')
      .select('product_code')
      .eq('id', productId)
      .eq('user_id', userId)
      .maybeSingle();
      
    if (productData) {
      const { error: imageDeleteError } = await supabase
        .from('product_images')
        .delete()
        .eq('product_code', productData.product_code)
        .eq('user_id', userId);
        
      if (imageDeleteError) {
        console.error('Error deleting product image:', imageDeleteError);
      } else {
        console.log(`Deleted image for product code: ${productData.product_code}`);
      }
    }
    
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId)
      .eq('user_id', userId);
    
    if (error) {
      console.error('Error deleting product:', error);
      toast.error('Failed to delete product');
      return false;
    }
    
    toast.success('Product deleted successfully');
    return true;
  } catch (error) {
    console.error('Error deleting product:', error);
    toast.error('Failed to delete product');
    return false;
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
    console.log(`Saving image for product: ${productCode}`);
    
    const { data: existingImages } = await supabase
      .from('product_images')
      .select('id')
      .eq('product_code', productCode)
      .maybeSingle();
    
    if (existingImages) {
      const { error } = await supabase
        .from('product_images')
        .update({ image_url: imageDataUrl })
        .eq('product_code', productCode)
        .eq('user_id', userId);
      
      if (error) {
        console.error('Error updating product image:', error);
        throw error;
      }
    } else {
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
    const { data: session } = await supabase.auth.getSession();
    if (!session.session?.user) {
      console.warn('No authenticated user found when getting product image');
      return undefined;
    }
    
    const userId = session.session.user.id;
    
    const { data, error } = await supabase
      .from('product_images')
      .select('image_url')
      .eq('product_code', productCode)
      .eq('user_id', userId)
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
    if (products.length === 0) return;
    
    const { data: session } = await supabase.auth.getSession();
    if (!session.session?.user) {
      console.warn('No authenticated user found when enhancing products with images');
      return;
    }
    
    const userId = session.session.user.id;
    const productCodes = products.map(p => p.product_code);
    
    const { data, error } = await supabase
      .from('product_images')
      .select('product_code, image_url')
      .in('product_code', productCodes)
      .eq('user_id', userId);
    
    if (error) {
      console.error('Error fetching product images:', error);
      return;
    }
    
    console.log(`Retrieved ${data?.length || 0} images for ${productCodes.length} products`);
    
    const imageMap = new Map<string, string>();
    data.forEach(item => {
      imageMap.set(item.product_code, item.image_url);
    });
    
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
        
        const worksheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[worksheetName];
        
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (rawData.length < 2) {
          throw new Error('Excel file has insufficient data. It should have headers and at least one data row.');
        }
        
        const headers = rawData[0] as string[];
        console.log('Excel headers:', headers);
        
        const findColumnIndex = (possibleNames: string[]): number => {
          return headers.findIndex(header => {
            if (!header) return false;
            const headerStr = String(header).toLowerCase().trim();
            return possibleNames.some(name => headerStr === name || headerStr.includes(name));
          });
        };
        
        const snoIndex = findColumnIndex(['sno', 's.no', 'serial', 'serial no', 'serial number']);
        const codeIndex = findColumnIndex(['product_code', 'productcode', 'code', 'product code', 'item code']);
        const lengthIndex = findColumnIndex(['length', 'l']);
        const widthIndex = findColumnIndex(['width', 'w', 'breadth', 'b']);
        const heightIndex = findColumnIndex(['height', 'h']);
        const dimIndex = findColumnIndex(['dimensions', 'dimension', 'size', 'measurements']);
        const priceIndex = findColumnIndex(['price', 'cost', 'amount', 'value', 'price usd']);
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
        
        const products: Product[] = [];
        
        for (let i = 1; i < rawData.length; i++) {
          const row = rawData[i] as any[];
          
          if (!row || row.length === 0) continue;
          
          if (row[snoIndex] === undefined || row[codeIndex] === undefined) {
            console.warn(`Skipping row ${i + 1} due to missing required data`);
            continue;
          }
          
          let sno = parseInt(String(row[snoIndex]));
          if (isNaN(sno)) {
            sno = i;
          }
          
          const productCode = String(row[codeIndex] || '').trim();
          if (!productCode) {
            console.warn(`Skipping row ${i + 1} due to empty product code`);
            continue;
          }
          
          const product: Product = {
            id: '',
            sno: sno,
            product_code: productCode,
            price: priceIndex >= 0 ? parseFloat(String(row[priceIndex] || '0')) || 0 : 0,
            cbm: cbmIndex >= 0 ? String(row[cbmIndex] || 'N/A') : 'N/A',
            description: descIndex >= 0 ? String(row[descIndex] || '') : '',
          };
          
          if (lengthIndex >= 0 && row[lengthIndex] !== undefined) {
            product.length = String(row[lengthIndex]);
          }
          
          if (widthIndex >= 0 && row[widthIndex] !== undefined) {
            product.width = String(row[widthIndex]);
          }
          
          if (heightIndex >= 0 && row[heightIndex] !== undefined) {
            product.height = String(row[heightIndex]);
          }
          
          if (dimIndex >= 0 && (!product.length || !product.width || !product.height)) {
            product.dimensions = String(row[dimIndex] || 'N/A');
          }
          
          if (product.length && product.width && product.height && !product.dimensions) {
            product.dimensions = `${product.length} × ${product.width} × ${product.height}`;
          }
          
          products.push(product);
        }
        
        if (products.length === 0) {
          throw new Error('No valid products found in the Excel file.');
        }
        
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
        
        const promises = Object.keys(result.files).map(async (fileName) => {
          const zipEntry = result.files[fileName];
          
          if (zipEntry.dir) return;
          
          const fileNameWithoutPath = fileName.split('/').pop() || '';
          const productCode = fileNameWithoutPath.split('.')[0];
          
          if (!productCode || !fileNameWithoutPath.match(/\.(jpe?g|png|gif|bmp|webp)$/i)) {
            return;
          }
          
          try {
            const fileData = await zipEntry.async('blob');
            
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
  
  console.log('Searching for:', lowerQuery);
  console.log('Products to search:', products.length);
  
  const results = products.filter((product) => {
    if (product.product_code.toLowerCase() === lowerQuery) {
      console.log(`Exact match found for product: ${product.product_code}`);
      return true;
    }
    
    const codeMatch = product.product_code.toLowerCase().includes(lowerQuery);
    
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
    const { data: session } = await supabase.auth.getSession();
    if (!session.session?.user) {
      console.warn('No authenticated user found when getting product by code');
      return undefined;
    }
    
    const userId = session.session.user.id;
    
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('product_code', productCode)
      .eq('user_id', userId)
      .maybeSingle();
      
    if (error) {
      console.error('Error fetching product:', error);
      return undefined;
    }
    
    if (!data) {
      return undefined;
    }
    
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
