import * as XLSX from "xlsx";

export interface PriceData {
  CODE: string;
  DESCRIPTION: string;
  PRICE_A_INCL: number | string;
}

export interface MatchedItem {
  CODE: string;
  DESCRIPTION: string;
  PRICE_A_INCL: number | string;
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

        const results: PriceData[] = [];

        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length === 0) continue;

          const code = row[codeCol];
          const desc = row[descCol];
          let price = row[priceCol];

          if (!code) continue;

          // Clean price if it's a string
          if (typeof price === "string") {
            price = price.replace(/R/g, "").replace(/,/g, "").trim();
            price = parseFloat(price);
          }

          results.push({
            CODE: String(code),
            DESCRIPTION: String(desc || ""),
            PRICE_A_INCL: isNaN(price) ? "" : price,
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

  // Match photos
  const matched: MatchedItem[] = [];

  photoFiles.forEach((photo) => {
    const codeFromFilename = cleanCode(photo.name);
    const priceInfo = priceMap[codeFromFilename];

    if (priceInfo) {
      matched.push({
        CODE: codeFromFilename,
        DESCRIPTION: priceInfo.DESCRIPTION,
        PRICE_A_INCL: priceInfo.PRICE_A_INCL,
        photoFile: photo,
        photoUrl: URL.createObjectURL(photo),
      });
    } else {
      matched.push({
        CODE: codeFromFilename,
        DESCRIPTION: "",
        PRICE_A_INCL: "",
        photoFile: photo,
        photoUrl: URL.createObjectURL(photo),
      });
    }
  });

  return matched;
};
