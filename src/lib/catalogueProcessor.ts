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
  photoFile?: File;
  photoUrl?: string;
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

        const headers = jsonData[0];
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

        const codeCol = findCol("CODE");
        if (codeCol === null) {
          reject(new Error("Could not find CODE column in Excel"));
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

        for (let i = 1; i < jsonData.length; i++) {
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
  // Build lookup map
  const priceMap: Record<string, PriceData> = {};
  priceData.forEach((item) => {
    const cleanedCode = cleanCode(item.CODE);
    if (cleanedCode && !priceMap[cleanedCode]) {
      priceMap[cleanedCode] = item;
    }
  });
  
  console.log("Price map keys:", Object.keys(priceMap).slice(0, 10));

  // Match photos
  const matched: MatchedItem[] = [];

  photoFiles.forEach((photo) => {
    // Remove file extension before cleaning
    const nameWithoutExt = photo.name.replace(/\.[^/.]+$/, "");
    
    // Extract just the code portion (before any dash, underscore, or space)
    const codePortion = nameWithoutExt.split(/[-_\s]/)[0];
    const codeFromFilename = cleanCode(codePortion);
    const priceInfo = priceMap[codeFromFilename];

    console.log(`Photo: ${photo.name} -> Extracted: ${codePortion} -> Cleaned: ${codeFromFilename} -> Matched: ${!!priceInfo}${priceInfo ? ` (Stock: ${priceInfo.ON_HAND_STOCK})` : ''}`);

    if (priceInfo) {
      matched.push({
        CODE: priceInfo.CODE,
        DESCRIPTION: priceInfo.DESCRIPTION,
        PRICE_A_INCL: priceInfo.PRICE_A_INCL,
        ON_HAND_STOCK: priceInfo.ON_HAND_STOCK,
        photoFile: photo,
        photoUrl: URL.createObjectURL(photo),
      });
    } else {
      matched.push({
        CODE: codeFromFilename,
        DESCRIPTION: "",
        PRICE_A_INCL: "",
        ON_HAND_STOCK: 0,
        photoFile: photo,
        photoUrl: URL.createObjectURL(photo),
      });
    }
  });

  return matched;
};
