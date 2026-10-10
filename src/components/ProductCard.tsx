
import React, { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QrCode, Download, ImageIcon, Info, Upload, Trash2, Pencil, Save, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import FileUploader from "@/components/FileUploader";
import ImageCropper from "@/components/ImageCropper";
import { saveProductImage, deleteProduct, updateProduct, type ProductEdits } from "@/services/productService";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRODUCT_CATEGORIES } from "@/lib/productCategories";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export type Product = {
  id: string;
  sno: number;
  product_code: string;
  dimensions?: string;  // Kept for backward compatibility
  length?: string;      // Added length field
  width?: string;       // Added width field (renamed from breadth for consistency)
  height?: string;      // Height field
  price: number;
  cbm: string;
  description: string;
  category?: string;
  finish?: string;
  packing_length?: string;
  packing_width?: string;
  packing_height?: string;
  net_weight?: string;
  imageUrl?: string;
  import_batch_id?: string | null;
  created_at?: string;
};

interface ProductCardProps {
  product: Product;
  onDownloadQR: (product: Product) => void;
  onImageUpdate?: () => void; // Callback to refresh product list after image update
  onProductDelete?: () => void; // Callback to refresh product list after deletion
  onProductUpdate?: (product: Product) => void;
}

type EditForm = Record<keyof ProductEdits, string>;

const toEditForm = (product: Product): EditForm => ({
  description: product.description ?? "",
  price: String(product.price ?? 0),
  length: product.length ?? "",
  width: product.width ?? "",
  height: product.height ?? "",
  category: product.category ?? "",
  finish: product.finish ?? "",
  packing_length: product.packing_length ?? "",
  packing_width: product.packing_width ?? "",
  packing_height: product.packing_height ?? "",
  net_weight: product.net_weight ?? "",
});

const ProductCard: React.FC<ProductCardProps> = ({ product, onDownloadQR, onImageUpdate, onProductDelete, onProductUpdate }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<EditForm>(() => toEditForm(product));

  const startEditing = () => {
    setForm(toEditForm(product));
    setIsEditing(true);
  };

  const setField = (key: keyof EditForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((current) => ({ ...current, [key]: e.target.value }));

  const handleSave = async () => {
    const price = form.price.trim() === "" ? 0 : Number(form.price);
    if (!Number.isFinite(price) || price < 0) {
      toast.error("Please enter a valid price");
      return;
    }
    setIsSaving(true);
    try {
      const updated = await updateProduct(product, { ...form, price });
      toast.success(`${product.product_code} updated`);
      setIsEditing(false);
      onProductUpdate?.(updated);
    } catch {
      toast.error("Failed to update product");
    } finally {
      setIsSaving(false);
    }
  };
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [fileToCrop, setFileToCrop] = useState<File | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const productImage = product.imageUrl || "/placeholder.svg";
  
  const closeImageUpload = (open: boolean) => {
    setShowImageUpload(open);
    if (!open) setFileToCrop(null);
  };

  const handleImageSave = async (imageDataUrl: string) => {
    setIsUploading(true);
    try {
      await saveProductImage(product.product_code, imageDataUrl);
      toast.success("Image uploaded successfully");
      closeImageUpload(false);
      onImageUpdate?.();
    } catch (error) {
      console.error("Failed to save image:", error);
      toast.error("Failed to save image");
    } finally {
      setIsUploading(false);
    }
  };
  
  const handleDeleteProduct = async () => {
    if (!product.id) {
      toast.error("Product ID is missing");
      return;
    }
    
    setIsDeleting(true);
    try {
      const success = await deleteProduct(product.id);
      if (success) {
        setShowDeleteConfirm(false);
        setShowDetails(false);
        
        // Call onProductDelete only once to update the parent component
        if (onProductDelete) {
          toast.success("Product deleted successfully");
          onProductDelete();
        }
      }
    } catch (error) {
      console.error("Failed to delete product:", error);
      toast.error("Failed to delete product");
    } finally {
      setIsDeleting(false);
    }
  };

  // Format dimensions for display in the standardized format "length × width × height"
  const getDimensionsDisplay = () => {
    if (product.length && product.width && product.height) {
      return `${product.length} × ${product.width} × ${product.height}`;
    } else if (product.dimensions) {
      return product.dimensions;
    }
    return "N/A";
  };

  return (
    <>
      <Card className="overflow-hidden transition-all hover:shadow-md">
        <CardHeader className="p-0 relative">
          <div className="image-container w-full">
            <AspectRatio ratio={4/3} className={product.imageUrl ? "bg-white" : "bg-secondary"}>
              <img
                src={productImage}
                alt={product.product_code}
                loading="lazy"
                decoding="async"
                className={product.imageUrl ? "object-contain w-full h-full" : "object-cover w-full h-full"}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/placeholder.svg";
                }}
              />
            </AspectRatio>
            <Button 
              variant="ghost" 
              size="icon"
              className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm hover:bg-background/90"
              onClick={() => setShowImageUpload(true)}
            >
              <Upload className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <CardTitle className="text-lg font-medium mb-2">{product.product_code}</CardTitle>
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm text-muted-foreground">
              {getDimensionsDisplay()}
            </span>
            <span className="font-medium">${product.price.toFixed(2)}</span>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {product.description || "No description available."}
          </p>
        </CardContent>
        <CardFooter className="flex justify-between p-4 pt-0">
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => setShowDetails(true)}
          >
            <Info className="h-4 w-4" />
            Details
          </Button>
          <Button
            variant="default"
            size="sm"
            className="gap-1"
            onClick={() => onDownloadQR(product)}
          >
            <QrCode className="h-4 w-4" />
            QR Code
          </Button>
        </CardFooter>
      </Card>

      <Dialog
        open={showDetails}
        onOpenChange={(open) => {
          setShowDetails(open);
          if (!open) setIsEditing(false);
        }}
      >
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">{isEditing ? `Edit ${product.product_code}` : "Product Details"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="mx-auto w-full max-w-[320px]">
              {product.imageUrl ? (
                <AspectRatio ratio={4/3} className="bg-white border rounded-md overflow-hidden">
                  <img
                    src={product.imageUrl}
                    alt={product.product_code}
                    className="object-contain w-full h-full"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/placeholder.svg";
                    }}
                  />
                </AspectRatio>
              ) : (
                <div className="flex items-center justify-center bg-secondary rounded-md aspect-[4/3]">
                  <ImageIcon className="h-12 w-12 text-muted-foreground" />
                </div>
              )}
            </div>
            
            <Separator />
            
            {isEditing ? (
              <div className="grid gap-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Product Code</Label>
                    <Input value={product.product_code} disabled />
                  </div>
                  <div>
                    <Label htmlFor={`price-${product.id}`} className="text-xs">Price (USD)</Label>
                    <Input id={`price-${product.id}`} type="number" min="0" step="0.01" value={form.price} onChange={setField("price")} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Item Size (L × W × H)</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Input placeholder="L" value={form.length} onChange={setField("length")} />
                    <Input placeholder="W" value={form.width} onChange={setField("width")} />
                    <Input placeholder="H" value={form.height} onChange={setField("height")} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Packing Size (L × W × H)</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Input placeholder="L" value={form.packing_length} onChange={setField("packing_length")} />
                    <Input placeholder="W" value={form.packing_width} onChange={setField("packing_width")} />
                    <Input placeholder="H" value={form.packing_height} onChange={setField("packing_height")} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Category</Label>
                  <Select value={form.category} onValueChange={(category) => setForm((current) => ({ ...current, category }))}>
                    <SelectTrigger><SelectValue placeholder="Choose a category" /></SelectTrigger>
                    <SelectContent>
                      {PRODUCT_CATEGORIES.map((category) => (
                        <SelectItem key={category} value={category}>{category}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor={`finish-${product.id}`} className="text-xs">Finish</Label>
                    <Input id={`finish-${product.id}`} value={form.finish} onChange={setField("finish")} />
                  </div>
                  <div>
                    <Label htmlFor={`weight-${product.id}`} className="text-xs">Net Weight</Label>
                    <Input id={`weight-${product.id}`} value={form.net_weight} onChange={setField("net_weight")} />
                  </div>
                </div>
                <div>
                  <Label htmlFor={`desc-${product.id}`} className="text-xs">Description</Label>
                  <Textarea id={`desc-${product.id}`} rows={3} value={form.description} onChange={setField("description")} />
                </div>
                <p className="text-xs text-muted-foreground">CBM is recalculated from the packing size (or item size if there is no packing size).</p>
              </div>
            ) : (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="font-medium">Product Code:</div>
              <div>{product.product_code}</div>
              
              <div className="font-medium">Serial Number:</div>
              <div>{product.sno}</div>
              
              {/* Display dimensions separately if available */}
              {product.length && (
                <>
                  <div className="font-medium">Length:</div>
                  <div>{product.length}</div>
                </>
              )}
              
              {product.width && (
                <>
                  <div className="font-medium">Width:</div>
                  <div>{product.width}</div>
                </>
              )}
              
              {product.height && (
                <>
                  <div className="font-medium">Height:</div>
                  <div>{product.height}</div>
                </>
              )}
              
              {/* Display legacy dimensions if separate dimensions not available */}
              {!product.length && !product.width && !product.height && product.dimensions && (
                <>
                  <div className="font-medium">Dimensions:</div>
                  <div>{product.dimensions}</div>
                </>
              )}
              
              {product.packing_length && product.packing_width && product.packing_height && (
                <>
                  <div className="font-medium">Packing Size:</div>
                  <div>{`${product.packing_length} × ${product.packing_width} × ${product.packing_height}`}</div>
                </>
              )}

              {product.category && (
                <>
                  <div className="font-medium">Category:</div>
                  <div>{product.category}</div>
                </>
              )}

              {product.finish && (
                <>
                  <div className="font-medium">Finish:</div>
                  <div>{product.finish}</div>
                </>
              )}

              {product.net_weight && (
                <>
                  <div className="font-medium">Net Weight:</div>
                  <div>{product.net_weight}</div>
                </>
              )}

              <div className="font-medium">Price:</div>
              <div>${product.price.toFixed(2)}</div>
              
              <div className="font-medium">CBM:</div>
              <div>{product.cbm}</div>
              
              <div className="font-medium col-span-2">Description:</div>
              <div className="col-span-2">{product.description || "No description available."}</div>
            </div>
            )}
            
            <Separator />
            
            {isEditing ? (
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditing(false)} disabled={isSaving} className="gap-2">
                <X className="h-4 w-4" />
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                <Save className="h-4 w-4" />
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
            ) : (
            <div className="flex flex-wrap justify-between gap-2">
              <Button
                variant="outline"
                onClick={() => onDownloadQR(product)}
                className="flex items-center justify-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download QR Code
              </Button>

              <Button variant="outline" onClick={startEditing} className="flex items-center justify-center gap-2">
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
              
              <Button
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center justify-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Delete Product
              </Button>
            </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showImageUpload} onOpenChange={closeImageUpload}>
        <DialogContent className={fileToCrop ? "sm:max-w-[760px] max-h-[95vh] overflow-y-auto" : "sm:max-w-[400px]"}>
          <DialogHeader>
            <DialogTitle>{fileToCrop ? `Crop image for ${product.product_code}` : "Upload Product Image"}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {fileToCrop ? (
              <ImageCropper
                file={fileToCrop}
                isSaving={isUploading}
                onCancel={() => setFileToCrop(null)}
                onSave={handleImageSave}
              />
            ) : (
              <FileUploader
                onFileSelect={setFileToCrop}
                accept="image/*"
                label={`Upload image for ${product.product_code}`}
                maxSize={Infinity}
                isLoading={isUploading}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this product?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete product <strong>{product.product_code}</strong> and all associated data, including images. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                handleDeleteProduct();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>Deleting...</>
              ) : (
                <>Delete</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ProductCard;
