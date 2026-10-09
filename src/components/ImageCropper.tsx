import React, { useEffect, useRef, useState } from "react";
import ReactCrop, { centerCrop, makeAspectCrop, type PercentCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Button } from "@/components/ui/button";
import { Crop, ImageIcon, Loader } from "lucide-react";

const ASPECTS: { label: string; value?: number }[] = [
  { label: "4:3 (card)", value: 4 / 3 },
  { label: "1:1", value: 1 },
  { label: "3:4", value: 3 / 4 },
  { label: "16:9", value: 16 / 9 },
  { label: "Free" },
];

const initialCrop = (aspect: number | undefined, width: number, height: number): PercentCrop =>
  aspect
    ? centerCrop(makeAspectCrop({ unit: "%", width: 90 }, aspect, width, height), width, height)
    : { unit: "%", x: 5, y: 5, width: 90, height: 90 };

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

/** Crops at the image's full resolution, keeping PNG/WebP formats and using high-quality JPEG otherwise. */
const cropToDataUrl = (image: HTMLImageElement, crop: PercentCrop, fileType: string) => {
  const sx = (crop.x / 100) * image.naturalWidth;
  const sy = (crop.y / 100) * image.naturalHeight;
  const sw = (crop.width / 100) * image.naturalWidth;
  const sh = (crop.height / 100) * image.naturalHeight;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sw));
  canvas.height = Math.max(1, Math.round(sh));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported");

  const type = fileType === "image/png" || fileType === "image/webp" ? fileType : "image/jpeg";
  if (type === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL(type, 0.95);
};

interface ImageCropperProps {
  file: File;
  isSaving?: boolean;
  onCancel: () => void;
  onSave: (imageDataUrl: string) => void;
}

const ImageCropper: React.FC<ImageCropperProps> = ({ file, isSaving = false, onCancel, onSave }) => {
  const [src, setSrc] = useState("");
  const [aspect, setAspect] = useState<number | undefined>(ASPECTS[0].value);
  const [crop, setCrop] = useState<PercentCrop>();
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const resetCrop = (nextAspect: number | undefined) => {
    const image = imageRef.current;
    if (image) setCrop(initialCrop(nextAspect, image.width, image.height));
  };

  const chooseAspect = (value: number | undefined) => {
    setAspect(value);
    resetCrop(value);
  };

  const saveCropped = () => {
    if (!imageRef.current || !crop?.width || !crop?.height) return;
    onSave(cropToDataUrl(imageRef.current, crop, file.type));
  };

  const saveOriginal = async () => onSave(await readAsDataUrl(file));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {ASPECTS.map((option) => (
          <Button
            key={option.label}
            type="button"
            size="sm"
            variant={aspect === option.value ? "default" : "outline"}
            onClick={() => chooseAspect(option.value)}
            disabled={isSaving}
          >
            {option.label}
          </Button>
        ))}
      </div>

      <div className="flex justify-center rounded-md bg-muted p-2">
        {src && (
          <ReactCrop crop={crop} aspect={aspect} onChange={(_, percent) => setCrop(percent)} keepSelection>
            <img
              ref={imageRef}
              src={src}
              alt="Crop preview"
              className="max-h-[55vh] w-auto"
              onLoad={() => resetCrop(aspect)}
            />
          </ReactCrop>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Drag the box to move it and drag its corners to resize. The crop is saved at full resolution.
      </p>

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isSaving}>
          Choose another image
        </Button>
        <Button type="button" variant="outline" onClick={saveOriginal} disabled={isSaving} className="gap-2">
          <ImageIcon className="h-4 w-4" />
          Use full image
        </Button>
        <Button type="button" onClick={saveCropped} disabled={isSaving || !crop?.width} className="gap-2">
          {isSaving ? <Loader className="h-4 w-4 animate-spin" /> : <Crop className="h-4 w-4" />}
          Save cropped image
        </Button>
      </div>
    </div>
  );
};

export default ImageCropper;
