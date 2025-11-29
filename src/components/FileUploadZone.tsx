import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileSpreadsheet, Image } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadZoneProps {
  onFilesAccepted: (files: File[]) => void;
  accept: Record<string, string[]>;
  multiple?: boolean;
  label: string;
  description: string;
  icon?: "excel" | "image";
}

export const FileUploadZone = ({
  onFilesAccepted,
  accept,
  multiple = false,
  label,
  description,
  icon = "excel",
}: FileUploadZoneProps) => {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      onFilesAccepted(acceptedFiles);
    },
    [onFilesAccepted]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    multiple,
  });

  const IconComponent = icon === "excel" ? FileSpreadsheet : Image;

  return (
    <div
      {...getRootProps()}
      className={cn(
        "relative rounded-xl border-2 border-dashed transition-all duration-300 cursor-pointer overflow-hidden",
        isDragActive
          ? "border-primary bg-primary/5 scale-[1.02]"
          : "border-border bg-card hover:border-primary/50 hover:bg-card/80"
      )}
    >
      <input {...getInputProps()} />
      <div className="p-8 text-center">
        <div className="mx-auto w-16 h-16 mb-4 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
          {isDragActive ? (
            <Upload className="h-8 w-8 text-primary animate-bounce" />
          ) : (
            <IconComponent className="h-8 w-8 text-primary" />
          )}
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">{label}</h3>
        <p className="text-sm text-muted-foreground mb-4">{description}</p>
        <p className="text-xs text-muted-foreground">
          {isDragActive ? "Drop files here..." : "Click to browse or drag and drop"}
        </p>
      </div>
    </div>
  );
};
