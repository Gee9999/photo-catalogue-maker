import { useState } from "react";
import { FileUploadZone } from "@/components/FileUploadZone";
import { FilePreview } from "@/components/FilePreview";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Download, FileText, Image as ImageIcon } from "lucide-react";
import {
  loadPriceFile,
  matchPhotosToPrice,
  type PriceData,
  type MatchedItem,
} from "@/lib/catalogueProcessor";
import { generatePDF } from "@/lib/pdfGenerator";
import { generateExcel } from "@/lib/excelGenerator";

const Index = () => {
  const [priceFile, setPriceFile] = useState<File | null>(null);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [matchedItems, setMatchedItems] = useState<MatchedItem[]>([]);
  const [minStock, setMinStock] = useState<number>(0);
  const { toast } = useToast();

  const handlePriceFileAccepted = (files: File[]) => {
    if (files.length > 0) {
      setPriceFile(files[0]);
      setMatchedItems([]);
      toast({
        title: "Price file uploaded",
        description: files[0].name,
      });
    }
  };

  const handlePhotoFilesAccepted = (files: File[]) => {
    setPhotoFiles((prev) => [...prev, ...files]);
    setMatchedItems([]);
    toast({
      title: `${files.length} photo${files.length > 1 ? "s" : ""} added`,
      description: "Ready to process",
    });
  };

  const removePriceFile = () => {
    setPriceFile(null);
    setMatchedItems([]);
  };

  const removePhotoFile = (index: number) => {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
    setMatchedItems([]);
  };

  const handleProcess = async () => {
    if (!priceFile) {
      toast({
        title: "Missing price file",
        description: "Please upload a price Excel file first",
        variant: "destructive",
      });
      return;
    }

    if (photoFiles.length === 0) {
      toast({
        title: "No photos uploaded",
        description: "Please upload at least one product photo",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      const priceData: PriceData[] = await loadPriceFile(priceFile);
      
      // Filter by minimum stock FIRST
      const filteredByStock = priceData.filter((item) => {
        const stock = typeof item.ON_HAND_STOCK === "number" 
          ? item.ON_HAND_STOCK 
          : parseFloat(String(item.ON_HAND_STOCK)) || 0;
        return stock >= minStock;
      });
      
      console.log(`Total Excel items: ${priceData.length}, After stock filter (>=${minStock}): ${filteredByStock.length}`);
      
      // Match photos to the filtered items (includes items without photos)
      const matched = matchPhotosToPrice(photoFiles, filteredByStock);
      
      setMatchedItems(matched);

      const withPhotos = matched.filter(m => m.photoFile).length;
      const withoutPhotos = matched.filter(m => !m.photoFile).length;

      toast({
        title: "Processing complete!",
        description: `${matched.length} items with stock ≥ ${minStock} (${withPhotos} with photos, ${withoutPhotos} without photos)`,
      });
    } catch (error) {
      toast({
        title: "Processing failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (matchedItems.length === 0) return;

    setIsProcessing(true);
    try {
      const pdfBlob = await generatePDF(matchedItems);
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "photo_catalogue.pdf";
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: "PDF downloaded",
        description: "Your photo catalogue is ready",
      });
    } catch (error) {
      toast({
        title: "PDF generation failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadExcel = async () => {
    if (matchedItems.length === 0) return;

    setIsProcessing(true);
    try {
      const excelBlob = await generateExcel(matchedItems);
      const url = URL.createObjectURL(excelBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "catalogue.xlsx";
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: "Excel downloaded",
        description: "Your catalogue spreadsheet with images is ready",
      });
    } catch (error) {
      toast({
        title: "Excel generation failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-6xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12 space-y-4">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            Photo Catalogue Builder
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Upload your price Excel and product photos. We'll automatically match them and generate
            a professional PDF catalogue and Excel file.
          </p>
        </div>

        {/* Upload Section */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="p-6 bg-gradient-to-br from-card to-card/80 shadow-lg">
            <FileUploadZone
              onFilesAccepted={handlePriceFileAccepted}
              accept={{
                "application/vnd.ms-excel": [".xls"],
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
              }}
              label="Price Excel File"
              description="Upload your product details Excel file (CODE, DESCRIPTION, PRICE-A INCL)"
              icon="excel"
            />
            {priceFile && (
              <FilePreview files={[priceFile]} onRemove={removePriceFile} type="excel" />
            )}
          </Card>

          <Card className="p-6 bg-gradient-to-br from-card to-card/80 shadow-lg">
            <FileUploadZone
              onFilesAccepted={handlePhotoFilesAccepted}
              accept={{
                "image/jpeg": [".jpg", ".jpeg"],
                "image/png": [".png"],
              }}
              multiple
              label="Product Photos"
              description="Upload photos with product codes in filenames (e.g., 8613900001.jpg)"
              icon="image"
            />
            {photoFiles.length > 0 && (
              <FilePreview files={photoFiles} onRemove={removePhotoFile} type="images" />
            )}
          </Card>
        </div>

        {/* Stock Filter & Process Button */}
        <Card className="p-6 bg-gradient-to-br from-card to-card/80 shadow-lg mb-8">
          <div className="flex flex-col md:flex-row items-center justify-center gap-6">
            <div className="flex-1 max-w-xs">
              <label className="block">
                <span className="text-sm font-semibold mb-2 block">
                  Minimum Stock Filter
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={minStock}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    setMinStock(val === '' ? 0 : Number(val));
                  }}
                  className="w-full px-4 py-2.5 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent text-center text-lg font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="0"
                />
                <span className="text-xs text-muted-foreground mt-1.5 block text-center">
                  Only show items with {minStock}+ units in stock
                </span>
              </label>
            </div>
            
            <Button
              onClick={handleProcess}
              disabled={!priceFile || photoFiles.length === 0 || isProcessing}
              size="lg"
              className="bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity text-lg px-8 py-6"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Processing...
                </>
              ) : (
                "Generate Catalogue"
              )}
            </Button>
          </div>
        </Card>

        {/* Results Section */}
        {matchedItems.length > 0 && (
          <Card className="p-6 bg-gradient-to-br from-card to-card/80 shadow-lg space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-4">Matched Items Preview</h2>
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Photo</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Code</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Description</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Price</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold">Stock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {matchedItems.map((item, index) => (
                        <tr key={index} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3">
                            {item.photoUrl && (
                              <img
                                src={item.photoUrl}
                                alt={item.CODE}
                                className="h-12 w-12 object-cover rounded"
                              />
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm font-mono">{item.CODE}</td>
                          <td className="px-4 py-3 text-sm">{item.DESCRIPTION || "—"}</td>
                          <td className="px-4 py-3 text-sm">
                            {item.PRICE_A_INCL !== "" && item.PRICE_A_INCL !== null
                              ? `R ${Number(item.PRICE_A_INCL).toFixed(2)}`
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {item.ON_HAND_STOCK !== "" && item.ON_HAND_STOCK !== null
                              ? Number(item.ON_HAND_STOCK).toFixed(0)
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Download Buttons */}
            <div className="flex flex-wrap gap-4 justify-center pt-4">
              <Button
                onClick={handleDownloadPDF}
                disabled={isProcessing}
                variant="default"
                size="lg"
                className="bg-gradient-to-r from-primary to-accent"
              >
                <FileText className="mr-2 h-5 w-5" />
                Download PDF Catalogue
              </Button>
              <Button onClick={handleDownloadExcel} variant="outline" size="lg">
                <Download className="mr-2 h-5 w-5" />
                Download Excel
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Index;
