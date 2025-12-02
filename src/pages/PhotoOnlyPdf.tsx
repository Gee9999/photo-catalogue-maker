import { useState } from "react";
import { FileUploadZone } from "@/components/FileUploadZone";
import { FilePreview } from "@/components/FilePreview";
import { Button } from "@/components/ui/button";
import { Download, Loader2, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { generatePhotoOnlyPDF } from "@/lib/photoOnlyPdfGenerator";
import { Link } from "react-router-dom";

const PhotoOnlyPdf = () => {
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const handlePhotoFilesAccepted = (files: File[]) => {
    setPhotoFiles((prev) => [...prev, ...files]);
  };

  const handleRemovePhoto = (index: number) => {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleGeneratePDF = async () => {
    if (photoFiles.length === 0) {
      toast({
        title: "No photos",
        description: "Please upload at least one photo.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const blob = await generatePhotoOnlyPDF(photoFiles);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "photo-catalogue.pdf";
      link.click();
      URL.revokeObjectURL(url);

      toast({
        title: "PDF Generated",
        description: "Your photo catalogue has been downloaded.",
      });
    } catch (error) {
      console.error("PDF generation failed:", error);
      toast({
        title: "Generation Failed",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Price Catalogue
        </Link>

        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Photo Only PDF
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Upload photos and generate a PDF catalogue without price matching.
          </p>
        </header>

        <div className="space-y-8">
          <div>
            <FileUploadZone
              onFilesAccepted={handlePhotoFilesAccepted}
              accept={{
                "image/*": [".jpg", ".jpeg", ".png", ".webp"],
              }}
              multiple={true}
              label="Upload Photos"
              description="Drop your product photos here"
              icon="image"
            />
            <FilePreview
              files={photoFiles}
              onRemove={handleRemovePhoto}
              type="images"
            />
          </div>

          <Button
            onClick={handleGeneratePDF}
            disabled={photoFiles.length === 0 || isGenerating}
            className="w-full"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Generating PDF...
              </>
            ) : (
              <>
                <Download className="mr-2 h-5 w-5" />
                Generate PDF ({photoFiles.length} photos)
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PhotoOnlyPdf;
