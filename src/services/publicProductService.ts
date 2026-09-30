
import { supabase } from "@/integrations/supabase/client";
import type { Product } from "@/components/ProductCard";

const db = supabase as any;

export const getPublicProductById = async (productId: string): Promise<Product | null> => {
  if (!productId) return null;
  const { data, error } = await db.rpc("get_public_product", { product_uuid: productId }).maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id, sno: data.sno, product_code: data.product_code, dimensions: data.dimensions,
    length: data.length, width: data.width, height: data.height, price: Number(data.price || 0),
    cbm: data.cbm, description: data.description || "", imageUrl: data.image_url
  };
};

// Get a product by code — public access (requires anon SELECT RLS policies)
export const getPublicProductByCode = async (productCode: string): Promise<Product | null> => {
  if (!productCode) return null;

  const code = productCode.trim();

  try {
    console.log("Getting public product with code:", code);

    // Prefer newest row if the same code exists for multiple users
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('product_code', code)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching public product:', error);
      return null;
    }

    if (!data) {
      console.log('No product found with code:', code);
      return null;
    }

    const { data: imageData } = await supabase
      .from('product_images')
      .select('image_url')
      .eq('product_code', code)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

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
      imageUrl: imageData?.image_url
    };

    console.log("Successfully retrieved public product:", product);
    return product;
  } catch (error) {
    console.error('Error getting public product:', error);
    return null;
  }
};
