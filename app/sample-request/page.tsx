"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { addDoc, collection, getFirestore, serverTimestamp } from "firebase/firestore";
import { app } from "../../lib/firebaseClient";

type FormState = {
  companyName: string;
  contactName: string;
  website: string;
  phone: string;
  email: string;
  deliveryAddress: string;
};

const THANK_YOU_TEXT =
  "Thanks, we will review your info and send you the sample.";

const CONTACT_PHONE = "+1 (226) 788-1924";
const CONTACT_PHONE_LINK = "tel:+12267881924";
const CONTACT_EMAIL = "info@h2hardwareltd.com";
const CONTACT_EMAIL_LINK = "mailto:info@h2hardwareltd.com";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function SampleRequestPage() {
  const [form, setForm] = useState<FormState>({
    companyName: "",
    contactName: "",
    website: "",
    phone: "",
    email: "",
    deliveryAddress: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");

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

    if (email && !isValidEmail(email)) {
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

    const validation = validate();
    if (validation) {
      setErrorMsg(validation);
      return;
    }

    try {
      setSubmitting(true);

      const db = getFirestore(app);

      await addDoc(collection(db, "sample_requests"), {
        companyName: form.companyName.trim(),
        contactName: form.contactName.trim(),
        website: form.website.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        deliveryAddress: form.deliveryAddress.trim(),
        thankYouText: THANK_YOU_TEXT,
        status: "new",
        createdAt: serverTimestamp(),
      });

      setSuccessMsg(THANK_YOU_TEXT);
      setForm({
        companyName: "",
        contactName: "",
        website: "",
        phone: "",
        email: "",
        deliveryAddress: "",
      });
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Failed to submit the request.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page">
      <div className="wrap">
        <div className="hero">
          <div>
            <div className="eyebrow">H2 Hardware</div>
            <h1>Sample Request</h1>
            <p>
              Please fill in the information below. We will review your request
              and contact you about the sample.
            </p>
          </div>

          <div className="heroLinks">
            <Link href="/catalog" className="ghostBtn">
              Back to catalog
            </Link>
            <Link href="/" className="ghostBtn">
              Home
            </Link>
          </div>
        </div>

        <div className="grid">
          <section className="card">
            <h2>Request form</h2>
            <p className="muted">
              Please provide the company information, the contact person who will
              receive the sample, and the delivery address.
            </p>

            <form onSubmit={handleSubmit} className="form">
              <div className="fieldRow">
                <div className="field">
                  <label>Company Name *</label>
                  <input
                    value={form.companyName}
                    onChange={(e) => update("companyName", e.target.value)}
                    placeholder="e.g. ABC Garage Doors Ltd."
                  />
                </div>

                <div className="field">
                  <label>Contact Name *</label>
                  <input
                    value={form.contactName}
                    onChange={(e) => update("contactName", e.target.value)}
                    placeholder="e.g. John Smith"
                  />
                </div>
              </div>

              <div className="field">
                <label>Website</label>
                <input
                  value={form.website}
                  onChange={(e) => update("website", e.target.value)}
                  placeholder="Company website"
                />
                <div className="help">Optional.</div>
              </div>

              <div className="fieldRow">
                <div className="field">
                  <label>Phone Number *</label>
                  <input
                    value={form.phone}
                    onChange={(e) => update("phone", e.target.value)}
                    placeholder="+1 403 000 0000"
                  />
                </div>

                <div className="field">
                  <label>Email Address</label>
                  <input
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    placeholder="name@company.com"
                  />
                </div>
              </div>

              <div className="field">
                <label>Sample Delivery Address *</label>
                <textarea
                  value={form.deliveryAddress}
                  onChange={(e) => update("deliveryAddress", e.target.value)}
                  placeholder="Street, city, province, postal code"
                  rows={5}
                />
              </div>

              <div className="thanksBox">{THANK_YOU_TEXT}</div>

              {errorMsg ? <div className="error">{errorMsg}</div> : null}
              {successMsg ? <div className="success">{successMsg}</div> : null}

              <button type="submit" className="submitBtn" disabled={submitting}>
                {submitting ? "Sending..." : "Submit request"}
              </button>
            </form>
          </section>

          <aside className="card sideCard">
            <h2>Any questions?</h2>
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
            </div>
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
        .thanksBox {
          background: rgba(185, 28, 28, 0.06);
          border: 1px solid rgba(185, 28, 28, 0.18);
          color: #991b1b;
          border-radius: 12px;
          padding: 12px 14px;
          font-size: 13px;
          font-weight: 700;
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
          gap: 16px;
          align-content: start;
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
