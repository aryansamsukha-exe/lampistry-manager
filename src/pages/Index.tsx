
import React from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { QrCode, Package, Upload, ArrowRight } from "lucide-react";

const Index: React.FC = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: <Upload className="h-10 w-10 text-primary" />,
      title: "Easy Import",
      description: "Quickly duct data from Excel spreadsheets animport prod upload product images."
    },
    {
      icon: <Package className="h-10 w-10 text-primary" />,
      title: "Product Management",
      description: "Organize and search through your entire inventory with an intuitive interface."
    },
    {
      icon: <QrCode className="h-10 w-10 text-primary" />,
      title: "QR Code Generation",
      description: "Generate QR codes for all your products and download them individually or in bulk."
    }
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-b from-secondary/50 to-background py-16 md:py-24">
          <div className="container px-4 md:px-6">
            <div className="grid gap-6 lg:grid-cols-2 lg:gap-12 items-center">
              <div className="space-y-4 animate-slide-in">
                <div className="inline-block rounded-lg bg-primary/10 px-3 py-1 text-sm text-primary">
                  IHGF Exhibition Delhi
                </div>
                <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
                  Manage Your Products with Ease
                </h1>
                <p className="text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  Simplify product management, pricing, and QR code generation for your wooden, iron, and sustainable products business.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button size="lg" onClick={() => navigate("/login")}>
                    Get Started
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => navigate("/login")}>
                    Learn More
                  </Button>
                </div>
              </div>
              <div className="flex justify-center lg:justify-end animate-float">
                <div className="relative w-full max-w-[400px] aspect-video rounded-lg overflow-hidden shadow-2xl">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-primary/5 rounded-lg"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <QrCode className="h-24 w-24 text-primary" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-16 md:py-24">
          <div className="container px-4 md:px-6">
            <div className="text-center max-w-[800px] mx-auto mb-12">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
                Powerful Product Management
              </h2>
              <p className="mt-4 text-muted-foreground md:text-xl">
                All the tools you need to showcase your products at the Exhibitions
              </p>
            </div>
            <div className="grid gap-8 md:grid-cols-3">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="flex flex-col items-center p-6 glass rounded-lg text-center transition-all hover:shadow-lg"
                >
                  <div className="mb-4 rounded-full bg-primary/10 p-4">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-bold">{feature.title}</h3>
                  <p className="mt-2 text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 md:py-24 bg-primary/5">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center text-center space-y-6 md:space-y-8">
              <div className="space-y-3">
                <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
                  Ready to Simplify Your Exhibition?
                </h2>
                <p className="text-muted-foreground md:text-xl max-w-[700px] mx-auto">
                  Get started with Product Manager today and make managing your lamp products at Exhibitions easier than ever.
                </p>
              </div>
              <Button size="lg" onClick={() => navigate("/login")}>
                Get Started Now
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-background/50 backdrop-blur-sm">
        <div className="container px-4 py-6 md:px-6 md:py-8">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-2">
              <QrCode className="h-6 w-6 text-primary" />
              <span className="text-lg font-semibold">ProductMaster</span>
            </div>
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} ProductMaster. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
