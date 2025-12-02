import { jsPDF } from "jspdf";
import { MatchedItem } from "./catalogueProcessor";

const loadImage = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
};

export const generatePDF = async (items: MatchedItem[]): Promise<Blob> => {
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
  const textLineH = 5;
  const blockH = photoH + textLineH * 3 + 8;

  const pageH = pdf.internal.pageSize.getHeight();
  const pageW = pdf.internal.pageSize.getWidth();

  const colGap = 10;
  const usableW = pageW - 2 * marginX;
  const colW = (usableW - colGap) / 2;

  const xLeft = marginX;
  const xRight = marginX + colW + colGap;

  let currentCol = 0;

  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");

  for (const item of items) {
    // Loop through all photos for this item
    const photosToRender = item.photoUrls.length > 0 ? item.photoUrls : [null];
    
    for (const photoUrl of photosToRender) {
      if (currentY + blockH > pageH - 15) {
        pdf.addPage();
        currentY = 15;
        currentCol = 0;
      }

      const x = currentCol === 0 ? xLeft : xRight;

      // Add image
      if (photoUrl) {
        try {
          const img = await loadImage(photoUrl);
          pdf.addImage(img, "JPEG", x, currentY, photoW, photoH);
        } catch (error) {
          console.error("Failed to load image:", error);
        }
      }

      // Add text
      const textY = currentY + photoH + 3;
      pdf.setFont("helvetica", "bold");
      pdf.text(`Code: ${item.CODE}`, x, textY);

      pdf.setFont("helvetica", "normal");
      const desc = item.DESCRIPTION || "No description";
      const descLines = pdf.splitTextToSize(desc, photoW);
      pdf.text(descLines[0], x, textY + textLineH);

      const priceText =
        item.PRICE_A_INCL !== "" && item.PRICE_A_INCL !== null
          ? `Price: R ${Number(item.PRICE_A_INCL).toFixed(2)}`
          : "Price: N/A";
      pdf.text(priceText, x, textY + textLineH * 2);

      if (currentCol === 0) {
        currentCol = 1;
      } else {
        currentCol = 0;
        currentY += blockH;
      }
    }
  }

  return pdf.output("blob");
};
