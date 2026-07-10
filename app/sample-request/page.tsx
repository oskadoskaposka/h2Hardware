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

function PageHero({ locked }: { locked?: boolean }) {
  return (
    <div className="hero">
      <div>
        <div className="eyebrow">H2 Hardware</div>
        <h1>Sample Request</h1>
        <p>
          {locked
            ? "Free sample requests are available only after account registration."
            : "This form is available for logged-in customers only. Your account details are loaded automatically below."}
        </p>
      </div>

      <div className="heroLinks">
        <Link href="/catalog" className="ghostBtn">
          Back to catalog
        </Link>
        <Link href="/login" className="ghostBtn">
          {locked ? "Login" : "My account"}
        </Link>
      </div>
    </div>
  );
}

function RulesCard({ loggedIn }: { loggedIn: boolean }) {
  return (
    <section className="rulesBox">
      <div className="sideEyebrow">Free sample</div>
      <h2>How to Request a Free Sample</h2>
      <p className="muted">
        To qualify for a free sample, please complete the following steps:
      </p>

      <ol className="rulesList">
        <li>Register for an account on the H2 Hardware website.</li>
        <li>{loggedIn ? "Complete and submit the Free Sample Request Form." : "Log in and submit the Free Sample Request Form."}</li>
      </ol>
    </section>
  );
}

function ContactCard() {
  return (
    <section className="contactSection">
      <h3>Any questions?</h3>
      <p className="muted">
        Contact our team if you need help before submitting your sample request.
        We will be happy to assist you.
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
      setErrorMsg("Please request account access and login before requesting a free sample.");
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
          <section className="sampleCard loadingCard">
            <h1>Loading sample request…</h1>
            <p className="muted">We are loading your account details.</p>
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
          <PageHero locked />

          <div className="sampleGrid lockedGrid">
            <section className="sampleCard lockedCard">
              <div className="lockedEyebrow">Account required</div>
              <h2>Register before requesting a free sample</h2>
              <p className="lockedText">
                Please request account access first. After H2 Hardware reviews and approves your account, log in to submit the Free Sample Request Form. Your details will be filled in automatically.
              </p>

              <div className="lockedActions">
                <Link href="/registration-request" className="primaryLink">
                  Request account access
                </Link>
                <Link href="/login" className="secondaryLink">
                  I already have an account
                </Link>
              </div>
            </section>

            <aside className="sampleCard sideCard">
              <RulesCard loggedIn={false} />
            </aside>
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
            <p className="muted">
              Please review your account information and confirm the delivery address for the sample.
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

          <aside className="sampleCard sideCard">
            <RulesCard loggedIn />
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
      .sampleWrap {
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
      .samplePage h1 {
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
      .heroLinks,
      .lockedActions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      .ghostBtn,
      .secondaryLink {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 42px;
        padding: 0 14px;
        border-radius: 10px;
        background: #fff;
        border: 1px solid #e2e8f0;
        color: #0f172a;
        font-weight: 800;
        text-decoration: none;
      }
      .primaryLink {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 42px;
        padding: 0 16px;
        border-radius: 10px;
        background: #111827;
        border: 1px solid #111827;
        color: #fff;
        font-weight: 900;
        text-decoration: none;
      }
      .sampleGrid {
        display: grid;
        grid-template-columns: 1.3fr 0.9fr;
        gap: 18px;
      }
      .lockedGrid {
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
      .loadingCard,
      .lockedCard {
        max-width: 720px;
      }
      .lockedEyebrow {
        color: #b91c1c;
        font-size: 12px;
        font-weight: 900;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        margin-bottom: 8px;
      }
      .lockedText {
        color: #475569;
        font-size: 15px;
        line-height: 1.6;
        margin: 10px 0 16px;
      }
      .samplePage h2 {
        margin: 0;
        color: #0f172a;
        font-size: 22px;
        font-weight: 900;
      }
      .samplePage h3 {
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
  );
}
