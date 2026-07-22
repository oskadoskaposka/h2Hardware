"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { addDoc, collection, getFirestore, serverTimestamp } from "firebase/firestore";
import { app } from "../../lib/firebaseClient";

type FormState = {
  name: string;
  email: string;
  phone: string;
  company: string;
  website: string;
  shippingAddress: string;
};

type SubmittedRequest = {
  id: string;
  email: string;
};

const THANK_YOU_TEXT =
  "Thanks, your request was received. H2 Hardware will review it unless you activate it with an access code below.";

const EMPTY_FORM: FormState = {
  name: "",
  email: "",
  phone: "",
  company: "",
  website: "",
  shippingAddress: "",
};

const CONTACT_PHONE = "+1 (226) 788-1924";
const CONTACT_PHONE_LINK = "tel:+12267881924";
const CONTACT_EMAIL = "info@h2hardwareltd.com";
const CONTACT_EMAIL_LINK = "mailto:info@h2hardwareltd.com";
const CONTACT_ADDRESS = "4510 10 St NE, Calgary, AB T2E 6K3";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function RegistrationRequestPage() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submittedRequest, setSubmittedRequest] = useState<SubmittedRequest | null>(null);
  const [accessCode, setAccessCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checkingCode, setCheckingCode] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [codeError, setCodeError] = useState("");
  const [codeSuccess, setCodeSuccess] = useState("");

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validate() {
    const name = form.name.trim();
    const email = form.email.trim();
    const phone = form.phone.trim();
    const company = form.company.trim();
    const shippingAddress = form.shippingAddress.trim();

    if (!name) return "Name is required.";
    if (!email) return "Email is required.";
    if (!isValidEmail(email)) return "Please enter a valid email address.";
    if (!phone) return "Phone number is required.";
    if (!company) return "Company is required.";
    if (!shippingAddress) return "Delivery address is required.";

    return "";
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setCodeError("");
    setCodeSuccess("");
    setSubmittedRequest(null);

    const validation = validate();
    if (validation) {
      setErrorMsg(validation);
      return;
    }

    try {
      setSubmitting(true);
      const email = form.email.trim().toLowerCase();
      const db = getFirestore(app);
      const requestRef = await addDoc(collection(db, "registration_requests"), {
        name: form.name.trim(),
        email,
        phone: form.phone.trim(),
        company: form.company.trim(),
        website: form.website.trim(),
        shippingAddress: form.shippingAddress.trim(),
        status: "new",
        createdAt: serverTimestamp(),
      });

      setSubmittedRequest({ id: requestRef.id, email });
      setSuccessMsg(THANK_YOU_TEXT);
      setForm(EMPTY_FORM);
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Failed to submit the request.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAccessCode(e: FormEvent) {
    e.preventDefault();
    if (!submittedRequest) return;

    setCodeError("");
    setCodeSuccess("");

    if (!accessCode.trim()) {
      setCodeError("Enter your access code.");
      return;
    }

    try {
      setCheckingCode(true);
      const response = await fetch("/api/auth/registration-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: submittedRequest.id,
          code: accessCode,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 429) {
        throw new Error("Too many attempts. Please wait 15 minutes and try again.");
      }
      if (!response.ok) {
        throw new Error(String(data?.error || "Could not validate the access code."));
      }
      if (data?.approved !== true) {
        setCodeError(
          "Invalid or unavailable access code. Your request is still waiting for H2 Hardware review.",
        );
        return;
      }

      const emailResponse = await fetch("/api/auth/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(data.email || submittedRequest.email),
          purpose: "approval",
        }),
      });
      const emailData = await emailResponse.json().catch(() => ({}));

      setAccessCode("");
      setCodeSuccess(
        emailResponse.ok && emailData?.sent === true
          ? "Your account was created. Check your email to create your password."
          : "Your account was created, but the setup email could not be sent. Use Forgot password on the login page to create your password.",
      );
    } catch (e) {
      setCodeError(e instanceof Error ? e.message : "Could not validate the access code.");
    } finally {
      setCheckingCode(false);
    }
  }

  return (
    <main className="page">
      <div className="wrap">
        <div className="hero">
          <div>
            <div className="eyebrow">H2 Hardware</div>
            <h1>Request Account Access</h1>
            <p>
              Fill in your information below. H2 Hardware can review your request,
              or you can activate it immediately with a valid access code.
            </p>
          </div>

          <div className="heroLinks">
            <Link href="/login" className="ghostBtn">Back to login</Link>
            <Link href="/catalog" className="ghostBtn">Catalog</Link>
          </div>
        </div>

        <div className="grid">
          <section className="starCard">
            <div className="starCardHeader">ACCOUNT REQUEST</div>
            <div className="starCardBody">
              <div className="miniNotice">
                <div className="miniNoticeTitle">Account access</div>
                <div className="miniNoticeText">
                  Submit your information first. If you have an H2 Hardware access
                  code, you can use it after the request is received.
                </div>
              </div>

              <form onSubmit={handleSubmit} className="form">
                <div className="field">
                  <label>Name *</label>
                  <input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Your full name" autoComplete="name" />
                </div>
                <div className="field">
                  <label>Email *</label>
                  <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="email@company.com" autoComplete="email" />
                </div>
                <div className="field">
                  <label>Phone number *</label>
                  <input value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+1 403 000 0000" autoComplete="tel" />
                </div>
                <div className="field">
                  <label>Company *</label>
                  <input value={form.company} onChange={(e) => update("company", e.target.value)} placeholder="Company name" autoComplete="organization" />
                </div>
                <div className="field">
                  <label>Website</label>
                  <input value={form.website} onChange={(e) => update("website", e.target.value)} placeholder="Company website" autoComplete="url" />
                  <div className="help">Optional.</div>
                </div>
                <div className="field">
                  <label>Delivery address *</label>
                  <textarea value={form.shippingAddress} onChange={(e) => update("shippingAddress", e.target.value)} placeholder="Street, city, province, postal code" autoComplete="street-address" rows={4} />
                </div>

                {errorMsg ? <div className="error">{errorMsg}</div> : null}
                {successMsg ? <div className="success">{successMsg}</div> : null}

                <button type="submit" className="submitBtn" disabled={submitting}>
                  {submitting ? "Sending..." : "Submit access request"}
                </button>
              </form>

              {submittedRequest ? (
                <section className="codeSection">
                  <div className="codeTitle">Do you have an access code?</div>
                  <p>Enter it below to create your account without waiting for manual approval.</p>
                  <form onSubmit={handleAccessCode} className="codeForm">
                    <input
                      value={accessCode}
                      onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                      placeholder="H2-WEI-8K4P-X2LM"
                      maxLength={64}
                      autoComplete="off"
                      spellCheck={false}
                      disabled={!!codeSuccess}
                    />
                    <button type="submit" disabled={checkingCode || !!codeSuccess}>
                      {checkingCode ? "Checking..." : "Use access code"}
                    </button>
                  </form>
                  <div className="help">No code? Nothing else is required. H2 Hardware will review your request.</div>
                  {codeError ? <div className="error codeMessage">{codeError}</div> : null}
                  {codeSuccess ? <div className="success codeMessage">{codeSuccess}</div> : null}
                </section>
              ) : null}
            </div>
          </section>

          <aside className="starCard sideCard">
            <div className="starCardHeader">CONTACT US</div>
            <div className="starCardBody">
              <p className="muted">Any questions before requesting access? Contact our team and we will be happy to help.</p>
              <div className="contactBox">
                <div className="contactItem"><div className="contactLabel">Phone</div><a href={CONTACT_PHONE_LINK} className="contactValue">{CONTACT_PHONE}</a></div>
                <div className="contactItem"><div className="contactLabel">Email</div><a href={CONTACT_EMAIL_LINK} className="contactValue">{CONTACT_EMAIL}</a></div>
                <div className="contactItem"><div className="contactLabel">Address</div><div className="contactValue">{CONTACT_ADDRESS}</div></div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <style jsx>{`
        .page { min-height: 100vh; background: #f4f6f8; padding: 24px 0 60px; }
        .wrap { max-width: 1180px; margin: 0 auto; padding: 0 18px; }
        .hero { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 18px; }
        .eyebrow { display: inline-block; font-size: 12px; font-weight: 900; letter-spacing: 0.08em; text-transform: uppercase; color: #b91c1c; margin-bottom: 8px; }
        h1 { margin: 0; font-size: 34px; line-height: 1.05; font-weight: 950; color: #0f172a; }
        .hero p { margin: 10px 0 0; color: #64748b; font-size: 14px; max-width: 700px; }
        .heroLinks { display: flex; gap: 10px; flex-wrap: wrap; }
        .ghostBtn { display: inline-flex; align-items: center; justify-content: center; height: 42px; padding: 0 14px; border-radius: 10px; background: #fff; border: 1px solid #e2e8f0; color: #0f172a; font-weight: 800; text-decoration: none; }
        .grid { display: grid; grid-template-columns: minmax(320px, 560px) minmax(320px, 420px); gap: 28px; justify-content: center; align-items: start; }
        @media (max-width: 980px) { .grid { grid-template-columns: 1fr; } }
        .starCard { background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; overflow: hidden; box-shadow: 0 10px 26px rgba(0, 0, 0, 0.07); }
        .starCardHeader { background: linear-gradient(180deg, #121212, #000); color: #fff; font-weight: 900; font-size: 13px; padding: 12px 14px; letter-spacing: 0.08em; text-transform: uppercase; border-bottom: 3px solid #b91c1c; }
        .starCardBody { padding: 16px; }
        .miniNotice { background: rgba(185, 28, 28, 0.06); border: 1px solid rgba(185, 28, 28, 0.22); border-left: 5px solid #b91c1c; border-radius: 12px; padding: 12px; margin-bottom: 14px; }
        .miniNoticeTitle { font-weight: 900; color: #b91c1c; font-size: 13px; margin-bottom: 6px; }
        .miniNoticeText, .muted { font-size: 13px; font-weight: 650; color: #111; line-height: 1.45; }
        .muted { margin: 0 0 14px; color: #555; font-weight: 500; }
        .form { display: grid; gap: 14px; }
        .field { display: grid; gap: 6px; }
        .field label { color: #0f172a; font-size: 13px; font-weight: 900; }
        .field input, .field textarea, .codeForm input { width: 100%; box-sizing: border-box; border: 1px solid #d1d5db; border-radius: 12px; padding: 12px 14px; font-size: 14px; outline: none; background: #fff; font-family: inherit; }
        .field textarea { resize: vertical; min-height: 90px; }
        .field input:focus, .field textarea:focus, .codeForm input:focus { border-color: #94a3b8; }
        .help { font-size: 12px; color: #64748b; line-height: 1.35; }
        .error { background: #fff; border: 1px solid rgba(185, 28, 28, 0.24); border-left: 6px solid #b91c1c; border-radius: 12px; padding: 14px; color: #7f1d1d; font-size: 13px; font-weight: 700; }
        .success { background: rgba(16, 185, 129, 0.07); border: 1px solid rgba(16, 185, 129, 0.22); border-left: 6px solid #10b981; border-radius: 12px; padding: 14px; color: #065f46; font-size: 13px; font-weight: 700; }
        .submitBtn { height: 46px; border: none; border-radius: 12px; background: #b91c1c; color: #fff; font-weight: 900; font-size: 14px; cursor: pointer; }
        .submitBtn:disabled, .codeForm button:disabled { opacity: 0.7; cursor: not-allowed; }
        .codeSection { margin-top: 18px; padding-top: 18px; border-top: 1px solid #e2e8f0; }
        .codeTitle { color: #0f172a; font-size: 17px; font-weight: 950; }
        .codeSection p { margin: 6px 0 12px; color: #475569; font-size: 13px; line-height: 1.45; }
        .codeForm { display: grid; grid-template-columns: 1fr auto; gap: 9px; margin-bottom: 8px; }
        .codeForm button { border: 0; border-radius: 12px; background: #0f172a; color: #fff; padding: 0 16px; font-weight: 900; cursor: pointer; }
        .codeMessage { margin-top: 12px; }
        @media (max-width: 620px) { .codeForm { grid-template-columns: 1fr; } .codeForm button { min-height: 44px; } }
        .sideCard { align-content: start; }
        .contactBox { display: grid; gap: 10px; }
        .contactItem { border: 1px solid #eef2f7; border-radius: 12px; padding: 12px; background: #fbfcfd; }
        .contactLabel { color: #64748b; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 4px; }
        .contactValue { color: #0f172a; font-size: 15px; font-weight: 900; line-height: 1.45; overflow-wrap: anywhere; text-decoration: none; }
      `}</style>
    </main>
  );
}
