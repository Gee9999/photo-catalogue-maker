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
  const isCSV = file.name.toLowerCase().endsWith('.csv');

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        let jsonData: any[][];

        if (isCSV) {
          // Parse CSV file with auto-delimiter detection
          const csvText = data as string;
          const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');

          // Auto-detect delimiter by checking first few non-empty lines
          const testLine = lines.find(l => l.length > 10) || lines[0];
          const delimiters = ['\t', ',', ';', '|'];
          let bestDelimiter = ',';
          let maxColumns = 0;

          delimiters.forEach(delim => {
            const cols = testLine.split(delim).length;
            if (cols > maxColumns) {
              maxColumns = cols;
              bestDelimiter = delim;
            }
          });

          console.log(`CSV auto-detected delimiter: "${bestDelimiter === '\t' ? 'TAB' : bestDelimiter}" (${maxColumns} columns)`);
          console.log(`First line sample: ${testLine.substring(0, 200)}...`);

          // Parse with detected delimiter
          jsonData = lines.map(line => {
            const result: string[] = [];
            let current = '';
            let inQuotes = false;

            for (let i = 0; i < line.length; i++) {
              const char = line[i];
              if (char === '"') {
                inQuotes = !inQuotes;
              } else if (char === bestDelimiter && !inQuotes) {
                result.push(current.trim());
                current = '';
              } else {
                current += char;
              }
            }
            result.push(current.trim());
            return result;
          });

          console.log(`CSV parsed: ${jsonData.length} rows, first row has ${jsonData[0]?.length} columns`);
          console.log(`First 3 rows:`, jsonData.slice(0, 3));
        } else {
          // Parse Excel file
          const workbook = XLSX.read(data, { type: "binary" });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        }

        if (jsonData.length < 2) {
          reject(new Error("File is empty or has no data rows"));
          return;
        }

        // Find the header row by looking for a row that contains both "CODE" and "DESCRIPTION" columns
        // This distinguishes the actual header row from title rows that might contain "CODE" as text
        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(20, jsonData.length); i++) {
          const row = jsonData[i];
          if (!row) continue;
          const rowStr = row.map((cell: any) => normCol(String(cell || ""))).join(",");

          // Look for rows that have both CODE and DESCRIPTION - this is the actual header row
          const hasCode = rowStr.includes("CODE") || rowStr.includes("ITEMCODE") || rowStr.includes("STOCKCODE");
          const hasDesc = rowStr.includes("DESCRIPTION") || rowStr.includes("DESC") || rowStr.includes("PRODUCTNAME");

          if (hasCode && hasDesc) {
            headerRowIndex = i;
            console.log(`Found header row at index ${i}:`, row);
            break;
          }
        }

        console.log(`Header row index: ${headerRowIndex}`);
        console.log(`Total rows in Excel: ${jsonData.length}`);

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

        const codeCol = findCol("CODE") ?? findCol("ITEMCODE") ?? findCol("PRODUCTCODE") ?? findCol("STOCKCODE") ?? findCol("PRODUCTDETAILSBYCODE");
        if (codeCol === null) {
          const foundColumns = headers.map((h: any) => String(h)).join(", ");
          reject(new Error(`Could not find CODE column in Excel. Found columns: ${foundColumns}`));
          return;
        }

        let descCol: number | null = null;
        for (const target of ["DESCRIPTION", "DESC", "PRODUCTDESCRIPTION", "ITEMDESCRIPTION", "PRODUCTNAME", "NAME", "ITEMNAME"]) {
          descCol = findCol(target);
          if (descCol !== null) break;
        }
        // Description is optional - if not found, we'll use empty string

        let priceCol: number | null = null;
        for (const target of ["PRICEAINCL", "PRICEAINCLINC", "PRICEAINCLINCL", "PRICE", "SELLINGPRICE", "RETAILPRICE", "UNITPRICE"]) {
          priceCol = findCol(target);
          if (priceCol !== null) break;
        }
        // Price is optional - if not found, we'll use empty string

        let stockCol: number | null = null;
        for (const target of ["ONHANDSTOCK", "ONHAND", "STOCK", "ONHANDSTOCKQTY", "QTY", "QUANTITY", "AVAILABLESTOCK"]) {
          stockCol = findCol(target);
          if (stockCol !== null) break;
        }
        // Stock is optional - if not found, we'll use a high number so items aren't filtered out

        const results: PriceData[] = [];

        console.log(`Code column index: ${codeCol}`);
        console.log(`Starting data from row: ${headerRowIndex + 1}`);

        // Log first few data rows for debugging
        for (let i = headerRowIndex + 1; i < Math.min(headerRowIndex + 5, jsonData.length); i++) {
          console.log(`Row ${i}:`, jsonData[i]);
        }

        for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length === 0) continue;

          let code = row[codeCol];
          const desc = descCol !== null ? row[descCol] : "";
          let price = priceCol !== null ? row[priceCol] : "";
          let stock = stockCol !== null ? row[stockCol] : 999999;

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
            ON_HAND_STOCK: isNaN(stock) ? 999999 : stock,
          });
        }

        resolve(results);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error("Failed to read file"));

    // Read CSV as text, Excel as binary
    if (isCSV) {
      reader.readAsText(file);
    } else {
      reader.readAsBinaryString(file);
    }
  });
};

export const matchPhotosToPrice = (
  photoFiles: File[],
  priceData: PriceData[]
): MatchedItem[] => {
  // Helper function to extract the numeric core from a code
  // Removes all non-digits, then removes leading zeros
  const getNumericCore = (code: string): string => {
    const digitsOnly = code.replace(/[^0-9]/g, "");
    // Remove leading zeros but keep at least one digit
    return digitsOnly.replace(/^0+/, "") || "0";
  };

  // Build a map from numeric core to Excel items
  // Multiple Excel codes might map to the same numeric core
  const numericCoreToItems = new Map<string, PriceData[]>();

  priceData.forEach((item, idx) => {
    const code = String(item.CODE).trim();
    if (!code) return;

    const numericCore = getNumericCore(code);

    // Debug first 10 items to see the conversion
    if (idx < 10) {
      console.log(`Excel item ${idx}: "${code}" -> numeric core "${numericCore}"`);
    }

    if (!numericCoreToItems.has(numericCore)) {
      numericCoreToItems.set(numericCore, []);
    }
    numericCoreToItems.get(numericCore)!.push(item);
  });

  // Debug: Find items containing specific codes
  const searchCodes = ["8610401992", "8611700550"];
  searchCodes.forEach(searchCode => {
    priceData.forEach((item) => {
      const code = String(item.CODE).trim();
      if (code.includes(searchCode)) {
        const numCore = getNumericCore(code);
        console.log(`Found Excel code containing ${searchCode}: "${code}" -> numeric core "${numCore}"`);
        console.log(`  Is "${numCore}" in map? ${numericCoreToItems.has(numCore)}`);
      }
    });
  });

  // Check if 8611700550 is in the map
  console.log(`Is "8611700550" in numericCoreToItems map? ${numericCoreToItems.has("8611700550")}`);
  if (numericCoreToItems.has("8611700550")) {
    const items = numericCoreToItems.get("8611700550")!;
    console.log(`Items for numeric core 8611700550:`, items.map(i => i.CODE));
  }

  console.log("Sample numeric cores from Excel:", Array.from(numericCoreToItems.keys()).slice(0, 20));

  // Debug: Find ALL Excel codes that START with 861
  const codesStarting861: string[] = [];
  priceData.forEach((item) => {
    const code = String(item.CODE).trim();
    if (code.startsWith("861")) {
      codesStarting861.push(code);
    }
  });
  console.log(`Excel codes starting with "861": ${codesStarting861.length} found`);
  console.log(`First 30 codes starting with 861:`, codesStarting861.slice(0, 30));

  // Debug: Look for specific codes
  const testCodes = ["8610401992", "8610401993", "8610402000"];
  testCodes.forEach(tc => {
    const found = numericCoreToItems.has(tc);
    console.log(`Debug: Looking for numeric core ${tc} in Excel: ${found ? "FOUND" : "NOT FOUND"}`);
    if (!found) {
      // Search for partial match
      const allCores = Array.from(numericCoreToItems.keys());
      const partialMatches = allCores.filter(c => c.includes(tc) || tc.includes(c));
      if (partialMatches.length > 0) {
        console.log(`  Partial matches: ${partialMatches.slice(0, 5).join(", ")}`);
      }
    }
  });

  // Also log some Excel codes that start with 861
  const codes861 = Array.from(numericCoreToItems.keys()).filter(c => c.startsWith("861"));
  console.log(`Excel codes starting with 861: ${codes861.length} found`, codes861.slice(0, 20));

  // Build photo lookup map - extract numeric core from filename
  const photoMap: Record<string, File[]> = {};

  photoFiles.forEach((photo) => {
    const nameWithoutExt = photo.name.replace(/\.[^/.]+$/, "");
    // Get part before dash, or full name if no dash
    const codeFromFilename = nameWithoutExt.split("-")[0];

    // Check if it contains underscores (multiple codes in one photo)
    const potentialCodes = codeFromFilename.includes("_")
      ? codeFromFilename.split("_")
      : [codeFromFilename];

    potentialCodes.forEach((code) => {
      const numericCore = getNumericCore(code);
      if (!numericCore || numericCore === "0") return;

      if (!photoMap[numericCore]) {
        photoMap[numericCore] = [];
      }
      photoMap[numericCore].push(photo);
    });
  });

  console.log("Photo map keys (numeric cores):", Object.keys(photoMap));

  // Create matched items - match by numeric core
  const matched: MatchedItem[] = [];
  const matchedCores = new Set<string>();

  // For each photo numeric core, find matching Excel items
  Object.entries(photoMap).forEach(([numericCore, photos]) => {
    const excelItems = numericCoreToItems.get(numericCore);

    if (excelItems && excelItems.length > 0) {
      // Use the first matching Excel item for metadata
      const item = excelItems[0];
      console.log(`Matched numeric core ${numericCore}: Photo -> Excel ${item.CODE} (${photos.length} photo(s))`);

      matchedCores.add(numericCore);
      matched.push({
        CODE: item.CODE,
        DESCRIPTION: item.DESCRIPTION,
        PRICE_A_INCL: item.PRICE_A_INCL,
        ON_HAND_STOCK: item.ON_HAND_STOCK,
        photoFiles: photos,
        photoUrls: photos.map(p => URL.createObjectURL(p)),
      });
    } else {
      console.log(`No Excel match for photo numeric core: ${numericCore}`);
    }
  });

  console.log(`Total Excel items: ${priceData.length}, Photos matched: ${matched.length}/${photoFiles.length}`);

  return matched;
};

