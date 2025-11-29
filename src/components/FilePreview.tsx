import { X, FileSpreadsheet, Image as ImageIcon } from "lucide-react";
import { Button } from "./ui/button";

interface FilePreviewProps {
  files: File[];
  onRemove: (index: number) => void;
  type: "excel" | "images";
}

export const FilePreview = ({ files, onRemove, type }: FilePreviewProps) => {
  if (files.length === 0) return null;

  const Icon = type === "excel" ? FileSpreadsheet : ImageIcon;

  return (
    <div className="mt-4 space-y-2">
      <p className="text-sm font-medium text-foreground">
        {type === "excel" ? "Uploaded file:" : `${files.length} photo${files.length > 1 ? "s" : ""} uploaded:`}
      </p>
      <div className="grid gap-2">
        {files.map((file, index) => (
          <div
            key={index}
            className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border group hover:bg-secondary transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <Icon className="h-5 w-5 text-primary flex-shrink-0" />
              <span className="text-sm text-foreground truncate">{file.name}</span>
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {(file.size / 1024).toFixed(1)} KB
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemove(index)}
              className="opacity-0 group-hover:opacity-100 transition-opacity ml-2"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};
