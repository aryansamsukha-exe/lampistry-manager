
import type { Product } from "@/components/ProductCard";
import { toast } from "sonner";
import JSZip from 'jszip';
import { supabase } from "@/integrations/supabase/client";
import { withCalculatedCbm } from '@/services/catalogService';
import { compressImageOrKeep, dataUrlBytes } from '@/services/imageCompression';
import { isInlineImage, removeImageFiles, uploadImageFile } from '@/services/imageStorageService';

// Get products for the current user
export const getProducts = async (importBatchId?: string | null, withImages = true): Promise<Product[]> => {
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session?.user) {
      console.error('No authenticated user found');
      return [];
    }
    
    console.log('Getting products for user:', session.session.user.id);
    
    let query = supabase
      .from('products')
      .select('*')
      .order('sno', { ascending: true });
    if (importBatchId) query = query.eq('import_batch_id', importBatchId);
    const { data, error } = await query;
    
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
      category: item.category ?? undefined,
      finish: item.finish ?? undefined,
      packing_length: item.packing_length ?? undefined,
      packing_width: item.packing_width ?? undefined,
      packing_height: item.packing_height ?? undefined,
      net_weight: item.net_weight ?? undefined,
      import_batch_id: item.import_batch_id,
      created_at: item.created_at,
    }));
    
    if (withImages) await enhanceProductsWithImages(products);
    
    return products.map(withCalculatedCbm);
  } catch (error) {
    console.error('Error getting products:', error);
    return [];
  }
};

export const hasAnyProducts = async (): Promise<boolean> => {
  const { count, error } = await supabase.from('products').select('id', { count: 'exact', head: true });
  if (error) throw error;
  return (count ?? 0) > 0;
};

// Only send columns that have values so sheets without packing data still import
// into databases where product-packing-details.sql has not been applied.
const packingDetails = (product: Product) =>
  Object.fromEntries(
    (['category', 'finish', 'packing_length', 'packing_width', 'packing_height', 'net_weight'] as const)
      .filter((key) => product[key])
      .map((key) => [key, product[key]])
  );

const findExistingCodes = async (userId: string, codes: string[]): Promise<Set<string>> => {
  const existing = new Set<string>();
  for (let i = 0; i < codes.length; i += 100) {
    const { data, error } = await supabase
      .from('products')
      .select('product_code')
      .eq('user_id', userId)
      .in('product_code', codes.slice(i, i + 100));
    if (error) throw error;
    data?.forEach((row) => existing.add(row.product_code));
  }
  return existing;
};

export type SaveProductsResult = { saved: string[]; skipped: string[] };

// Save products for the current user. Codes the user already has are left untouched and reported as skipped.
export const saveProducts = async (products: Product[], importBatchId?: string): Promise<SaveProductsResult> => {
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session?.user) {
      toast.error('You must be logged in to save products');
      return { saved: [], skipped: [] };
    }
    
    const userId = session.session.user.id;
    console.log('Saving products for user:', userId);
    console.log('Number of products to save:', products.length);

    const existingCodes = await findExistingCodes(userId, products.map((p) => p.product_code));
    const skipped = products.filter((p) => existingCodes.has(p.product_code)).map((p) => p.product_code);
    const saved: string[] = [];
    
    const productsToUpsert = products.filter((p) => !existingCodes.has(p.product_code)).map(withCalculatedCbm).map(product => ({
      sno: product.sno,
      product_code: product.product_code,
      dimensions: product.dimensions,
      length: product.length,
      width: product.width,
      height: product.height,
      price: product.price,
      cbm: product.cbm,
      description: product.description,
      ...packingDetails(product),
      import_batch_id: importBatchId || product.import_batch_id || null,
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
        saved.push(...batch.map((p) => p.product_code));
        console.log(`Successfully upserted batch ${i/batchSize + 1}, total progress: ${successCount}/${productsToUpsert.length}`);
      }
    }
    
    if (productsToUpsert.length > 0 && successCount === 0) {
      toast.error('Failed to save any products');
      throw new Error('Failed to save products');
    }
    return { saved, skipped };
  } catch (error) {
    console.error('Error saving products:', error);
    toast.error('Failed to save products');
    throw error;
  }
};

export type ProductEdits = Pick<
  Product,
  'description' | 'price' | 'length' | 'width' | 'height' | 'category' | 'finish' |
  'packing_length' | 'packing_width' | 'packing_height' | 'net_weight'
>;

const PACKING_FIELDS = ['category', 'finish', 'packing_length', 'packing_width', 'packing_height', 'net_weight'] as const;

// Update the editable details of a product. Returns the saved product.
export const updateProduct = async (product: Product, edits: ProductEdits): Promise<Product> => {
  const updated = withCalculatedCbm({ ...product, ...edits });
  const clean = (value?: string) => value?.trim() || null;

  const changes: Record<string, unknown> = {
    description: updated.description.trim(),
    price: updated.price,
    length: clean(updated.length),
    width: clean(updated.width),
    height: clean(updated.height),
    dimensions: updated.length && updated.width && updated.height
      ? `${updated.length} × ${updated.width} × ${updated.height}`
      : product.dimensions ?? null,
    cbm: updated.cbm,
  };
  // These columns only exist once product-packing-details.sql / exhibition-phase2.sql have been applied.
  if (PACKING_FIELDS.some((key) => product[key] || edits[key])) {
    PACKING_FIELDS.forEach((key) => { changes[key] = clean(updated[key]); });
  }

  const { error } = await supabase.from('products').update(changes).eq('id', product.id);
  if (error) {
    console.error('Error updating product:', error);
    throw error;
  }
  return updated;
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
    
    // First, get the product code to delete associated images
    const { data: productData, error: fetchError } = await supabase
      .from('products')
      .select('product_code')
      .eq('id', productId)
      .eq('user_id', userId)
      .maybeSingle();
      
    if (fetchError) {
      console.error('Error fetching product for deletion:', fetchError);
      toast.error('Failed to delete product');
      return false;
    }
    
    if (!productData) {
      console.error('Product not found for deletion');
      toast.error('Product not found');
      return false;
    }
    
    // Delete associated images
    const { data: imageRows } = await supabase
      .from('product_images')
      .select('image_url')
      .eq('product_code', productData.product_code)
      .eq('user_id', userId);
    await removeImageFiles((imageRows ?? []).map((row) => row.image_url));

    const { error: imageDeleteError } = await supabase
      .from('product_images')
      .delete()
      .eq('product_code', productData.product_code)
      .eq('user_id', userId);
      
    if (imageDeleteError) {
      console.error('Error deleting product image:', imageDeleteError);
      // Continue with product deletion even if image deletion fails
    } else {
      console.log(`Deleted image for product code: ${productData.product_code}`);
    }
    
    // Delete the product
    const { error: productDeleteError } = await supabase
      .from('products')
      .delete()
      .eq('id', productId)
      .eq('user_id', userId);
    
    if (productDeleteError) {
      console.error('Error deleting product:', productDeleteError);
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

let storageWarningShown = false;

// Save a product image. The image is uploaded to Storage and only its URL is stored; if Storage
// is not set up yet (product-image-storage.sql not applied) the data URL is stored as before.
export const saveProductImage = async (productCode: string, imageDataUrl: string): Promise<void> => {
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session?.user) {
      toast.error('You must be logged in to save product images');
      return;
    }

    const userId = session.session.user.id;
    let imageUrl = imageDataUrl;
    if (isInlineImage(imageDataUrl)) {
      try {
        imageUrl = await uploadImageFile(userId, productCode, imageDataUrl);
      } catch (uploadError) {
        console.error('Upload to image storage failed, saving the image inline instead:', uploadError);
        if (!storageWarningShown) {
          storageWarningShown = true;
          toast.warning('Photo storage is not set up, so photos are saved the slow way. Run supabase/product-image-storage.sql.');
        }
      }
    }

    const { data: existing } = await supabase
      .from('product_images')
      .select('id, image_url')
      .eq('product_code', productCode)
      .eq('user_id', userId)
      .maybeSingle();

    const { error } = existing
      ? await supabase.from('product_images').update({ image_url: imageUrl }).eq('id', existing.id)
      : await supabase.from('product_images').insert({ product_code: productCode, image_url: imageUrl, user_id: userId });

    if (error) {
      console.error('Error saving product image:', error);
      await removeImageFiles([imageUrl]);
      throw error;
    }
    if (existing && existing.image_url !== imageUrl) await removeImageFiles([existing.image_url]);
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

const IMAGE_CHUNK_SIZE = 25;
const IMAGE_REQUESTS_IN_PARALLEL = 4;

// Enhance products with their images. Loaded in small parallel requests so a few large
// inline images cannot make one huge request time out.
const enhanceProductsWithImages = async (products: Product[]): Promise<void> => {
  if (products.length === 0) return;

  const { data: session } = await supabase.auth.getSession();
  if (!session.session?.user) {
    console.warn('No authenticated user found when enhancing products with images');
    return;
  }
  const userId = session.session.user.id;

  const codes = [...new Set(products.map((p) => p.product_code))];
  const chunks: string[][] = [];
  for (let i = 0; i < codes.length; i += IMAGE_CHUNK_SIZE) chunks.push(codes.slice(i, i + IMAGE_CHUNK_SIZE));

  const imageMap = new Map<string, string>();
  const loadChunk = async (chunk: string[], attempt = 1): Promise<void> => {
    const { data, error } = await supabase
      .from('product_images')
      .select('product_code, image_url')
      .in('product_code', chunk)
      .eq('user_id', userId);
    if (error) {
      if (attempt < 3) return loadChunk(chunk, attempt + 1);
      console.error('Error fetching product images:', error);
      return;
    }
    data.forEach((item) => imageMap.set(item.product_code, item.image_url));
  };

  const worker = async () => {
    for (let chunk = chunks.shift(); chunk; chunk = chunks.shift()) await loadChunk(chunk);
  };
  await Promise.all(Array.from({ length: IMAGE_REQUESTS_IN_PARALLEL }, worker));

  products.forEach((product) => {
    product.imageUrl = imageMap.get(product.product_code);
  });
};

export type ZipImages = { images: Map<string, string>; originalBytes: number; compressedBytes: number };

// Read images from a ZIP (named by product code) and compress each one.
export const processImageZip = async (file: File): Promise<ZipImages> => {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(await file.arrayBuffer());
  } catch (error) {
    console.error('Error processing ZIP file:', error);
    throw new Error('Failed to process ZIP file. Make sure it contains valid images.');
  }

  const images = new Map<string, string>();
  let originalBytes = 0;
  let compressedBytes = 0;

  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    const fileName = entry.name.split('/').pop() || '';
    const productCode = fileName.split('.')[0];
    if (!productCode || fileName.startsWith('._') || !/\.(jpe?g|png|gif|bmp|webp)$/i.test(fileName)) continue;

    try {
      const blob = await entry.async('blob');
      const dataUrl = await compressImageOrKeep(blob);
      images.set(productCode, dataUrl);
      originalBytes += blob.size;
      compressedBytes += dataUrlBytes(dataUrl);
    } catch (error) {
      console.error(`Error processing file ${entry.name}:`, error);
    }
  }

  return { images, originalBytes, compressedBytes };
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
      finish: data.finish ?? undefined,
      packing_length: data.packing_length ?? undefined,
      packing_width: data.packing_width ?? undefined,
      packing_height: data.packing_height ?? undefined,
      net_weight: data.net_weight ?? undefined,
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
