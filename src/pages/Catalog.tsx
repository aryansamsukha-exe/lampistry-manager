import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader, PackageOpen, Printer } from "lucide-react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import type { Product } from "@/components/ProductCard";
import { getProducts, searchProducts } from "@/services/productService";
import { formatCbm } from "@/services/catalogService";

const dimensions = (product: Product) =>
  product.length && product.width && product.height
    ? `${product.length} × ${product.width} × ${product.height} cm`
    : product.dimensions || "Dimensions not available";

const Catalog: React.FC = () => {
  const { isAuthenticated, loadingSession } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!loadingSession && !isAuthenticated) navigate("/login");
  }, [isAuthenticated, loadingSession, navigate]);

  useEffect(() => {
    if (!isAuthenticated) return;
    getProducts().then(setProducts).finally(() => setIsLoading(false));
  }, [isAuthenticated]);

  const visibleProducts = useMemo(
    () => (query.trim() ? searchProducts(products, query) : products),
    [products, query]
  );

  if (loadingSession || !isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <div className="catalog-controls"><Navbar /></div>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8 catalog-print-area">
        <section className="rounded-2xl bg-stone-900 px-6 py-10 text-stone-50 shadow-xl sm:px-10 catalog-hero">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-amber-300">Product collection</p>
          <h1 className="max-w-2xl font-serif text-4xl leading-tight sm:text-5xl">A catalog made from your live inventory.</h1>
          <p className="mt-4 max-w-xl text-stone-300">{products.length} products · Detailed specifications · Volumes calculated from dimensions</p>
        </section>

        <div className="catalog-controls my-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search product code or description" className="max-w-md bg-white" />
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/products")}><ArrowLeft className="mr-2 h-4 w-4" />Products</Button>
            <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Save / Print PDF</Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-24"><Loader className="h-8 w-8 animate-spin" /></div>
        ) : visibleProducts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-stone-300 py-20 text-center text-stone-500"><PackageOpen className="mx-auto mb-3 h-10 w-10" />No products to include in this catalog.</div>
        ) : (
          <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 catalog-grid">
            {visibleProducts.map((product) => (
              <article key={product.id || product.product_code} className="catalog-card overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
                <div className="aspect-[4/3] bg-stone-100">
                  {product.imageUrl ? <img src={product.imageUrl} alt={product.product_code} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-stone-400">Product image</div>}
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3"><h2 className="font-serif text-xl font-semibold">{product.product_code}</h2><span className="whitespace-nowrap text-lg font-semibold text-amber-700">${product.price.toFixed(2)}</span></div>
                  <p className="mt-2 min-h-10 text-sm leading-5 text-stone-600">{product.description || "Product details available on request."}</p>
                  <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-stone-100 pt-4 text-sm">
                    <div><dt className="text-xs uppercase tracking-wide text-stone-400">Dimensions</dt><dd className="mt-1 font-medium">{dimensions(product)}</dd></div>
                    <div><dt className="text-xs uppercase tracking-wide text-stone-400">CBM</dt><dd className="mt-1 font-medium">{formatCbm(product)} m³</dd></div>
                  </dl>
                </div>
              </article>
            ))}
          </section>
        )}
        <footer className="mt-10 border-t border-stone-200 pt-5 text-center text-xs uppercase tracking-widest text-stone-400">Generated from ProductMaster · {new Date().getFullYear()}</footer>
      </main>
    </div>
  );
};

export default Catalog;
