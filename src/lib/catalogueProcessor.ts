import * as XLSX from "xlsx";

export interface PriceData {
  CODE: string;
  DESCRIPTION: string;
  PRICE_A_INCL: number | string;
  ON_HAND_STOCK: number | string;
}

export interface MatchedItem {
  CODE: string;
  DESCRIPTION: string;
  PRICE_A_INCL: number | string;
  ON_HAND_STOCK: number | string;
  photoFiles: File[];
  photoUrls: string[];
}

const normCol = (colName: string): string => {
  return colName.toUpperCase().replace(/[^A-Z0-9]/g, "");
};

const cleanCode = (val: any): string => {
  // Keep alphanumeric characters, convert to uppercase for case-insensitive matching
  const s = String(val)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return s;
};

export const loadPriceFile = async (file: File): Promise<PriceData[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        if (jsonData.length < 2) {
          reject(new Error("Excel file is empty or has no data rows"));
          return;
        }

        // Find the header row by looking for a row that contains "CODE" or similar
        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(20, jsonData.length); i++) {
          const row = jsonData[i];
          if (!row) continue;
          const rowStr = row.map((cell: any) => normCol(String(cell || ""))).join(",");
          if (rowStr.includes("CODE") || rowStr.includes("ITEMCODE") || rowStr.includes("STOCKCODE")) {
            headerRowIndex = i;
            break;
          }
        }

        const headers = jsonData[headerRowIndex];
        const normMap: Record<string, string> = {};
        headers.forEach((header: any, idx: number) => {
          normMap[idx] = normCol(String(header));
        });

        const findCol = (target: string): number | null => {
          for (const [idx, norm] of Object.entries(normMap)) {
            if (norm === target) return parseInt(idx);
          }
          return null;
        };

        const codeCol = findCol("CODE") ?? findCol("ITEMCODE") ?? findCol("PRODUCTCODE") ?? findCol("STOCKCODE");
        if (codeCol === null) {
          const foundColumns = headers.map((h: any) => String(h)).join(", ");
          reject(new Error(`Could not find CODE column in Excel. Found columns: ${foundColumns}`));
          return;
        }

        const descCol = findCol("DESCRIPTION");
        if (descCol === null) {
          reject(new Error("Could not find DESCRIPTION column in Excel"));
          return;
        }

        let priceCol = null;
        for (const target of ["PRICEAINCL", "PRICEAINCLINC", "PRICEAINCLINCL"]) {
          priceCol = findCol(target);
          if (priceCol !== null) break;
        }
        if (priceCol === null) {
          reject(new Error("Could not find PRICE-A INCL column in Excel"));
          return;
        }

        let stockCol = null;
        for (const target of ["ONHANDSTOCK", "ONHAND", "STOCK", "ONHANDSTOCKQTY"]) {
          stockCol = findCol(target);
          if (stockCol !== null) break;
        }
        if (stockCol === null) {
          reject(new Error("Could not find ON-HAND STOCK column in Excel (typically column K)"));
          return;
        }

        const results: PriceData[] = [];

        for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length === 0) continue;

          let code = row[codeCol];
          const desc = row[descCol];
          let price = row[priceCol];
          let stock = row[stockCol];

          if (!code) continue;
          
          // Trim whitespace from code
          code = String(code).trim();

          // Clean price if it's a string
          if (typeof price === "string") {
            price = price.replace(/R/g, "").replace(/,/g, "").trim();
            price = parseFloat(price);
          }

          // Clean stock if it's a string
          if (typeof stock === "string") {
            stock = stock.replace(/,/g, "").trim();
            stock = parseFloat(stock);
          }

          results.push({
            CODE: code,
            DESCRIPTION: String(desc || ""),
            PRICE_A_INCL: isNaN(price) ? "" : price,
            ON_HAND_STOCK: isNaN(stock) ? 0 : stock,
          });
        }

        resolve(results);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error("Failed to read Excel file"));
    reader.readAsBinaryString(file);
  });
};

export const matchPhotosToPrice = (
  photoFiles: File[],
  priceData: PriceData[]
): MatchedItem[] => {
  // Build a set of all Excel codes for lookup
  const excelCodeSet = new Set<string>();
  priceData.forEach((item) => {
    const cleaned = cleanCode(item.CODE);
    if (cleaned) excelCodeSet.add(cleaned);
  });

  // Helper: strip trailing letters from code (e.g., "8610100024N" -> "8610100024")
  const stripTrailingLetters = (code: string): string => {
    return code.replace(/[A-Z]+$/, "");
  };

  // Build photo lookup map - extract code from part before dash
  // If exact code doesn't exist in Excel, try base code without trailing letters
  const photoMap: Record<string, File[]> = {};
  
  photoFiles.forEach((photo) => {
    const nameWithoutExt = photo.name.replace(/\.[^/.]+$/, "");
    // Get part before dash, or full name if no dash
    const codeFromFilename = nameWithoutExt.split("-")[0];
    let cleanedCode = cleanCode(codeFromFilename);
    
    if (!cleanedCode) return;

    // Check if exact code exists in Excel
    if (!excelCodeSet.has(cleanedCode)) {
      // Try stripping trailing letters (e.g., 24N -> 24, 24G -> 24)
      const baseCode = stripTrailingLetters(cleanedCode);
      if (baseCode && excelCodeSet.has(baseCode)) {
        cleanedCode = baseCode;
      }
    }
    
    if (!photoMap[cleanedCode]) {
      photoMap[cleanedCode] = [];
    }
    photoMap[cleanedCode].push(photo);
  });
  
  console.log("Photo map sample keys:", Object.keys(photoMap).slice(0, 20));

  // Create matched items only for price data that have photos
  const matched: MatchedItem[] = [];

  priceData.forEach((item) => {
    const cleanedCode = cleanCode(item.CODE);
    if (!cleanedCode) return;

    const photos = photoMap[cleanedCode];

    if (photos && photos.length > 0) {
      console.log(`Item ${item.CODE}: Matched with ${photos.length} photo(s) (Stock: ${item.ON_HAND_STOCK})`);
      matched.push({
        CODE: item.CODE,
        DESCRIPTION: item.DESCRIPTION,
        PRICE_A_INCL: item.PRICE_A_INCL,
        ON_HAND_STOCK: item.ON_HAND_STOCK,
        photoFiles: photos,
        photoUrls: photos.map(p => URL.createObjectURL(p)),
      });
    } else {
      console.log(`Item ${item.CODE}: No photo, skipped (Stock: ${item.ON_HAND_STOCK})`);
    }
  });

  console.log(`Total Excel items: ${priceData.length}, With photos: ${matched.length}, Without photos: ${priceData.length - matched.length}`);

  return matched;
};
