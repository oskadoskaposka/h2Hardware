"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { auth, app } from "../../../lib/firebaseClient";
import { isAdminUser } from "../../../lib/admin";
import {
  BUILT_IN_PRESETS,
  PRODUCT_DESTINATION_FIELDS,
  guessMappings,
} from "../../../lib/data-import/catalog";
import {
  buildExistingIndex,
  buildPreview,
  summarizePreview,
} from "../../../lib/data-import/engine";
import {
  applyPreviewToFirestore,
  loadExistingDocuments,
} from "../../../lib/data-import/firestore";
import { parseSpreadsheetFile } from "../../../lib/data-import/parsers";
import type {
  FieldMapping,
  ImportMode,
  ImportPreset,
  ParsedWorkbook,
  PreviewRow,
  TransformKind,
} from "../../../lib/data-import/types";
import styles from "./data-import.module.css";

const TRANSFORMS: Array<{ value: TransformKind; label: string }> = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "currency", label: "Currency" },
  { value: "boolean", label: "Boolean" },
  { value: "date", label: "Date" },
  { value: "slug", label: "Slug" },
];

const PRESET_DOC = { collection: "site_config", id: "data_import_presets" };

function presetId(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || `preset-${Date.now()}`;
}

function applyPresetToHeaders(headers: string[], preset: ImportPreset) {
  const guessed = guessMappings(headers);
  if (!preset.mappings.length) return guessed;

  return headers.map((header) => {
    const saved = preset.mappings.find((item) => item.source === header);
    return saved ?? guessed.find((item) => item.source === header) ?? {
      source: header,
      target: "",
      transform: "text" as TransformKind,
      required: false,
    };
  });
}

export default function DataImportPage() {
  const [loadingUser, setLoadingUser] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [workbook, setWorkbook] = useState<ParsedWorkbook | null>(null);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [identifierTarget, setIdentifierTarget] = useState("slug");
  const [mode, setMode] = useState<ImportMode>("update-only");
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [customPresets, setCustomPresets] = useState<ImportPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState("generic-products");
  const [presetName, setPresetName] = useState("");

  const db = useMemo(() => getFirestore(app), []);
  const currentSheet = workbook?.sheets[sheetIndex] ?? null;
  const presets = useMemo(() => [...BUILT_IN_PRESETS, ...customPresets], [customPresets]);
  const summary = useMemo(() => summarizePreview(preview), [preview]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const admin = await isAdminUser(user);
      setIsAdmin(admin);
      setLoadingUser(false);
      if (!admin) return;

      try {
        const snap = await getDoc(doc(db, PRESET_DOC.collection, PRESET_DOC.id));
        const stored = snap.exists() ? snap.data()?.presets : [];
        setCustomPresets(Array.isArray(stored) ? stored : []);
      } catch {
        // Presets are optional; the importer still works with built-ins.
      }
    });
    return () => unsubscribe();
  }, [db]);

  async function handleFile(file?: File) {
    if (!file) return;
    setBusy(true);
    setMessage(null);
    setPreview([]);
    setProgress(0);

    try {
      const parsed = await parseSpreadsheetFile(file);
      if (!parsed.sheets.length) throw new Error("No readable sheets were found in this file.");
      setWorkbook(parsed);
      setSheetIndex(0);
      setMappings(guessMappings(parsed.sheets[0].headers));
      setMessage(`${parsed.sheets[0].rows.length} rows loaded from ${parsed.sheets[0].name}.`);
    } catch (error: any) {
      setWorkbook(null);
      setMappings([]);
      setMessage(error?.message ?? "Could not read this spreadsheet.");
    } finally {
      setBusy(false);
    }
  }

  function handleSheetChange(nextIndex: number) {
    if (!workbook) return;
    setSheetIndex(nextIndex);
    setMappings(guessMappings(workbook.sheets[nextIndex]?.headers ?? []));
    setPreview([]);
    setMessage(null);
  }

  function updateMapping(source: string, patch: Partial<FieldMapping>) {
    setMappings((current) => current.map((item) => item.source === source ? { ...item, ...patch } : item));
    setPreview([]);
  }

  function handlePresetChange(id: string) {
    setSelectedPresetId(id);
    const preset = presets.find((item) => item.id === id);
    if (!preset) return;
    setIdentifierTarget(preset.identifierTarget);
    setMode(preset.mode);
    if (currentSheet) setMappings(applyPresetToHeaders(currentSheet.headers, preset));
    setPreview([]);
    setMessage(preset.description ?? null);
  }

  async function savePreset() {
    if (!presetName.trim() || !currentSheet) {
      setMessage("Enter a preset name after loading a spreadsheet.");
      return;
    }

    const nextPreset: ImportPreset = {
      id: presetId(presetName),
      name: presetName.trim(),
      targetCollection: "products",
      identifierTarget,
      mode,
      mappings,
      updatedAt: new Date().toISOString(),
    };

    const next = [
      ...customPresets.filter((item) => item.id !== nextPreset.id),
      nextPreset,
    ].sort((a, b) => a.name.localeCompare(b.name));

    setBusy(true);
    try {
      await setDoc(doc(db, PRESET_DOC.collection, PRESET_DOC.id), {
        presets: next,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setCustomPresets(next);
      setSelectedPresetId(nextPreset.id);
      setMessage(`Preset “${nextPreset.name}” saved.`);
    } catch (error: any) {
      setMessage(error?.message ?? "Could not save the preset.");
    } finally {
      setBusy(false);
    }
  }

  async function generatePreview() {
    if (!currentSheet) {
      setMessage("Load a spreadsheet first.");
      return;
    }

    const activeMappings = mappings.filter((item) => item.target);
    if (!activeMappings.length) {
      setMessage("Map at least one spreadsheet column to a site field.");
      return;
    }

    if (!activeMappings.some((item) => item.target === identifierTarget)) {
      setMessage(`Map one spreadsheet column to the identifier field “${identifierTarget}”.`);
      return;
    }

    setBusy(true);
    setMessage("Building preview…");
    setPreview([]);
    setProgress(0);

    try {
      const existing = await loadExistingDocuments(db, "products");
      const existingIndex = buildExistingIndex(existing, identifierTarget);
      const nextPreview = buildPreview({
        rows: currentSheet.rows,
        mappings: activeMappings,
        identifierTarget,
        mode,
        existingIndex,
      });
      setPreview(nextPreview);
      const nextSummary = summarizePreview(nextPreview);
      setMessage(`Preview ready: ${nextSummary.updates} updates, ${nextSummary.creates} creates, ${nextSummary.errors} errors.`);
    } catch (error: any) {
      setMessage(error?.message ?? "Could not build the preview.");
    } finally {
      setBusy(false);
    }
  }

  async function importRows() {
    if (!preview.length) return;
    if (summary.errors > 0 && summary.updates + summary.creates === 0) {
      setMessage("There are no valid rows to import.");
      return;
    }

    const executable = summary.updates + summary.creates;
    if (!confirm(`Import ${executable} valid rows? ${summary.skipped} rows will be skipped.`)) return;

    setBusy(true);
    setProgress(0);
    setMessage("Importing…");

    try {
      const result = await applyPreviewToFirestore({
        db,
        collectionName: "products",
        preview,
        onProgress: (processed, total) => setProgress(total ? Math.round((processed / total) * 100) : 100),
      });
      setProgress(100);
      setMessage(`Import complete: ${result.updated} updated, ${result.created} created, ${result.skipped} skipped.`);
    } catch (error: any) {
      setMessage(error?.message ?? "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  if (loadingUser) return <p style={{ padding: 24 }}>Loading user…</p>;
  if (!isAdmin) return <p style={{ padding: 24 }}>Access denied. Admins only.</p>;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Data tools</p>
          <h1>Spreadsheet Data Mapper</h1>
          <p className={styles.subtitle}>Transform CSV/XLSX data into the format used by the site, preview every change, then import only valid rows.</p>
        </div>
      </header>

      <section className={styles.card}>
        <div className={styles.grid3}>
          <label className={styles.field}>
            <span>1. Spreadsheet</span>
            <input type="file" accept=".csv,.txt,.xlsx,.xls,.xlsm" disabled={busy} onChange={(event) => handleFile(event.target.files?.[0])} />
          </label>

          <label className={styles.field}>
            <span>2. Sheet</span>
            <select value={sheetIndex} disabled={!workbook || busy} onChange={(event) => handleSheetChange(Number(event.target.value))}>
              {(workbook?.sheets ?? []).map((sheet, index) => <option key={sheet.name} value={index}>{sheet.name} ({sheet.rows.length})</option>)}
            </select>
          </label>

          <label className={styles.field}>
            <span>3. Preset</span>
            <select value={selectedPresetId} disabled={busy} onChange={(event) => handlePresetChange(event.target.value)}>
              {presets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
            </select>
          </label>
        </div>
      </section>

      {currentSheet ? (
        <>
          <section className={styles.card}>
            <div className={styles.sectionTitleRow}>
              <div>
                <h2>Column mapping</h2>
                <p>Choose what each spreadsheet column means to the site. Unmapped columns are ignored.</p>
              </div>
            </div>

            <div className={styles.tableScroller}>
              <table className={styles.table}>
                <thead>
                  <tr><th>Spreadsheet column</th><th>Site field</th><th>Transform</th><th>Required</th></tr>
                </thead>
                <tbody>
                  {mappings.map((mapping) => (
                    <tr key={mapping.source}>
                      <td><strong>{mapping.source}</strong></td>
                      <td>
                        <select value={mapping.target} onChange={(event) => {
                          const target = event.target.value;
                          const field = PRODUCT_DESTINATION_FIELDS.find((item) => item.key === target);
                          updateMapping(mapping.source, { target, transform: field?.defaultTransform ?? mapping.transform });
                        }}>
                          <option value="">Ignore</option>
                          {PRODUCT_DESTINATION_FIELDS.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}
                        </select>
                      </td>
                      <td>
                        <select value={mapping.transform} disabled={!mapping.target} onChange={(event) => updateMapping(mapping.source, { transform: event.target.value as TransformKind })}>
                          {TRANSFORMS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                        </select>
                      </td>
                      <td><input type="checkbox" checked={!!mapping.required} disabled={!mapping.target} onChange={(event) => updateMapping(mapping.source, { required: event.target.checked })} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.grid3}>
              <label className={styles.field}>
                <span>Match existing products by</span>
                <select value={identifierTarget} onChange={(event) => { setIdentifierTarget(event.target.value); setPreview([]); }}>
                  {PRODUCT_DESTINATION_FIELDS.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}
                </select>
              </label>
              <label className={styles.field}>
                <span>When no product matches</span>
                <select value={mode} onChange={(event) => { setMode(event.target.value as ImportMode); setPreview([]); }}>
                  <option value="update-only">Skip row (update only)</option>
                  <option value="upsert">Create new product</option>
                </select>
              </label>
              <div className={styles.field}>
                <span>Rows in sheet</span>
                <div className={styles.readonlyValue}>{currentSheet.rows.length}</div>
              </div>
            </div>

            <div className={styles.presetSave}>
              <input value={presetName} onChange={(event) => setPresetName(event.target.value)} placeholder="Preset name, e.g. Ailit Inventory" />
              <button type="button" className={styles.secondaryButton} disabled={busy} onClick={savePreset}>Save preset</button>
              <button type="button" className={styles.primaryButton} disabled={busy} onClick={generatePreview}>Generate preview</button>
            </div>
          </section>
        </>
      ) : null}

      {message ? <div className={styles.message}>{message}</div> : null}

      {preview.length ? (
        <section className={styles.card}>
          <div className={styles.stats}>
            <div><span>Total</span><strong>{summary.total}</strong></div>
            <div><span>Updates</span><strong>{summary.updates}</strong></div>
            <div><span>Creates</span><strong>{summary.creates}</strong></div>
            <div><span>Warnings</span><strong>{summary.warnings}</strong></div>
            <div><span>Errors</span><strong>{summary.errors}</strong></div>
            <div><span>Skipped</span><strong>{summary.skipped}</strong></div>
          </div>

          <div className={styles.importBar}>
            <div>
              <strong>Preview before import</strong>
              <p>Showing the first 100 rows. Errors are never written. Warning rows may be skipped depending on the selected mode.</p>
            </div>
            <button type="button" className={styles.primaryButton} disabled={busy || summary.updates + summary.creates === 0} onClick={importRows}>Import {summary.updates + summary.creates} rows</button>
          </div>

          {progress > 0 ? <div className={styles.progress}><div style={{ width: `${progress}%` }} /></div> : null}

          <div className={styles.tableScroller}>
            <table className={styles.table}>
              <thead><tr><th>Row</th><th>Action</th><th>Identifier</th><th>Status</th><th>Details</th><th>Transformed data</th></tr></thead>
              <tbody>
                {preview.slice(0, 100).map((row) => (
                  <tr key={row.rowNumber}>
                    <td>{row.rowNumber}</td>
                    <td><span className={styles.badge}>{row.action}</span></td>
                    <td>{row.identifier || "—"}</td>
                    <td><span className={`${styles.badge} ${styles[row.status]}`}>{row.status}</span></td>
                    <td className={styles.details}>{[...row.errors, ...row.warnings].join(" ") || "OK"}</td>
                    <td><code>{JSON.stringify(row.transformed)}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </main>
  );
}
