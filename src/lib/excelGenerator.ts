import * as XLSX from "xlsx";
import { MatchedItem } from "./catalogueProcessor";

export const generateExcel = (items: MatchedItem[]): Blob => {
  const data = items.map((item) => ({
    CODE: item.CODE,
    DESCRIPTION: item.DESCRIPTION,
    PRICE_A_INCL: item.PRICE_A_INCL,
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Catalogue");

  const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
};
