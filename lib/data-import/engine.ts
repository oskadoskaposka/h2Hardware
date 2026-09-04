import { transformValue } from "./transformers";
import type {
  ExistingDocument,
  FieldMapping,
  ImportCell,
  ImportMode,
  ImportRow,
  PreviewRow,
  PreviewSummary,
} from "./types";

function normalizeIdentifier(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function isEmpty(value: unknown) {
  return value === null || value === undefined || (typeof value === "string" && value.trim() === "");
}

function setPath(target: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split(".").filter(Boolean);
  if (!parts.length) return;

  let cursor = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index];
    const current = cursor[part];
    if (!current || typeof current !== "object" || Array.isArray(current)) cursor[part] = {};
    cursor = cursor[part] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]] = value;
}

function getPath(source: Record<string, unknown>, path: string) {
  const parts = path.split(".").filter(Boolean);
  let cursor: unknown = source;
  for (const part of parts) {
    if (!cursor || typeof cursor !== "object") return undefined;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return cursor;
}

export function buildExistingIndex(documents: ExistingDocument[], identifierTarget: string) {
  const index = new Map<string, string>();

  for (const document of documents) {
    const rawIdentifier = identifierTarget === "__documentId"
      ? document.id
      : getPath(document.data, identifierTarget);
    const normalized = normalizeIdentifier(rawIdentifier);
    if (normalized && !index.has(normalized)) index.set(normalized, document.id);
  }

  return index;
}

export function transformImportRow(row: ImportRow, mappings: FieldMapping[]) {
  const output: Record<string, unknown> = {};
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const mapping of mappings.filter((item) => item.target)) {
    const raw = (row[mapping.source] ?? mapping.defaultValue ?? "") as ImportCell;
    const transformed = transformValue(raw, mapping.transform);

    if (mapping.required && isEmpty(transformed)) {
      errors.push(`${mapping.source} is required for ${mapping.target}.`);
      continue;
    }

    const conversionExpected = ["number", "currency", "boolean", "date"].includes(mapping.transform);
    if (!isEmpty(raw) && conversionExpected && transformed === null) {
      errors.push(`${mapping.source} could not be converted using ${mapping.transform}.`);
      continue;
    }

    if (isEmpty(transformed) && !mapping.required) {
      warnings.push(`${mapping.source} is empty; ${mapping.target} will be ignored.`);
      continue;
    }

    setPath(output, mapping.target, transformed);
  }

  return { output, errors, warnings };
}

export function buildPreview(args: {
  rows: ImportRow[];
  mappings: FieldMapping[];
  identifierTarget: string;
  mode: ImportMode;
  existingIndex: Map<string, string>;
}): PreviewRow[] {
  const { rows, mappings, identifierTarget, mode, existingIndex } = args;

  return rows.map((raw, index) => {
    const { output, errors, warnings } = transformImportRow(raw, mappings);
    const identifierRaw = getPath(output, identifierTarget);
    const identifier = normalizeIdentifier(identifierRaw);
    const existingDocumentId = identifier ? existingIndex.get(identifier) : undefined;

    if (!identifier) errors.push(`Identifier field ${identifierTarget} is empty after transformation.`);

    let action: PreviewRow["action"] = "skip";
    if (!errors.length && existingDocumentId) action = "update";
    else if (!errors.length && mode === "upsert") action = "create";
    else if (!errors.length && mode === "update-only") {
      warnings.push(`No existing document matched ${identifierTarget}=${String(identifierRaw ?? "")}.`);
      action = "skip";
    }

    const status: PreviewRow["status"] = errors.length
      ? "error"
      : warnings.length
        ? "warning"
        : "ready";

    return {
      rowNumber: index + 2,
      raw,
      transformed: output,
      identifier,
      existingDocumentId,
      action,
      status,
      errors,
      warnings,
    };
  });
}

export function summarizePreview(rows: PreviewRow[]): PreviewSummary {
  return rows.reduce<PreviewSummary>((summary, row) => {
    summary.total += 1;
    if (row.status === "ready") summary.ready += 1;
    if (row.status === "warning") summary.warnings += 1;
    if (row.status === "error") summary.errors += 1;
    if (row.action === "update") summary.updates += 1;
    if (row.action === "create") summary.creates += 1;
    if (row.action === "skip") summary.skipped += 1;
    return summary;
  }, { total: 0, ready: 0, warnings: 0, errors: 0, updates: 0, creates: 0, skipped: 0 });
}
