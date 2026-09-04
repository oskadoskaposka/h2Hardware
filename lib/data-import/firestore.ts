import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import type { ExistingDocument, ImportResult, PreviewRow } from "./types";

export async function loadExistingDocuments(db: Firestore, collectionName: string): Promise<ExistingDocument[]> {
  const snap = await getDocs(collection(db, collectionName));
  return snap.docs.map((item) => ({ id: item.id, data: item.data() as Record<string, unknown> }));
}

export async function applyPreviewToFirestore(args: {
  db: Firestore;
  collectionName: string;
  preview: PreviewRow[];
  batchSize?: number;
  onProgress?: (processed: number, total: number) => void;
}): Promise<ImportResult> {
  const { db, collectionName, preview, onProgress } = args;
  const batchSize = Math.min(Math.max(args.batchSize ?? 350, 1), 450);
  const executable = preview.filter((row) => row.status !== "error" && row.action !== "skip");

  const result: ImportResult = {
    processed: 0,
    updated: 0,
    created: 0,
    skipped: preview.length - executable.length,
  };

  for (let offset = 0; offset < executable.length; offset += batchSize) {
    const chunk = executable.slice(offset, offset + batchSize);
    const batch = writeBatch(db);

    for (const row of chunk) {
      const ref = row.action === "update" && row.existingDocumentId
        ? doc(db, collectionName, row.existingDocumentId)
        : doc(collection(db, collectionName));

      batch.set(ref, {
        ...row.transformed,
        dataImportUpdatedAt: serverTimestamp(),
      }, { merge: true });

      if (row.action === "update") result.updated += 1;
      if (row.action === "create") result.created += 1;
    }

    await batch.commit();
    result.processed += chunk.length;
    onProgress?.(result.processed, executable.length);
  }

  return result;
}
