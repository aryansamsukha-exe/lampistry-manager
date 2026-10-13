import type { Product } from "@/components/ProductCard";
import { updateProduct, type ProductEdits } from "@/services/productService";
import type { ProductUpdatePlan } from "@/lib/productUpdatePlan";

export const applyProductUpdate = async ({ product, changes }: ProductUpdatePlan): Promise<Product> => {
  const edits: ProductEdits = {
    description: product.description,
    price: product.price,
    length: product.length,
    width: product.width,
    height: product.height,
    category: product.category,
    finish: product.finish,
    packing_length: product.packing_length,
    packing_width: product.packing_width,
    packing_height: product.packing_height,
    net_weight: product.net_weight,
  };
  for (const { field, to } of changes) {
    if (field === "price") edits.price = Number(to);
    else edits[field] = to;
  }
  return updateProduct(product, edits);
};
