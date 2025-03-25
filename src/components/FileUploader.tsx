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
    // Check file size
    if (file.size > maxSize * 1024 * 1024) {
      toast.error(`File is too large. Maximum size is ${maxSize}MB.`);
      return false;
    }

    // For Excel files, check by both mime type and extension
    if (accept.includes('.xlsx') || accept.includes('.xls')) {
      const validExcelTypes = [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel.sheet.macroEnabled.12',
        'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
        'application/octet-stream',
        'application/binary'
      ];
      
      // Get file extension
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      
      console.log('Validating Excel file:', { 
        name: file.name, 
        type: file.type, 
        size: `${(file.size / (1024 * 1024)).toFixed(2)}MB`,
        extension: fileExt
      });
      
      if (
        (fileExt === 'xlsx' || fileExt === 'xls') || 
        validExcelTypes.includes(file.type)
      ) {
        return true;
      }
      
      toast.error(`Please upload a valid Excel file (.xlsx or .xls).`);
      return false;
    }
    
    // For other file types, check against the provided accept string
    if (!accept.split(",").some(type => {
      type = type.trim();
      // Check for wildcard MIME types (e.g., "image/*")
      if (type.includes("*")) {
        const baseMimeType = type.replace("*", "");
        return file.type.startsWith(baseMimeType);
      }
      // Check for file extensions (e.g., ".pdf")
      if (type.startsWith(".")) {
        return file.name.toLowerCase().endsWith(type.toLowerCase());
      }
      // Check exact MIME type match
      return type === file.type;
    })) {
      toast.error(`File type not supported. Please upload ${accept} files.`);
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
          File selected: {selectedFile.name}
        </p>
      )}
    </div>
  );
};

export default FileUploader;
