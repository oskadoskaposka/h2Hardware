export type ImportCell = string | number | boolean | Date | null | undefined;

export type ImportRow = Record<string, ImportCell>;

export type TransformKind =
  | "text"
  | "number"
  | "currency"
  | "boolean"
  | "date"
  | "slug";

export type ImportMode = "update-only" | "upsert";

export type PreviewStatus = "ready" | "warning" | "error";

export type DestinationField = {
  key: string;
  label: string;
  defaultTransform: TransformKind;
  aliases?: string[];
};

export type FieldMapping = {
  source: string;
  target: string;
  transform: TransformKind;
  required?: boolean;
  defaultValue?: ImportCell;
};

export type ImportPreset = {
  id: string;
  name: string;
  description?: string;
  targetCollection: string;
  identifierTarget: string;
  mode: ImportMode;
  mappings: FieldMapping[];
  updatedAt?: string;
};

export type ParsedSheet = {
  name: string;
  headers: string[];
  rows: ImportRow[];
};

export type ParsedWorkbook = {
  fileName: string;
  sheets: ParsedSheet[];
};

export type ExistingDocument = {
  id: string;
  data: Record<string, unknown>;
};

export type PreviewRow = {
  rowNumber: number;
  raw: ImportRow;
  transformed: Record<string, unknown>;
  identifier: string;
  existingDocumentId?: string;
  action: "update" | "create" | "skip";
  status: PreviewStatus;
  errors: string[];
  warnings: string[];
};

export type PreviewSummary = {
  total: number;
  ready: number;
  warnings: number;
  errors: number;
  updates: number;
  creates: number;
  skipped: number;
};

export type ImportResult = {
  processed: number;
  updated: number;
  created: number;
  skipped: number;
};
