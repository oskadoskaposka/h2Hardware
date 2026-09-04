import type { ImportRow, ParsedSheet, ParsedWorkbook } from "./types";

declare global {
  interface Window {
    XLSX?: any;
  }
}

let sheetJsLoader: Promise<any> | null = null;

function cleanHeader(value: unknown, index: number) {
  const text = String(value ?? "").trim();
  return text || `Column ${index + 1}`;
}

function uniqueHeaders(values: unknown[]) {
  const seen = new Map<string, number>();
  return values.map((value, index) => {
    const base = cleanHeader(value, index);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base} (${count + 1})`;
  });
}

function rowsFromMatrix(matrix: unknown[][]): { headers: string[]; rows: ImportRow[] } {
  if (!matrix.length) return { headers: [], rows: [] };

  const headers = uniqueHeaders(matrix[0] ?? []);
  const rows = matrix
    .slice(1)
    .filter((row) => row.some((cell) => String(cell ?? "").trim() !== ""))
    .map((row) => {
      const record: ImportRow = {};
      headers.forEach((header, index) => {
        record[header] = (row[index] as any) ?? "";
      });
      return record;
    });

  return { headers, rows };
}

function detectDelimiter(sample: string) {
  const candidates = [",", ";", "\t", "|"];
  let best = ",";
  let bestScore = -1;

  for (const candidate of candidates) {
    let score = 0;
    let inQuotes = false;
    for (let i = 0; i < sample.length; i += 1) {
      const char = sample[i];
      if (char === '"') inQuotes = !inQuotes;
      if (!inQuotes && char === candidate) score += 1;
      if (char === "\n") break;
    }
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best;
}

function parseDelimitedText(text: string, delimiter: string) {
  const matrix: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      row.push(cell);
      cell = "";
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      matrix.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell.length || row.length) {
    row.push(cell);
    matrix.push(row);
  }

  return matrix;
}

async function loadSheetJs() {
  if (typeof window === "undefined") throw new Error("Spreadsheet parsing is only available in the browser.");
  if (window.XLSX) return window.XLSX;
  if (sheetJsLoader) return sheetJsLoader;

  sheetJsLoader = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-data-import-xlsx="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(window.XLSX));
      existing.addEventListener("error", () => reject(new Error("Could not load the XLSX parser.")));
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
    script.async = true;
    script.dataset.dataImportXlsx = "true";
    script.onload = () => (window.XLSX ? resolve(window.XLSX) : reject(new Error("XLSX parser loaded without exposing XLSX.")));
    script.onerror = () => reject(new Error("Could not load the XLSX parser."));
    document.head.appendChild(script);
  });

  return sheetJsLoader;
}

async function parseCsv(file: File): Promise<ParsedWorkbook> {
  const text = (await file.text()).replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(text);
  const matrix = parseDelimitedText(text, delimiter);
  const { headers, rows } = rowsFromMatrix(matrix);

  return {
    fileName: file.name,
    sheets: [{ name: file.name.replace(/\.[^.]+$/, "") || "CSV", headers, rows }],
  };
}

async function parseXlsx(file: File): Promise<ParsedWorkbook> {
  const XLSX = await loadSheetJs();
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const sheets: ParsedSheet[] = workbook.SheetNames.map((sheetName: string) => {
    const worksheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "", raw: true }) as unknown[][];
    const { headers, rows } = rowsFromMatrix(matrix);
    return { name: sheetName, headers, rows };
  });

  return { fileName: file.name, sheets };
}

export async function parseSpreadsheetFile(file: File): Promise<ParsedWorkbook> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "csv" || extension === "txt") return parseCsv(file);
  if (extension === "xlsx" || extension === "xls" || extension === "xlsm") return parseXlsx(file);
  throw new Error("Unsupported file type. Use CSV, XLSX, XLS, or XLSM.");
}
