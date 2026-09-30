
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ReactNode, useEffect } from "react";
import Index from "./pages/Index";
import Login from "./pages/Login";
import ProductList from "./pages/ProductList";
import ImportProducts from "./pages/ImportProducts";
import QRCodes from "./pages/QRCodes";
import ScanQRCode from "./pages/ScanQRCode";
import NotFound from "./pages/NotFound";
import PublicProductDetails from "./pages/PublicProductDetails";
import Catalog from "./pages/Catalog";

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
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
