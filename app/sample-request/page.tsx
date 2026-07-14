"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
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

const THANK_YOU_TEXT = "Sample request received. We will contact you shortly.";

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

function PageHero() {
  return (
    <div className="sampleHero">
      <h1>Sample Request</h1>
    </div>
  );
}

function RulesCard() {
  return (
    <section className="sampleRulesBox">
      <h2>How to Request a Free Sample</h2>
      <p className="sampleMuted">
        To qualify for a free sample, please complete the following steps:
      </p>

      <ol className="sampleRulesList">
        <li>Register for an account on the H2 Hardware website.</li>
        <li>Complete and submit the Free Sample Request Form.</li>
      </ol>
    </section>
  );
}

function ContactCard() {
  return (
    <section className="sampleContactSection">
      <h3>Questions?</h3>

      <div className="sampleContactBox">
        <div className="sampleContactItem">
          <div className="sampleContactLabel">Phone</div>
          <a href={CONTACT_PHONE_LINK} className="sampleContactValue">
            {CONTACT_PHONE}
          </a>
        </div>

        <div className="sampleContactItem">
          <div className="sampleContactLabel">Email</div>
          <a href={CONTACT_EMAIL_LINK} className="sampleContactValue">
            {CONTACT_EMAIL}
          </a>
        </div>

        <div className="sampleContactItem">
          <div className="sampleContactLabel">Address</div>
          <div className="sampleContactValue">{CONTACT_ADDRESS}</div>
        </div>
      </div>
    </section>
  );
}

export default function SampleRequestPage() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [authReady, setAuthReady] = useState(false);
  const [isLogged, setIsLogged] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setSuccessMsg("");
      setErrorMsg("");

      if (!user) {
        setIsLogged(false);
        setAuthReady(true);
        setLoadingProfile(false);
        setForm(EMPTY_FORM);
        return;
      }

      setIsLogged(true);
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
  }, []);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validate() {
    const companyName = form.companyName.trim();
    const contactName = form.contactName.trim();
    const phone = form.phone.trim();
    const email = form.email.trim();
    const deliveryAddress = form.deliveryAddress.trim();

    if (!companyName) return "Company name is required.";
    if (!contactName) return "Contact name is required.";
    if (!phone) return "Phone number is required.";
    if (!email) return "Email address is required.";
    if (!isValidEmail(email)) return "Please enter a valid email address.";
    if (!deliveryAddress) return "Sample delivery address is required.";

    return "";
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    const user = auth.currentUser;
    if (!user) {
      setErrorMsg("Please request account access before submitting this form.");
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
      <main className="samplePage">
        <div className="sampleWrap">
          <section className="sampleCard sampleLoadingCard">
            <h1>Loading sample request…</h1>
          </section>
        </div>
        <PageStyles />
      </main>
    );
  }

  if (!isLogged) {
    return (
      <main className="samplePage">
        <div className="sampleWrap">
          <PageHero />

          <div className="sampleGrid sampleLockedGrid">
            <aside className="sampleCard sampleSideCard">
              <RulesCard />
            </aside>

            <section className="sampleCard sampleLockedCard">
              <h2>Need access?</h2>
              <Link href="/registration-request" className="sampleButton sampleButtonPrimary">
                Request account access
              </Link>
            </section>
          </div>
        </div>
        <PageStyles />
      </main>
    );
  }

  return (
    <main className="samplePage">
      <div className="sampleWrap">
        <PageHero />

        <div className="sampleGrid">
          <section className="sampleCard">
            <h2>Request form</h2>

            <form onSubmit={handleSubmit} className="sampleForm">
              <div className="sampleFieldRow">
                <div className="sampleField">
                  <label>Company Name *</label>
                  <input
                    value={form.companyName}
                    onChange={(e) => update("companyName", e.target.value)}
                    placeholder="e.g. ABC Garage Doors Ltd."
                    autoComplete="organization"
                  />
                </div>

                <div className="sampleField">
                  <label>Contact Name *</label>
                  <input
                    value={form.contactName}
                    onChange={(e) => update("contactName", e.target.value)}
                    placeholder="e.g. John Smith"
                    autoComplete="name"
                  />
                </div>
              </div>

              <div className="sampleFieldRow">
                <div className="sampleField">
                  <label>Phone Number *</label>
                  <input
                    value={form.phone}
                    onChange={(e) => update("phone", e.target.value)}
                    placeholder="+1 403 000 0000"
                    autoComplete="tel"
                  />
                </div>

                <div className="sampleField">
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

              <div className="sampleField">
                <label>Sample Delivery Address *</label>
                <textarea
                  value={form.deliveryAddress}
                  onChange={(e) => update("deliveryAddress", e.target.value)}
                  placeholder="Street, city, province, postal code"
                  autoComplete="street-address"
                  rows={5}
                />
              </div>

              {errorMsg ? <div className="sampleError">{errorMsg}</div> : null}
              {successMsg ? <div className="sampleSuccess">{successMsg}</div> : null}

              <button type="submit" className="sampleButton sampleButtonPrimary sampleSubmitButton" disabled={submitting}>
                {submitting ? "Sending..." : "Submit request"}
              </button>
            </form>
          </section>

          <aside className="sampleCard sampleSideCard">
            <RulesCard />
            <ContactCard />
          </aside>
        </div>
      </div>
      <PageStyles />
    </main>
  );
}

function PageStyles() {
  return (
    <style jsx global>{`
      .samplePage {
        min-height: 100vh;
        background: #f4f6f8;
        padding: 24px 0 60px;
      }
      .samplePage * {
        box-sizing: border-box;
      }
      .sampleWrap {
        max-width: 1180px;
        margin: 0 auto;
        padding: 0 18px;
      }
      .sampleHero {
        margin-bottom: 18px;
      }
      .samplePage h1 {
        margin: 0;
        font-size: 34px;
        line-height: 1.05;
        font-weight: 900;
        color: #0f172a;
      }
      .samplePage h2 {
        margin: 0;
        color: #0f172a;
        font-size: 22px;
        line-height: 1.2;
        font-weight: 850;
      }
      .samplePage h3 {
        margin: 0;
        color: #0f172a;
        font-size: 18px;
        line-height: 1.25;
        font-weight: 850;
      }
      .sampleMuted {
        margin: 8px 0 0;
        color: #64748b;
        font-size: 14px;
        line-height: 1.45;
      }
      .sampleButton {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 42px;
        padding: 0 16px;
        border-radius: 10px;
        border: 1px solid transparent;
        font-family: inherit;
        font-size: 14px;
        font-weight: 800;
        line-height: 1;
        text-decoration: none;
        white-space: nowrap;
        cursor: pointer;
      }
      .sampleButtonPrimary {
        background: #111827;
        border-color: #111827;
        color: #fff;
      }
      .sampleButton:disabled {
        opacity: 0.7;
        cursor: not-allowed;
      }
      .sampleSubmitButton {
        width: 100%;
        min-height: 46px;
      }
      .sampleGrid {
        display: grid;
        grid-template-columns: 1.3fr 0.9fr;
        gap: 18px;
      }
      .sampleLockedGrid {
        align-items: start;
      }
      @media (max-width: 960px) {
        .sampleGrid {
          grid-template-columns: 1fr;
        }
      }
      .sampleCard {
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        padding: 18px;
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.05);
      }
      .sampleLoadingCard {
        max-width: 640px;
        margin: 0 auto;
      }
      .sampleLockedCard {
        max-width: 420px;
        display: grid;
        gap: 14px;
        align-content: start;
      }
      .sampleForm {
        margin-top: 16px;
        display: grid;
        gap: 14px;
      }
      .sampleField {
        display: grid;
        gap: 6px;
      }
      .sampleField label {
        color: #0f172a;
        font-size: 13px;
        font-weight: 800;
      }
      .sampleField input,
      .sampleField textarea {
        width: 100%;
        border: 1px solid #d1d5db;
        border-radius: 12px;
        padding: 12px 14px;
        font-family: inherit;
        font-size: 14px;
        outline: none;
        background: #fff;
      }
      .sampleField textarea {
        resize: vertical;
        min-height: 120px;
      }
      .sampleField input:focus,
      .sampleField textarea:focus {
        border-color: #94a3b8;
      }
      .sampleFieldRow {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
      }
      @media (max-width: 680px) {
        .sampleFieldRow {
          grid-template-columns: 1fr;
        }
      }
      .sampleError,
      .sampleSuccess {
        border-radius: 12px;
        padding: 14px;
        font-size: 13px;
        font-weight: 700;
      }
      .sampleError {
        background: #fff;
        border: 1px solid rgba(185, 28, 28, 0.24);
        border-left: 6px solid #b91c1c;
        color: #7f1d1d;
      }
      .sampleSuccess {
        background: rgba(16, 185, 129, 0.07);
        border: 1px solid rgba(16, 185, 129, 0.22);
        border-left: 6px solid #10b981;
        color: #065f46;
      }
      .sampleSideCard {
        display: grid;
        gap: 18px;
        align-content: start;
      }
      .sampleRulesBox {
        border: 1px solid rgba(185, 28, 28, 0.18);
        border-radius: 14px;
        background: rgba(185, 28, 28, 0.04);
        padding: 16px;
      }
      .sampleRulesList {
        margin: 14px 0 0;
        padding-left: 20px;
        color: #0f172a;
        display: grid;
        gap: 10px;
        font-size: 14px;
        line-height: 1.45;
        font-weight: 700;
      }
      .sampleContactSection {
        display: grid;
        gap: 12px;
      }
      .sampleContactBox {
        display: grid;
        gap: 10px;
      }
      .sampleContactItem {
        border: 1px solid #eef2f7;
        border-radius: 12px;
        padding: 12px;
        background: #fbfcfd;
      }
      .sampleContactLabel {
        color: #64748b;
        font-size: 12px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        margin-bottom: 4px;
      }
      .sampleContactValue {
        color: #0f172a;
        font-size: 14px;
        font-weight: 800;
        line-height: 1.45;
        overflow-wrap: anywhere;
        text-decoration: none;
      }
    `}</style>
  );
}
