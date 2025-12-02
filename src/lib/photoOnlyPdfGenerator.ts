import { jsPDF } from "jspdf";

const loadImage = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
};

export const generatePhotoOnlyPDF = async (photoFiles: File[]): Promise<Blob> => {
  const pdf = new jsPDF({
    unit: "mm",
    format: "a4",
  });

  // Title
  pdf.setFontSize(18);
  pdf.setFont("helvetica", "bold");
  pdf.text("Photo Catalogue", 105, 15, { align: "center" });

  const marginX = 10;
  let currentY = 25;

  const photoW = 60;
  const photoH = 60;
  const blockH = photoH + 10;

  const pageH = pdf.internal.pageSize.getHeight();
  const pageW = pdf.internal.pageSize.getWidth();

  const colGap = 10;
  const usableW = pageW - 2 * marginX;
  const colW = (usableW - colGap) / 2;

  const xLeft = marginX;
  const xRight = marginX + colW + colGap;

  let currentCol = 0;

  for (const photo of photoFiles) {
    if (currentY + blockH > pageH - 15) {
      pdf.addPage();
      currentY = 15;
      currentCol = 0;
    }

    const x = currentCol === 0 ? xLeft : xRight;

    try {
      const photoUrl = URL.createObjectURL(photo);
      const img = await loadImage(photoUrl);
      pdf.addImage(img, "JPEG", x, currentY, photoW, photoH);
      URL.revokeObjectURL(photoUrl);
    } catch (error) {
      console.error("Failed to load image:", error);
    }

    if (currentCol === 0) {
      currentCol = 1;
    } else {
      currentCol = 0;
      currentY += blockH;
    }
  }

  return pdf.output("blob");
};
