"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, getFirestore, orderBy, query } from "firebase/firestore";

import { auth, app } from "../../../lib/firebaseClient";

type SampleRequestDoc = {
  id: string;
  companyName: string;
  website?: string;
  nameCardImageUrl?: string;
  phone?: string;
  email?: string;
  deliveryAddress: string;
  thankYouText?: string;
  status?: string;
  createdAt?: any;
};

const adminEmails =
  process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean) || [];

function isAdminEmail(email: string | null | undefined) {
  return !!email && adminEmails.includes((email || "").toLowerCase());
}

function toSearchText(item: SampleRequestDoc) {
  return [
    item.id,
    item.companyName,
    item.website || "",
    item.nameCardImageUrl || "",
    item.phone || "",
    item.email || "",
    item.deliveryAddress || "",
    item.status || "",
  ]
    .join(" ")
    .toLowerCase();
}

export default function AdminSampleRequestsPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<SampleRequestDoc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setIsAdmin(isAdminEmail(u?.email));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      setItems([]);
      setLoading(false);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const db = getFirestore(app);
        const col = collection(db, "sample_requests");
        const qq = query(col, orderBy("createdAt", "desc"));
        const snap = await getDocs(qq);

        const list: SampleRequestDoc[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            companyName: String(data.companyName ?? "").trim(),
            website: String(data.website ?? "").trim(),
            nameCardImageUrl: String(data.nameCardImageUrl ?? "").trim(),
            phone: String(data.phone ?? "").trim(),
            email: String(data.email ?? "").trim(),
            deliveryAddress: String(data.deliveryAddress ?? "").trim(),
            thankYouText: String(data.thankYouText ?? "").trim(),
            status: String(data.status ?? "new").trim(),
            createdAt: data.createdAt,
          };
        });

        setItems(list);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load sample requests.");
      } finally {
        setLoading(false);
      }
    })();
  }, [isAdmin]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => toSearchText(item).includes(q));
  }, [items, search]);

  if (!isAdmin) {
    return <p style={{ padding: 24 }}>Access denied.</p>;
  }

  return (
    <main style={{ padding: 24, background: "#f4f6f8", minHeight: "70vh" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 18px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 26,
                fontWeight: 900,
                color: "#0f172a",
                letterSpacing: -0.2,
              }}
            >
              Sample Requests
            </h1>
            <div style={{ marginTop: 6, color: "#64748b", fontSize: 13 }}>
              {loading
                ? "Loading…"
                : `${filtered.length} request${filtered.length === 1 ? "" : "s"}`}
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link
              href="/sample-request"
              style={{ fontWeight: 800, color: "#b91c1c", textDecoration: "none" }}
            >
              Sample request form
            </Link>
            <Link
              href="/admin/orders"
              style={{ fontWeight: 800, color: "#b91c1c", textDecoration: "none" }}
            >
              Orders
            </Link>
            <Link
              href="/admin/products"
              style={{ fontWeight: 800, color: "#b91c1c", textDecoration: "none" }}
            >
              Manage products
            </Link>
            <Link
              href="/catalog"
              style={{ fontWeight: 800, color: "#b91c1c", textDecoration: "none" }}
            >
              Catalog
            </Link>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search: company, website, phone, email, address..."
            style={{
              width: "100%",
              minHeight: 42,
              padding: "0 12px",
              borderRadius: 10,
              border: "1px solid #e2e8f0",
              background: "#fff",
              outline: "none",
            }}
          />
        </div>

        {error ? (
          <div
            style={{
              marginTop: 16,
              background: "#fff",
              border: "1px solid rgba(185,28,28,.25)",
              borderLeft: "6px solid #b91c1c",
              borderRadius: 12,
              padding: 14,
            }}
          >
            <strong>Firestore error:</strong> {error}
          </div>
        ) : loading ? (
          <div style={{ marginTop: 16, color: "#64748b" }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              marginTop: 16,
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: 14,
            }}
          >
            <div style={{ fontWeight: 900, color: "#0f172a" }}>No sample requests found</div>
            <div style={{ marginTop: 6, color: "#64748b", fontSize: 13 }}>
              Try a different search.
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
            {filtered.map((item) => {
              const dt =
                item.createdAt?.toDate?.() instanceof Date ? item.createdAt.toDate() : null;

              return (
                <div
                  key={item.id}
                  style={{
                    background: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 14,
                    padding: 14,
                    boxShadow: "0 1px 0 rgba(15,23,42,.03)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      alignItems: "flex-start",
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ minWidth: 260 }}>
                      <div
                        style={{
                          fontWeight: 950 as any,
                          color: "#0f172a",
                          fontSize: 18,
                          letterSpacing: 0.1,
                        }}
                      >
                        {item.companyName || "Unnamed company"}
                      </div>

                      <div style={{ marginTop: 6, color: "#64748b", fontSize: 12 }}>
                        ID:{" "}
                        <span
                          style={{
                            fontFamily:
                              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                          }}
                        >
                          {item.id}
                        </span>
                      </div>

                      <div style={{ marginTop: 6, color: "#64748b", fontSize: 12 }}>
                        {dt ? dt.toLocaleString("en-CA") : "—"}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minWidth: 84,
                        height: 32,
                        padding: "0 12px",
                        borderRadius: 999,
                        background: "rgba(185, 28, 28, 0.08)",
                        color: "#b91c1c",
                        border: "1px solid rgba(185, 28, 28, 0.18)",
                        fontSize: 12,
                        fontWeight: 900,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {item.status || "new"}
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: 14,
                      display: "grid",
                      gridTemplateColumns: "1.1fr 1fr",
                      gap: 14,
                    }}
                  >
                    <div style={{ display: "grid", gap: 10 }}>
                      <InfoRow
                        label="Website"
                        value={
                          item.website ? (
                            <a
                              href={item.website}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: "#b91c1c", fontWeight: 800 }}
                            >
                              {item.website}
                            </a>
                          ) : (
                            "—"
                          )
                        }
                      />

                      <InfoRow label="Phone" value={item.phone || "—"} />

                      <InfoRow
                        label="Email"
                        value={
                          item.email ? (
                            <a
                              href={`mailto:${item.email}`}
                              style={{ color: "#b91c1c", fontWeight: 800 }}
                            >
                              {item.email}
                            </a>
                          ) : (
                            "—"
                          )
                        }
                      />

                      <InfoRow
                        label="Sample delivery address"
                        value={
                          <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.45 }}>
                            {item.deliveryAddress || "—"}
                          </div>
                        }
                      />

                      <InfoRow label="Thank you text" value={item.thankYouText || "—"} />
                    </div>

                    <div style={{ display: "grid", gap: 10, alignContent: "start" }}>
                      <div
                        style={{
                          border: "1px solid #e2e8f0",
                          borderRadius: 12,
                          overflow: "hidden",
                          background: "#f8fafc",
                          minHeight: 220,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {item.nameCardImageUrl ? (
                          <a
                            href={item.nameCardImageUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{ display: "block", width: "100%", height: "100%" }}
                          >
                            <img
                              src={item.nameCardImageUrl}
                              alt={`${item.companyName} name card`}
                              style={{
                                display: "block",
                                width: "100%",
                                height: "100%",
                                objectFit: "contain",
                                background: "#fff",
                              }}
                            />
                          </a>
                        ) : (
                          <div style={{ color: "#64748b", fontSize: 13, fontWeight: 700 }}>
                            No name card image provided
                          </div>
                        )}
                      </div>

                      {item.nameCardImageUrl ? (
                        <a
                          href={item.nameCardImageUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            color: "#b91c1c",
                            fontWeight: 800,
                            textDecoration: "none",
                          }}
                        >
                          Open name card image
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: "1px solid #eef2f7",
        borderRadius: 12,
        padding: 12,
        background: "#fbfcfd",
      }}
    >
      <div
        style={{
          color: "#64748b",
          fontSize: 12,
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ color: "#0f172a", fontSize: 14, fontWeight: 700 }}>{value}</div>
    </div>
  );
}