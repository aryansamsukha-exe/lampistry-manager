
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ReactNode, Suspense, lazy, useEffect } from "react";
import NotFound from "./pages/NotFound";
import PublicProductDetails from "./pages/PublicProductDetails";
import Shortlist from "./pages/Shortlist";

// Buyers scanning QR codes should not download the admin screens.
const Index = lazy(() => import("./pages/Index"));
const Login = lazy(() => import("./pages/Login"));
const ProductList = lazy(() => import("./pages/ProductList"));
const ImportProducts = lazy(() => import("./pages/ImportProducts"));
const QRCodes = lazy(() => import("./pages/QRCodes"));
const ScanQRCode = lazy(() => import("./pages/ScanQRCode"));
const Catalog = lazy(() => import("./pages/Catalog"));
const PrintTags = lazy(() => import("./pages/PrintTags"));
const Showroom = lazy(() => import("./pages/Showroom"));
const ShowroomCollection = lazy(() => import("./pages/ShowroomCollection"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Secure route component to protect authenticated routes
const SecureRoute = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, loadingSession } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loadingSession && !isAuthenticated) {
      // Store the attempted URL for redirect after login
      navigate(`/login?returnUrl=${encodeURIComponent(location.pathname)}`, { replace: true });
    }
  }, [isAuthenticated, loadingSession, location, navigate]);

  if (loadingSession) {
    return <div className="flex justify-center items-center h-screen">Loading session...</div>;
  }

  return isAuthenticated ? <>{children}</> : null;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Index />} />
    <Route path="/login" element={<Login />} />
    
    {/* Public routes - no authentication required and accessible externally */}
    {/* Legacy: /public/product?code=XYZ */}
    <Route path="/public/product" element={<PublicProductDetails />} />
    {/* New: /public/product/:productId (UUID-based) */}
    <Route path="/public/product/:productId" element={<PublicProductDetails />} />
    <Route path="/shortlist" element={<Shortlist />} />
    
    {/* Scanner route - accessible without auth for QR scanning */}
    <Route path="/scan" element={<ScanQRCode />} />
    
    {/* Protected routes */}
    <Route path="/products" element={
      <SecureRoute>
        <ProductList />
      </SecureRoute>
    } />
    <Route path="/import" element={
      <SecureRoute>
        <ImportProducts />
      </SecureRoute>
    } />
    <Route path="/qr-codes" element={
      <SecureRoute>
        <QRCodes />
      </SecureRoute>
    } />
    <Route path="/catalog" element={
      <SecureRoute>
        <Catalog />
      </SecureRoute>
    } />
    <Route path="/print-tags" element={
      <SecureRoute>
        <PrintTags />
      </SecureRoute>
    } />
    <Route path="/showroom" element={
      <SecureRoute>
        <Showroom />
      </SecureRoute>
    } />
    <Route path="/showroom/:collectionId" element={
      <SecureRoute>
        <ShowroomCollection />
      </SecureRoute>
    } />
    
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading…</div>}>
            <AppRoutes />
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
