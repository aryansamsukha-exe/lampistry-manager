
import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  Home, 
  Package, 
  Upload, 
  QrCode, 
  LogOut, 
  Menu, 
  X,
  User
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";

const Navbar: React.FC = () => {
  const { isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();

  const navItems = [
    { name: "Home", icon: <Home className="mr-2 h-4 w-4" />, path: "/" },
    { name: "Products", icon: <Package className="mr-2 h-4 w-4" />, path: "/products", auth: true },
    { name: "Import", icon: <Upload className="mr-2 h-4 w-4" />, path: "/import", auth: true },
    { name: "QR Codes", icon: <QrCode className="mr-2 h-4 w-4" />, path: "/qr-codes", auth: true },
  ];

  const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);

  return (
    <nav className="glass sticky top-0 z-50 w-full border-b border-border/40 backdrop-blur-md">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <QrCode className="h-8 w-8 text-primary" />
              <span className="text-xl font-semibold">LampQR</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-center space-x-4">
              {navItems.map((item) => 
                (!item.auth || isAuthenticated) && (
                  <Link 
                    key={item.name}
                    to={item.path}
                    className={`flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      location.pathname === item.path
                        ? "bg-primary/10 text-primary"
                        : "text-foreground/70 hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    {item.icon}
                    {item.name}
                  </Link>
                )
              )}
            </div>
          </div>

          <div className="hidden md:block">
            {isAuthenticated ? (
              <Button 
                variant="ghost" 
                className="flex items-center" 
                onClick={logout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            ) : (
              <Link to="/login">
                <Button variant="default" className="flex items-center">
                  <User className="mr-2 h-4 w-4" />
                  Login
                </Button>
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden">
            <button
              onClick={toggleMobileMenu}
              className="inline-flex items-center justify-center rounded-md p-2 text-foreground/70 hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" aria-hidden="true" />
              ) : (
                <Menu className="h-6 w-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMobile && mobileMenuOpen && (
        <div className="md:hidden glass animate-fade-in">
          <div className="px-2 pb-3 pt-2 flex flex-col space-y-1">
            {navItems.map((item) =>
              (!item.auth || isAuthenticated) && (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`flex items-center rounded-md px-3 py-2 text-base font-medium ${
                    location.pathname === item.path
                      ? "bg-primary/10 text-primary"
                      : "text-foreground/70 hover:bg-accent hover:text-foreground"
                  }`}
                  onClick={toggleMobileMenu}
                >
                  {item.icon}
                  {item.name}
                </Link>
              )
            )}
            {isAuthenticated ? (
              <Button 
                variant="ghost" 
                className="flex items-center justify-start" 
                onClick={() => {
                  logout();
                  toggleMobileMenu();
                }}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            ) : (
              <Link to="/login" onClick={toggleMobileMenu}>
                <Button variant="default" className="flex items-center w-full justify-start">
                  <User className="mr-2 h-4 w-4" />
                  Login
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
