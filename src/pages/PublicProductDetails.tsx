import React, { useState, useEffect } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, ImageIcon, Loader, Package, Ruler, Box, Weight, Palette, Maximize2, X, Check, Plus, ListChecks, Tag,
} from "lucide-react";
import { BRAND_NAME, formatItemSize, formatNetWeight, formatPackingSize } from "@/lib/productDisplay";
import { toast } from "sonner";
import { getPublicProductByCode, getPublicProductById, type PublicProduct } from "@/services/publicProductService";
import { formatCbm } from "@/services/catalogService";
import { trackProductEvent } from "@/services/buyerEnquiryService";
import { rememberTrackingCode } from "@/lib/buyerSession";
import { MAX_SHORTLIST_ITEMS, shortlistStore, useShortlist } from "@/lib/shortlist";

const Spec: React.FC<{ icon: React.ReactNode; label: string; value: string | null; wide?: boolean }> = ({
  icon, label, value, wide,
}) =>
  value ? (
    <div className={`flex flex-col gap-1 ${wide ? "col-span-2" : ""}`}>
      <div className="flex items-center gap-1.5 text-xs text-stone-400 uppercase tracking-wide">
        {icon} {label}
      </div>
      <p className="text-base font-medium text-stone-700">{value}</p>
    </div>
  ) : null;

export const ShortlistLink: React.FC<{ count: number }> = ({ count }) => (
  <Link
    to="/shortlist"
    className="relative flex items-center gap-1.5 rounded-full border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-100"
  >
    <ListChecks className="w-4 h-4" />
    Shortlist
    {count > 0 && (
      <span className="ml-0.5 min-w-5 rounded-full bg-amber-600 px-1.5 text-center text-xs font-semibold text-white">
        {count}
      </span>
    )}
  </Link>
);

const PublicProductDetails: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { productId } = useParams();
  const productCode = searchParams.get("code");
  const trackingCode = searchParams.get("ex");
  const [product, setProduct] = useState<PublicProduct | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [imageFailed, setImageFailed] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const shortlist = useShortlist();
  const inShortlist = !!product && shortlist.some((item) => item.productId === product.id);

  useEffect(() => {
    rememberTrackingCode(trackingCode);
  }, [trackingCode]);

  useEffect(() => {
    const load = async () => {
      if (!productCode && !productId) {
        setIsLoading(false);
        return;
      }
      try {
        const data = productId ? await getPublicProductById(productId) : await getPublicProductByCode(productCode!);
        if (data) {
          setProduct(data);
          trackProductEvent(data.id, "view", trackingCode ? "exhibition_qr" : "product_qr");
        } else {
          toast.error("Product not found");
        }
      } catch {
        toast.error("Failed to load product details");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [productCode, productId, trackingCode]);

  const addToShortlist = () => {
    if (!product) return;
    if (shortlist.length >= MAX_SHORTLIST_ITEMS) {
      toast.error(`Your shortlist can hold up to ${MAX_SHORTLIST_ITEMS} products.`);
      return;
    }
    shortlistStore.add(product);
    trackProductEvent(product.id, "shortlist_add", trackingCode ? "exhibition_qr" : "product_qr");
    toast.success(`${product.product_code} added to your shortlist`);
  };

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
    <div className="min-h-screen bg-stone-50 pb-28">
      {zoomed && product.imageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-white p-4"
          onClick={() => setZoomed(false)}
        >
          <img src={product.imageUrl} alt={product.product_code} className="max-w-full max-h-full object-contain" />
          <button
            type="button"
            aria-label="Close"
            className="absolute top-4 right-4 rounded-full bg-stone-900/70 p-2 text-white"
            onClick={() => setZoomed(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* header */}
      <div className="bg-white border-b border-stone-200">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-stone-500">{BRAND_NAME}</p>
          <ShortlistLink count={shortlist.length} />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* product image */}
        <div className="relative rounded-2xl overflow-hidden bg-white border border-stone-200 shadow-sm aspect-square sm:aspect-[4/3]">
          {product.imageUrl && !imageFailed ? (
            <button type="button" onClick={() => setZoomed(true)} className="w-full h-full p-3 cursor-zoom-in">
              <img
                src={product.imageUrl}
                alt={product.product_code}
                className="w-full h-full object-contain"
                onError={() => setImageFailed(true)}
              />
              <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-xs text-white">
                <Maximize2 className="w-3 h-3" /> Tap to enlarge
              </span>
            </button>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-stone-300">
              <ImageIcon className="w-16 h-16" />
              <p className="text-sm">No image available</p>
            </div>
          )}
        </div>

        {/* product info card */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="p-6 pb-4">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">{product.product_code}</p>
              {product.category && (
                <span className="flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500">
                  <Tag className="w-3 h-3" /> {product.category}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-serif font-bold text-stone-900 leading-tight">
              {product.description || "Product Details"}
            </h1>
            <p className="mt-2 text-sm text-stone-500">
              Wholesale prices on request. Add products to your shortlist and request a quotation.
            </p>
          </div>

          <Separator />

          <div className="p-6 grid grid-cols-2 gap-5">
            <Spec icon={<Ruler className="w-3.5 h-3.5" />} label="Item size (L × W × H)" value={formatItemSize(product)} wide />
            <Spec icon={<Package className="w-3.5 h-3.5" />} label="Packing size (L × W × H)" value={formatPackingSize(product)} wide />
            <Spec
              icon={<Box className="w-3.5 h-3.5" />}
              label="CBM"
              value={formatCbm(product) === "—" ? null : `${formatCbm(product)} m³`}
            />
            <Spec icon={<Weight className="w-3.5 h-3.5" />} label="Net weight" value={formatNetWeight(product)} />
            <Spec icon={<Palette className="w-3.5 h-3.5" />} label="Finish" value={product.finish ?? null} />
          </div>
        </div>

        <p className="text-center text-xs text-stone-400 uppercase tracking-widest">Powered by ProductMaster</p>
      </div>

      {/* sticky shortlist actions */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 backdrop-blur">
        <div className="max-w-2xl mx-auto px-4 py-3 flex gap-3">
          {inShortlist ? (
            <>
              <div className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                <Check className="w-4 h-4" /> In your shortlist
              </div>
              <Link
                to="/shortlist"
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-3 text-sm font-semibold text-white hover:bg-stone-800"
              >
                <ListChecks className="w-4 h-4" /> View shortlist ({shortlist.length})
              </Link>
            </>
          ) : (
            <button
              type="button"
              onClick={addToShortlist}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-3 text-sm font-semibold text-white hover:bg-stone-800"
            >
              <Plus className="w-4 h-4" /> Add to shortlist
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PublicProductDetails;
