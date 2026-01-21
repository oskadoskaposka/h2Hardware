// app/login/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  type User,
} from "firebase/auth";
import {
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { auth, app } from "../../lib/firebaseClient";
import styles from "../../styles/login.module.css";

type CustomerProfile = {
  name?: string;
  phone?: string;
  email?: string;
  updatedAt?: any;
  createdAt?: any;
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const [user, setUser] = useState<User | null>(null);

  const [resetMode, setResetMode] = useState(false);

  const [loadingProfile, setLoadingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");

  const isLogged = !!user;

  const profileDocRef = useMemo(() => {
    if (!user) return null;
    const db = getFirestore(app);
    return doc(db, "customers", user.uid);
  }, [user]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u ?? null);

      if (u?.email) {
        setEmail(u.email);
        setCustomerEmail((prev) => prev || u.email || "");
      }
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!profileDocRef || !user) return;

    (async () => {
      setLoadingProfile(true);
      try {
        const snap = await getDoc(profileDocRef);
        if (snap.exists()) {
          const data = snap.data() as CustomerProfile;

          if (typeof data.name === "string") setCustomerName(data.name);
          if (typeof data.phone === "string") setCustomerPhone(data.phone);

          const em = (data.email || user.email || "").trim();
          if (em) setCustomerEmail(em);
        } else if (user.email) {
          setCustomerEmail(user.email);
        }
      } catch (e: any) {
        setStatus(e?.message || "Failed to load profile.");
      } finally {
        setLoadingProfile(false);
      }
    })();
  }, [profileDocRef, user]);

  async function handleLogin() {
    setStatus("");
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      setStatus("Logged in successfully ✅");
      setResetMode(false);
    } catch (e: any) {
      setStatus(e?.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    setStatus("");
    setBusy(true);
    try {
      await signOut(auth);
      setStatus("Logged out ✅");
      setPassword("");
    } catch (e: any) {
      setStatus(e?.message || "Logout failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleForgotPassword() {
    setStatus("");
    const mail = email.trim();

    if (!mail) {
      setStatus("Type your email first.");
      return;
    }

    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, mail);
      setStatus("Password reset email sent ✅ Check your inbox.");
    } catch (e: any) {
      setStatus(e?.message || "Could not send reset email.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveProfile() {
    if (!user || !profileDocRef) return;

    setSavingProfile(true);
    setStatus("");

    try {
      const existing = await getDoc(profileDocRef);
      const hasExisting = existing.exists();

      const payload: CustomerProfile = {
        name: customerName.trim(),
        phone: customerPhone.trim(),
        email: (customerEmail || user.email || "").trim(),
        updatedAt: serverTimestamp(),
        ...(hasExisting ? {} : { createdAt: serverTimestamp() }),
      };

      await setDoc(profileDocRef, payload as any, { merge: true });
      setStatus("Profile saved ✅");
    } catch (e: any) {
      setStatus(e?.message || "Failed to save profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  return (
    <div className="container">
      <h1 className={styles.h1}>{resetMode ? "Reset Password" : "Login"}</h1>

      {!isLogged ? (
        <p className={styles.p}>
          {resetMode
            ? "Enter your email and we’ll send a password reset link."
            : "Regular customers log in to see discounted prices."}
        </p>
      ) : (
        <p className={styles.p}>Manage your profile details and view your orders.</p>
      )}

      {/* ✅ DOIS CARDS LADO A LADO */}
      <div className="twoColWrap">
        {/* CARD ESQUERDO: login / reset / profile */}
        <div className="starCard">
          <div className="starCardHeader">ACCOUNT</div>
          <div className="starCardBody">
            {/* aviso só quando NÃO logado e NÃO reset */}
            {!isLogged && !resetMode ? (
              <div className="miniNotice">
                <div className="miniNoticeTitle">Don’t have a login yet?</div>
                <div className="miniNoticeText">
                  Accounts are created by our team. Please contact StarPro to request access.
                </div>
              </div>
            ) : null}

            {/* NOT LOGGED + NOT RESET */}
            {!isLogged && !resetMode ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!busy) handleLogin();
                }}
              >
                <label className={styles.label}>
                  Email
                  <input
                    className={styles.input}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@company.com"
                    autoComplete="email"
                  />
                </label>

                <label className={styles.label}>
                  Password
                  <input
                    className={styles.input}
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                </label>

                <button type="submit" className={styles.primary} disabled={busy}>
                  {busy ? "Logging in…" : "Login"}
                </button>

                <div style={{ marginTop: 12 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setStatus("");
                      setResetMode(true);
                    }}
                    style={{
                      background: "transparent",
                      border: 0,
                      padding: 0,
                      cursor: "pointer",
                      fontWeight: 800,
                      color: "#b00000",
                      textDecoration: "underline",
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
              </form>
            ) : null}

            {/* RESET */}
            {!isLogged && resetMode ? (
              <>
                <label className={styles.label}>
                  Email
                  <input
                    className={styles.input}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@company.com"
                    autoComplete="email"
                  />
                </label>

                <button className={styles.primary} onClick={handleForgotPassword} disabled={busy}>
                  {busy ? "Sending…" : "Send reset email"}
                </button>

                <div style={{ marginTop: 12 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setStatus("");
                      setResetMode(false);
                    }}
                    style={{
                      background: "transparent",
                      border: 0,
                      padding: 0,
                      cursor: "pointer",
                      fontWeight: 800,
                      color: "#111",
                      textDecoration: "underline",
                    }}
                  >
                    Back to login
                  </button>
                </div>
              </>
            ) : null}

            {/* LOGGED */}
            {isLogged ? (
              <>
                <p className={styles.ok}>
                  Logged in as <strong>{user?.email}</strong>
                </p>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button className={styles.primary} onClick={handleLogout} disabled={busy}>
                    {busy ? "Working…" : "Logout"}
                  </button>

                  <a
                    href="/orders"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "1px solid #e5e5e5",
                      textDecoration: "none",
                      fontWeight: 800,
                      color: "#111",
                    }}
                  >
                    View my orders
                  </a>
                </div>

                <div
                  style={{
                    marginTop: 18,
                    borderTop: "1px solid #eee",
                    paddingTop: 16,
                  }}
                >
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>
                    Your details
                  </h2>
                  <p style={{ marginTop: 6, opacity: 0.75 }}>
                    These details will be used automatically on checkout.
                  </p>

                  {loadingProfile ? (
                    <p style={{ opacity: 0.75 }}>Loading your details…</p>
                  ) : (
                    <>
                      <label className={styles.label}>Name</label>
                      <input
                        className={styles.input}
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Your full name"
                      />

                      <label className={styles.label}>Phone</label>
                      <input
                        className={styles.input}
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="(XXX) XXX-XXXX"
                      />

                      <label className={styles.label}>Email</label>
                      <input
                        className={styles.input}
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        placeholder="you@email.com"
                      />

                      <button
                        className={styles.primary}
                        onClick={handleSaveProfile}
                        disabled={savingProfile}
                        style={{ marginTop: 10 }}
                      >
                        {savingProfile ? "Saving…" : "Save details"}
                      </button>
                    </>
                  )}
                </div>
              </>
            ) : null}

            {status && <p className={styles.status}>{status}</p>}
          </div>
        </div>

        {/* CARD DIREITO: contato (sempre) */}
        <div className="starCard">
          <div className="starCardHeader">CONTACT US</div>
          <div className="starCardBody">
            <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 8 }}>
              StarPro Doors
            </div>

            <div className="cBlock">
              <div className="cLabel">Phone</div>
              <div className="cValue">403.813.8890</div>
              <div className="cValue">780.710.3826</div>
            </div>

            <div className="cBlock">
              <div className="cLabel">Email</div>
              <a className="cLink" href="mailto:sales@starprodoors.ca">
                sales@starprodoors.ca
              </a>
            </div>

            <div className="cBlock">
              <div className="cLabel">Edmonton</div>
              <div className="cValue">3820 97 ST Edmonton</div>
              <div className="cValue">T6E 5S8</div>
            </div>

            <div className="cBlock">
              <div className="cLabel">Calgary</div>
              <div className="cValue">4510 10th Street NE, Calgary</div>
              <div className="cValue">AB T2E 6K3</div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        /* wrapper centralizado com dois cards */
        .twoColWrap {
          display: grid;
          grid-template-columns: minmax(320px, 520px) minmax(320px, 420px);
          gap: 28px;
          justify-content: center; /* ✅ ambos no meio da página */
          align-items: start;
          margin-top: 10px;
        }

        /* card StarPro (preto + vermelho) */
        .starCard {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 10px 26px rgba(0, 0, 0, 0.07);
        }

        .starCardHeader {
          background: linear-gradient(180deg, #121212, #000);
          color: #fff;
          font-weight: 900;
          font-size: 13px;
          padding: 12px 14px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          border-bottom: 3px solid #b91c1c;
        }

        .starCardBody {
          padding: 16px;
        }

        /* mini aviso (discreto) */
        .miniNotice {
          background: rgba(185, 28, 28, 0.06);
          border: 1px solid rgba(185, 28, 28, 0.22);
          border-left: 5px solid #b91c1c;
          border-radius: 12px;
          padding: 12px;
          margin-bottom: 14px;
        }

        .miniNoticeTitle {
          font-weight: 900;
          color: #b91c1c;
          font-size: 13px;
          margin-bottom: 6px;
        }

        .miniNoticeText {
          font-size: 13px;
          font-weight: 650;
          color: #111;
          line-height: 1.45;
        }

        /* Contact styling */
        .cBlock {
          margin-top: 12px;
        }
        .cLabel {
          font-weight: 900;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          color: #111;
          margin-bottom: 2px;
        }
        .cValue {
          font-size: 13px;
          font-weight: 700;
          color: #111;
          line-height: 1.35;
        }
        .cLink {
          display: inline-block;
          margin-top: 2px;
          font-size: 13px;
          font-weight: 900;
          color: #b91c1c;
          text-decoration: none;
        }
        .cLink:hover {
          text-decoration: underline;
        }

        /* responsivo */
        @media (max-width: 980px) {
          .twoColWrap {
            grid-template-columns: 1fr;
            justify-content: stretch;
          }
        }
      `}</style>
    </div>
  );
}
