
import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Upload, X, FileText } from "lucide-react";

interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  accept: string;
  maxSize?: number; // in MB
  label: string;
}

const FileUploader: React.FC<FileUploaderProps> = ({
  onFileSelect,
  accept,
  maxSize = 10, // Default max size: 10MB
  label,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const validateFile = (file: File): boolean => {
    // Check file type
    if (!accept.split(",").some(type => {
      return type.trim() === file.type || 
             (type.includes("*") && file.type.startsWith(type.replace("*", "")));
    })) {
      toast.error(`File type not supported. Please upload ${accept} files.`);
      return false;
    }

    // Check file size
    if (file.size > maxSize * 1024 * 1024) {
      toast.error(`File is too large. Maximum size is ${maxSize}MB.`);
      return false;
    }

    return true;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (validateFile(file)) {
        setSelectedFile(file);
        onFileSelect(file);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (validateFile(file)) {
        setSelectedFile(file);
        onFileSelect(file);
      }
    }
  };

  const handleButtonClick = () => {
    inputRef.current?.click();
  };

  const clearSelection = () => {
    setSelectedFile(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <div className="w-full">
      <div
        className={`relative flex flex-col items-center justify-center w-full p-6 border-2 border-dashed rounded-lg transition-all ${
          dragActive ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/50"
        } ${selectedFile ? "bg-secondary/50" : ""}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={accept}
          onChange={handleChange}
        />

        {selectedFile ? (
          <div className="flex flex-col items-center gap-2 w-full">
            <FileText className="h-10 w-10 text-primary" />
            <p className="font-medium text-center break-all">{selectedFile.name}</p>
            <p className="text-sm text-muted-foreground">
              {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2 gap-1"
              onClick={clearSelection}
            >
              <X className="h-4 w-4" />
              Remove
            </Button>
          </div>
        ) : (
          <>
            <Upload className="h-10 w-10 text-muted-foreground mb-2" />
            <p className="mb-2 text-sm font-medium text-center">{label}</p>
            <p className="mb-4 text-xs text-muted-foreground text-center">
              Drag & drop or click to browse
            </p>
            <Button 
              type="button" 
              variant="outline" 
              size="sm"
              onClick={handleButtonClick}
            >
              Select File
            </Button>
          </>
        )}
      </div>
      {selectedFile && (
        <p className="text-sm text-center mt-2 text-muted-foreground">
          Click "Upload" to continue
        </p>
      )}
    </div>
  );
};

export default FileUploader;
