import ExcelJS from "exceljs";
import { MatchedItem } from "./catalogueProcessor";

const resizeImage = (file: File, maxWidth: number, maxHeight: number): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    img.onload = () => {
      canvas.width = maxWidth;
      canvas.height = maxHeight;

      if (ctx) {
        // Fill with white background
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, maxWidth, maxHeight);

        // Calculate dimensions to fit image while maintaining aspect ratio
        const scale = Math.min(maxWidth / img.width, maxHeight / img.height);
        const x = (maxWidth - img.width * scale) / 2;
        const y = (maxHeight - img.height * scale) / 2;

        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
      }

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to create image blob"));
          }
        },
        "image/jpeg",
        0.9
      );
    };

    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
};

export const generateExcel = async (items: MatchedItem[]): Promise<Blob> => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Catalogue");

  // Set column widths
  worksheet.columns = [
    { header: "Photo", key: "photo", width: 35 },
    { header: "Code", key: "code", width: 15 },
    { header: "Description", key: "description", width: 40 },
    { header: "Price", key: "price", width: 12 },
  ];

  // Style header row
  worksheet.getRow(1).font = { bold: true, size: 12 };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2D9CDB" },
  };
  worksheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };

  // Set row height for header
  worksheet.getRow(1).height = 20;

  // Add data rows with images
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const rowNumber = i + 2; // +2 because Excel is 1-indexed and we have header row

    // Set row height to accommodate 240px image (approximately 180 points)
    worksheet.getRow(rowNumber).height = 180;

    // Add text data
    const row = worksheet.getRow(rowNumber);
    row.getCell(1).value = ""; // Photo column
    row.getCell(2).value = item.CODE;
    row.getCell(3).value = item.DESCRIPTION || "—";
    row.getCell(4).value = 
      item.PRICE_A_INCL !== "" && item.PRICE_A_INCL !== null
        ? `R ${Number(item.PRICE_A_INCL).toFixed(2)}`
        : "—";

    // Center align all cells in this row
    row.alignment = { vertical: "middle", horizontal: "left" };

    // Add image if available
    if (item.photoFile) {
      try {
        // Resize image to 240x240
        const resizedBlob = await resizeImage(item.photoFile, 240, 240);
        const arrayBuffer = await resizedBlob.arrayBuffer();

        // Add image to workbook
        const imageId = workbook.addImage({
          buffer: arrayBuffer,
          extension: "jpeg",
        });

        // Add image to cell (row is 0-indexed for positioning)
        worksheet.addImage(imageId, {
          tl: { col: 0, row: rowNumber - 1 },
          ext: { width: 240, height: 240 },
          editAs: "oneCell",
        });
      } catch (error) {
        console.error("Failed to add image:", error);
      }
    }

    row.commit();
  }

  // Generate Excel file
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
};
