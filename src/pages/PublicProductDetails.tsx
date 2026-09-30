import React, { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, ImageIcon, Loader, Package, Ruler, DollarSign, Box, Tag } from "lucide-react";
import { Product } from "@/components/ProductCard";
import { toast } from "sonner";
import { getPublicProductByCode, getPublicProductById } from "@/services/publicProductService";
import { formatCbm } from "@/services/catalogService";

const dim = (p: Product) =>
  p.length && p.width && p.height
    ? `${p.length} × ${p.width} × ${p.height} cm`
    : p.dimensions || "N/A";

const fmtPrice = (n: number) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const PublicProductDetails: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { productId } = useParams();
  const productCode = searchParams.get("code");
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      if (!productCode && !productId) {
        setIsLoading(false);
        return;
      }
      try {
        const data = productId
          ? await getPublicProductById(productId)
          : await getPublicProductByCode(productCode!);
        if (data) setProduct(data);
        else toast.error("Product not found");
      } catch {
        toast.error("Failed to load product details");
      } finally {
        setIsLoading(false);
      }
    };
    fetch();
  }, [productCode, productId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-stone-50">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Loader className="w-8 h-8 text-stone-400 animate-spin" />
          </div>
          <p className="text-stone-500 text-sm">Loading product details…</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-stone-50">
        <div className="w-24 h-24 rounded-full bg-stone-100 flex items-center justify-center mb-6">
          <Package className="w-12 h-12 text-stone-400" />
        </div>
        <h1 className="text-2xl font-bold text-stone-900 mb-2">Product Not Found</h1>
        <p className="text-stone-500 text-center max-w-sm mb-6 leading-relaxed">
          The product you're looking for cannot be found. It may have been removed or the QR code is invalid.
        </p>
        <button
          onClick={() => window.history.length > 1 ? window.history.back() : (window.location.href = "/")}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-100 transition-colors text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" /> Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* header */}
      <div className="bg-white border-b border-stone-200">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => window.history.length > 1 ? window.history.back() : (window.location.href = "/")}
            className="flex items-center gap-2 text-stone-500 hover:text-stone-800 transition-colors text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">ProductMaster</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* product image */}
        <div className="rounded-2xl overflow-hidden bg-white border border-stone-200 shadow-sm aspect-[4/3]">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.product_code}
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-stone-300">
              <ImageIcon className="w-16 h-16" />
              <p className="text-sm">No image available</p>
            </div>
          )}
        </div>

        {/* product info card */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          {/* code + title */}
          <div className="p-6 pb-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-stone-400 mb-1">{product.product_code}</p>
            <h1 className="text-2xl font-serif font-bold text-stone-900 leading-tight">
              {product.description || "Product Details"}
            </h1>
          </div>

          <Separator />

          {/* specs grid */}
          <div className="p-6 grid grid-cols-2 gap-5">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-xs text-stone-400 uppercase tracking-wide">
                <DollarSign className="w-3.5 h-3.5" /> Price
              </div>
              <p className="text-2xl font-bold text-stone-900">{fmtPrice(product.price)}</p>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-xs text-stone-400 uppercase tracking-wide">
                <Box className="w-3.5 h-3.5" /> CBM
              </div>
              <p className="text-lg font-semibold text-stone-700">{formatCbm(product)} m³</p>
            </div>

            <div className="col-span-2 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-xs text-stone-400 uppercase tracking-wide">
                <Ruler className="w-3.5 h-3.5" /> Dimensions
              </div>
              <p className="text-base font-medium text-stone-700">{dim(product)}</p>
            </div>

            {product.sno && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-xs text-stone-400 uppercase tracking-wide">
                  <Tag className="w-3.5 h-3.5" /> S.No
                </div>
                <p className="text-sm font-medium text-stone-600">{product.sno}</p>
              </div>
            )}
          </div>
        </div>

        {/* footer */}
        <p className="text-center text-xs text-stone-400 uppercase tracking-widest">
          Powered by ProductMaster
        </p>
      </div>
    </div>
  );
};

export default PublicProductDetails;
