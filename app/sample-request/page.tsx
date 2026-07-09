"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
} from "firebase/firestore";
import { auth, app } from "../../lib/firebaseClient";

type FormState = {
  companyName: string;
  contactName: string;
  phone: string;
  email: string;
  deliveryAddress: string;
};

type CustomerProfile = {
  company?: string;
  companyName?: string;
  name?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  shippingAddress?: string;
  deliveryAddress?: string;
};

const THANK_YOU_TEXT =
  "Thank you. We received your sample request and will organize everything to send your sample as soon as possible.";

const EMPTY_FORM: FormState = {
  companyName: "",
  contactName: "",
  phone: "",
  email: "",
  deliveryAddress: "",
};

const CONTACT_PHONE = "+1 (226) 788-1924";
const CONTACT_PHONE_LINK = "tel:+12267881924";
const CONTACT_EMAIL = "info@h2hardwareltd.com";
const CONTACT_EMAIL_LINK = "mailto:info@h2hardwareltd.com";
const CONTACT_ADDRESS = "4510 10 St NE, Calgary, AB T2E 6K3";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function SampleRequestPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const [authReady, setAuthReady] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setSuccessMsg("");
      setErrorMsg("");

      if (!user) {
        setAuthReady(true);
        setForm(EMPTY_FORM);
        router.replace("/registration-request");
        return;
      }

      setAuthReady(true);
      setLoadingProfile(true);

      try {
        const db = getFirestore(app);
        const snap = await getDoc(doc(db, "customers", user.uid));
        const data = snap.exists() ? (snap.data() as CustomerProfile) : {};

        setForm({
          companyName: String(data.company ?? data.companyName ?? "").trim(),
          contactName: String(data.name ?? data.contactName ?? user.displayName ?? "").trim(),
          phone: String(data.phone ?? "").trim(),
          email: String(data.email ?? user.email ?? "").trim(),
          deliveryAddress: String(data.shippingAddress ?? data.deliveryAddress ?? "").trim(),
        });
      } catch (e: any) {
        setForm((current) => ({
          ...current,
          email: String(user.email ?? "").trim(),
        }));
        setErrorMsg(e?.message ?? "Could not load your account details.");
      } finally {
        setLoadingProfile(false);
      }
    });

    return () => unsub();
  }, [router]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validate() {
    const companyName = form.companyName.trim();
    const contactName = form.contactName.trim();
    const phone = form.phone.trim();
    const email = form.email.trim();
    const deliveryAddress = form.deliveryAddress.trim();

    if (!companyName) {
      return "Company name is required.";
    }

    if (!contactName) {
      return "Contact name is required.";
    }

    if (!phone) {
      return "Phone number is required.";
    }

    if (!email) {
      return "Email address is required.";
    }

    if (!isValidEmail(email)) {
      return "Please enter a valid email address.";
    }

    if (!deliveryAddress) {
      return "Sample delivery address is required.";
    }

    return "";
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    const user = auth.currentUser;
    if (!user) {
      router.replace("/registration-request");
      return;
    }

    const validation = validate();
    if (validation) {
      setErrorMsg(validation);
      return;
    }

    try {
      setSubmitting(true);

      const db = getFirestore(app);

      await addDoc(collection(db, "sample_requests"), {
        uid: user.uid,
        userEmail: user.email ?? "",
        companyName: form.companyName.trim(),
        contactName: form.contactName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        deliveryAddress: form.deliveryAddress.trim(),
        thankYouText: THANK_YOU_TEXT,
        status: "new",
        createdAt: serverTimestamp(),
      });

      setSuccessMsg(THANK_YOU_TEXT);
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Failed to submit the request.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!authReady || loadingProfile) {
    return (
      <main className="page">
        <div className="wrap">
          <section className="card loadingCard">
            <h1>Loading sample request…</h1>
            <p className="muted">We are loading your account details.</p>
          </section>
        </div>
        <style jsx>{`
          .page { min-height: 100vh; background: #f4f6f8; padding: 24px 0 60px; }
          .wrap { max-width: 1180px; margin: 0 auto; padding: 0 18px; }
          .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 18px; box-shadow: 0 6px 18px rgba(0, 0, 0, 0.05); }
          .loadingCard { max-width: 640px; margin: 0 auto; }
          h1 { margin: 0; font-size: 28px; line-height: 1.1; font-weight: 950; color: #0f172a; }
          .muted { margin: 8px 0 0; color: #64748b; font-size: 13px; line-height: 1.45; }
        `}</style>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="wrap">
        <div className="hero">
          <div>
            <div className="eyebrow">H2 Hardware</div>
            <h1>Sample Request</h1>
            <p>
              This form is available for logged-in customers only. Your account
              details are loaded automatically below.
            </p>
          </div>

          <div className="heroLinks">
            <Link href="/catalog" className="ghostBtn">
              Back to catalog
            </Link>
            <Link href="/login" className="ghostBtn">
              My account
            </Link>
          </div>
        </div>

        <div className="grid">
          <section className="card">
            <h2>Request form</h2>
            <p className="muted">
              Please review your account information and confirm the delivery
              address for the sample.
            </p>

            <form onSubmit={handleSubmit} className="form">
              <div className="fieldRow">
                <div className="field">
                  <label>Company Name *</label>
                  <input
                    value={form.companyName}
                    onChange={(e) => update("companyName", e.target.value)}
                    placeholder="e.g. ABC Garage Doors Ltd."
                    autoComplete="organization"
                  />
                </div>

                <div className="field">
                  <label>Contact Name *</label>
                  <input
                    value={form.contactName}
                    onChange={(e) => update("contactName", e.target.value)}
                    placeholder="e.g. John Smith"
                    autoComplete="name"
                  />
                </div>
              </div>

              <div className="fieldRow">
                <div className="field">
                  <label>Phone Number *</label>
                  <input
                    value={form.phone}
                    onChange={(e) => update("phone", e.target.value)}
                    placeholder="+1 403 000 0000"
                    autoComplete="tel"
                  />
                </div>

                <div className="field">
                  <label>Email Address *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    placeholder="name@company.com"
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="field">
                <label>Sample Delivery Address *</label>
                <textarea
                  value={form.deliveryAddress}
                  onChange={(e) => update("deliveryAddress", e.target.value)}
                  placeholder="Street, city, province, postal code"
                  autoComplete="street-address"
                  rows={5}
                />
              </div>

              <div className="help">
                If any information is missing or outdated, adjust it here before submitting.
              </div>

              {errorMsg ? <div className="error">{errorMsg}</div> : null}
              {successMsg ? <div className="success">{successMsg}</div> : null}

              <button type="submit" className="submitBtn" disabled={submitting}>
                {submitting ? "Sending..." : "Submit request"}
              </button>
            </form>
          </section>

          <aside className="card sideCard">
            <section className="rulesBox">
              <div className="sideEyebrow">Free sample</div>
              <h2>How to Request a Free Sample</h2>
              <p className="muted">
                To qualify for a free sample, please complete the following steps:
              </p>

              <ol className="rulesList">
                <li>Register for an account on the H2 Hardware website.</li>
                <li>Follow our Facebook page.</li>
                <li>Complete and submit the Free Sample Request Form.</li>
              </ol>
            </section>

            <section className="contactSection">
              <h3>Any questions?</h3>
              <p className="muted">
                Contact our team if you need help before submitting your sample
                request. We will be happy to assist you.
              </p>

              <div className="contactBox">
                <div className="contactItem">
                  <div className="contactLabel">Phone</div>
                  <a href={CONTACT_PHONE_LINK} className="contactValue">
                    {CONTACT_PHONE}
                  </a>
                </div>

                <div className="contactItem">
                  <div className="contactLabel">Email</div>
                  <a href={CONTACT_EMAIL_LINK} className="contactValue">
                    {CONTACT_EMAIL}
                  </a>
                </div>

                <div className="contactItem">
                  <div className="contactLabel">Address</div>
                  <div className="contactValue">{CONTACT_ADDRESS}</div>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>

      <style jsx>{`
        .page {
          min-height: 100vh;
          background: #f4f6f8;
          padding: 24px 0 60px;
        }
        .wrap {
          max-width: 1180px;
          margin: 0 auto;
          padding: 0 18px;
        }
        .hero {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 18px;
        }
        .eyebrow {
          display: inline-block;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #b91c1c;
          margin-bottom: 8px;
        }
        h1 {
          margin: 0;
          font-size: 34px;
          line-height: 1.05;
          font-weight: 950;
          color: #0f172a;
        }
        .hero p {
          margin: 10px 0 0;
          color: #64748b;
          font-size: 14px;
          max-width: 700px;
        }
        .heroLinks {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        .ghostBtn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 42px;
          padding: 0 14px;
          border-radius: 10px;
          background: #fff;
          border: 1px solid #e2e8f0;
          color: #0f172a;
          font-weight: 800;
          text-decoration: none;
        }
        .grid {
          display: grid;
          grid-template-columns: 1.3fr 0.9fr;
          gap: 18px;
        }
        @media (max-width: 960px) {
          .grid {
            grid-template-columns: 1fr;
          }
        }
        .card {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 18px;
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.05);
        }
        h2 {
          margin: 0;
          color: #0f172a;
          font-size: 22px;
          font-weight: 900;
        }
        h3 {
          margin: 0;
          color: #0f172a;
          font-size: 18px;
          font-weight: 900;
        }
        .muted {
          margin: 8px 0 0;
          color: #64748b;
          font-size: 13px;
          line-height: 1.45;
        }
        .form {
          margin-top: 16px;
          display: grid;
          gap: 14px;
        }
        .field {
          display: grid;
          gap: 6px;
        }
        .field label {
          color: #0f172a;
          font-size: 13px;
          font-weight: 900;
        }
        .field input,
        .field textarea {
          width: 100%;
          border: 1px solid #d1d5db;
          border-radius: 12px;
          padding: 12px 14px;
          font-size: 14px;
          outline: none;
          background: #fff;
        }
        .field textarea {
          resize: vertical;
          min-height: 120px;
          font-family: inherit;
        }
        .field input:focus,
        .field textarea:focus {
          border-color: #94a3b8;
        }
        .fieldRow {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }
        @media (max-width: 680px) {
          .fieldRow {
            grid-template-columns: 1fr;
          }
        }
        .help {
          font-size: 12px;
          color: #64748b;
          line-height: 1.35;
        }
        .error {
          background: #fff;
          border: 1px solid rgba(185, 28, 28, 0.24);
          border-left: 6px solid #b91c1c;
          border-radius: 12px;
          padding: 14px;
          color: #7f1d1d;
          font-size: 13px;
          font-weight: 700;
        }
        .success {
          background: rgba(16, 185, 129, 0.07);
          border: 1px solid rgba(16, 185, 129, 0.22);
          border-left: 6px solid #10b981;
          border-radius: 12px;
          padding: 14px;
          color: #065f46;
          font-size: 13px;
          font-weight: 700;
        }
        .submitBtn {
          height: 46px;
          border: none;
          border-radius: 12px;
          background: #111827;
          color: #fff;
          font-weight: 900;
          font-size: 14px;
          cursor: pointer;
        }
        .submitBtn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .sideCard {
          display: grid;
          gap: 18px;
          align-content: start;
        }
        .rulesBox {
          border: 1px solid rgba(185, 28, 28, 0.18);
          border-radius: 14px;
          background: rgba(185, 28, 28, 0.04);
          padding: 16px;
        }
        .sideEyebrow {
          color: #b91c1c;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom: 6px;
        }
        .rulesList {
          margin: 14px 0 0;
          padding-left: 20px;
          color: #0f172a;
          display: grid;
          gap: 10px;
          font-size: 14px;
          line-height: 1.45;
          font-weight: 700;
        }
        .contactSection {
          display: grid;
          gap: 14px;
        }
        .contactBox {
          display: grid;
          gap: 12px;
        }
        .contactItem {
          border: 1px solid #eef2f7;
          border-radius: 12px;
          padding: 14px;
          background: #fbfcfd;
        }
        .contactLabel {
          color: #64748b;
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 5px;
        }
        .contactValue {
          color: #0f172a;
          font-size: 16px;
          font-weight: 900;
          line-height: 1.45;
          overflow-wrap: anywhere;
          text-decoration: none;
        }
      `}</style>
    </main>
  );
}
