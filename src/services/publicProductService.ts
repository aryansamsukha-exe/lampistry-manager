
import { supabase } from "@/integrations/supabase/client";
import { Product } from "@/components/ProductCard";

// Get a product by code - public access with no authentication required
export const getPublicProductByCode = async (productCode: string): Promise<Product | null> => {
  if (!productCode) return null;
  
  try {
    console.log("Getting public product with code:", productCode);
    
    // Get the product without user_id filter for public access
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('product_code', productCode)
      .maybeSingle();
    
    if (error) {
      console.error('Error fetching public product:', error);
      return null;
    }
    
    if (!data) {
      console.log('No product found with code:', productCode);
      return null;
    }
    
    // Get the product image
    const { data: imageData } = await supabase
      .from('product_images')
      .select('image_url')
      .eq('product_code', productCode)
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
    
    return product;
  } catch (error) {
    console.error('Error getting public product:', error);
    return null;
  }
};
