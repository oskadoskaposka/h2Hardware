"use client";

import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { auth } from "../../../lib/firebaseClient";
import { isAdminUser } from "../../../lib/admin";

type RegistrationCode = {
  id: string;
  name: string;
  codePreview: string;
  active: boolean;
};

type CodeResponse = {
  ok?: boolean;
  codes?: RegistrationCode[];
  code?: RegistrationCode & { code?: string };
  error?: string;
};

async function callCodesApi(body: Record<string, unknown>) {
  const user = auth.currentUser;
  if (!user) throw new Error("Admin login is required.");

  const token = await user.getIdToken();
  const response = await fetch("/api/admin/registration-codes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = (await response.json().catch(() => ({}))) as CodeResponse;
  if (!response.ok) {
    throw new Error(data.error || `Action failed (${response.status}).`);
  }
  return data;
}

export default function RegistrationCodesPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [codes, setCodes] = useState<RegistrationCode[]>([]);
  const [editing, setEditing] = useState<RegistrationCode | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [active, setActive] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [createdCode, setCreatedCode] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setIsAdmin(await isAdminUser(user));
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const loadCodes = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const data = await callCodesApi({ action: "list" });
      setCodes(data.codes || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load access codes.");
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (authReady) loadCodes();
  }, [authReady, loadCodes]);

  function resetForm() {
    setEditing(null);
    setName("");
    setCode("");
    setActive(true);
  }

  function beginEdit(item: RegistrationCode) {
    setEditing(item);
    setName(item.name);
    setCode("");
    setActive(item.active);
    setError("");
    setMessage("");
    setCreatedCode("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setCreatedCode("");

    try {
      setSaving(true);
      const data = await callCodesApi(
        editing
          ? {
              action: "update",
              id: editing.id,
              name,
              code,
              active,
            }
          : {
              action: "create",
              name,
              code,
              active,
            },
      );

      const fullCode = data.code?.code || "";
      if (fullCode) setCreatedCode(fullCode);
      setMessage(editing ? "Access code updated." : "Access code created.");
      resetForm();
      await loadCodes();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save access code.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(item: RegistrationCode) {
    try {
      setError("");
      setMessage("");
      await callCodesApi({ action: "toggle", id: item.id, active: !item.active });
      setCodes((current) =>
        current.map((row) =>
          row.id === item.id ? { ...row, active: !item.active } : row,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update access code.");
    }
  }

  async function handleDelete(item: RegistrationCode) {
    if (!window.confirm(`Delete the access code “${item.name}”?`)) return;

    try {
      setError("");
      setMessage("");
      await callCodesApi({ action: "delete", id: item.id });
      setCodes((current) => current.filter((row) => row.id !== item.id));
      if (editing?.id === item.id) resetForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete access code.");
    }
  }

  async function copyCreatedCode() {
    if (!createdCode) return;
    await navigator.clipboard.writeText(createdCode);
    setMessage("Access code copied.");
  }

  if (!authReady) return <main className="codesPage">Checking access…</main>;
  if (!isAdmin) return <main className="codesPage">Access denied.</main>;

  return (
    <main className="codesPage">
      <div className="codesWrap">
        <div className="codesHeader">
          <div>
            <div className="eyebrow">H2 Hardware Admin</div>
            <h1>Registration Codes</h1>
            <p>Create simple codes that approve customer registrations automatically.</p>
          </div>
          <div className="headerLinks">
            <Link href="/admin/registration-requests">Registration Requests</Link>
            <Link href="/admin/orders">Orders</Link>
          </div>
        </div>

        <section className="panel formPanel">
          <h2>{editing ? "Edit access code" : "New access code"}</h2>
          <form onSubmit={handleSave} className="codeForm">
            <label>
              <span>Name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Example: Wei customers"
                maxLength={80}
                required
              />
            </label>

            <label>
              <span>{editing ? "New code (leave blank to keep current)" : "Code"}</span>
              <input
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="H2-WEI-8K4P-X2LM"
                minLength={editing ? undefined : 10}
                maxLength={64}
                required={!editing}
                autoComplete="off"
                spellCheck={false}
              />
              <small>Use at least 10 letters, numbers, hyphens or underscores.</small>
            </label>

            <label className="statusField">
              <input
                type="checkbox"
                checked={active}
                onChange={(event) => setActive(event.target.checked)}
              />
              <span>Active</span>
            </label>

            <div className="formActions">
              <button type="submit" className="primaryButton" disabled={saving}>
                {saving ? "Saving…" : editing ? "Save changes" : "Create code"}
              </button>
              {editing ? (
                <button type="button" className="secondaryButton" onClick={resetForm}>
                  Cancel
                </button>
              ) : null}
            </div>
          </form>

          {createdCode ? (
            <div className="createdCodeBox">
              <div>
                <strong>Copy this code now</strong>
                <p>{createdCode}</p>
                <small>For security, the complete code will not be shown again.</small>
              </div>
              <button type="button" onClick={copyCreatedCode}>Copy</button>
            </div>
          ) : null}
          {error ? <div className="errorBox">{error}</div> : null}
          {message ? <div className="successBox">{message}</div> : null}
        </section>

        <section className="panel listPanel">
          <div className="listHeader">
            <h2>Codes</h2>
            <span>{loading ? "Loading…" : `${codes.length} code${codes.length === 1 ? "" : "s"}`}</span>
          </div>

          {!loading && codes.length === 0 ? (
            <div className="emptyState">No registration codes created yet.</div>
          ) : (
            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Code</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {codes.map((item) => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td><code>{item.codePreview}</code></td>
                      <td>
                        <span className={item.active ? "status active" : "status inactive"}>
                          {item.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <div className="rowActions">
                          <button type="button" onClick={() => beginEdit(item)}>Edit</button>
                          <button type="button" onClick={() => handleToggle(item)}>
                            {item.active ? "Disable" : "Enable"}
                          </button>
                          <button type="button" className="danger" onClick={() => handleDelete(item)}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <style jsx>{`
        .codesPage { min-height: 70vh; padding: 28px 18px 64px; background: #f4f6f8; color: #0f172a; }
        .codesWrap { max-width: 1120px; margin: 0 auto; display: grid; gap: 18px; }
        .codesHeader { display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; flex-wrap: wrap; }
        .eyebrow { color: #b91c1c; text-transform: uppercase; letter-spacing: .08em; font-size: 12px; font-weight: 900; }
        h1 { margin: 4px 0 6px; font-size: 32px; }
        h2 { margin: 0; font-size: 20px; }
        .codesHeader p { margin: 0; color: #64748b; }
        .headerLinks { display: flex; gap: 10px; flex-wrap: wrap; }
        .headerLinks a { background: #fff; color: #0f172a; text-decoration: none; border: 1px solid #dbe2ea; border-radius: 10px; padding: 10px 13px; font-weight: 800; font-size: 13px; }
        .panel { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; box-shadow: 0 8px 24px rgba(15, 23, 42, .05); }
        .formPanel { padding: 18px; }
        .codeForm { display: grid; grid-template-columns: minmax(220px, 1fr) minmax(260px, 1.2fr) auto; gap: 14px; align-items: end; margin-top: 16px; }
        label { display: grid; gap: 6px; }
        label span { font-size: 13px; font-weight: 900; }
        input { width: 100%; box-sizing: border-box; border: 1px solid #cbd5e1; border-radius: 10px; padding: 11px 12px; font: inherit; }
        small { color: #64748b; font-size: 11px; }
        .statusField { display: flex; align-items: center; gap: 8px; height: 42px; padding: 0 10px; border: 1px solid #e2e8f0; border-radius: 10px; }
        .statusField input { width: auto; }
        .formActions { grid-column: 1 / -1; display: flex; gap: 10px; }
        button { border: 0; border-radius: 9px; padding: 9px 12px; font-weight: 850; cursor: pointer; }
        button:disabled { opacity: .65; cursor: not-allowed; }
        .primaryButton { background: #b91c1c; color: #fff; padding: 11px 16px; }
        .secondaryButton, .rowActions button { background: #eef2f7; color: #0f172a; }
        .createdCodeBox { margin-top: 14px; display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 14px; border-radius: 12px; background: #fff7ed; border: 1px solid #fdba74; }
        .createdCodeBox p { margin: 6px 0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 17px; font-weight: 900; overflow-wrap: anywhere; }
        .createdCodeBox button { background: #0f172a; color: #fff; }
        .errorBox, .successBox { margin-top: 12px; border-radius: 10px; padding: 11px 12px; font-size: 13px; font-weight: 750; }
        .errorBox { color: #7f1d1d; border: 1px solid #fecaca; background: #fef2f2; }
        .successBox { color: #065f46; border: 1px solid #a7f3d0; background: #ecfdf5; }
        .listPanel { overflow: hidden; }
        .listHeader { display: flex; justify-content: space-between; align-items: center; padding: 16px 18px; border-bottom: 1px solid #e2e8f0; }
        .listHeader span { color: #64748b; font-size: 13px; }
        .emptyState { padding: 28px 18px; color: #64748b; }
        .tableWrap { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 13px 16px; text-align: left; border-bottom: 1px solid #eef2f7; font-size: 13px; }
        th { background: #f8fafc; color: #475569; text-transform: uppercase; letter-spacing: .04em; font-size: 11px; }
        td code { font-size: 13px; font-weight: 800; }
        .status { display: inline-flex; border-radius: 999px; padding: 5px 9px; font-size: 11px; font-weight: 900; }
        .status.active { color: #065f46; background: #d1fae5; }
        .status.inactive { color: #475569; background: #e2e8f0; }
        .rowActions { display: flex; gap: 7px; flex-wrap: wrap; }
        .rowActions .danger { color: #991b1b; background: #fee2e2; }
        @media (max-width: 850px) { .codeForm { grid-template-columns: 1fr; } }
      `}</style>
    </main>
  );
}
