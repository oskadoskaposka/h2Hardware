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
  const [accessCode, setAccessCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pendingRequestId, setPendingRequestId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const hasAccessCode = accessCode.trim().length > 0;
  const requestSaved = pendingRequestId.length > 0;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  function updateAccessCode(value: string) {
    const normalized = value.toUpperCase();
    setAccessCode(normalized);

    if (!normalized.trim() && !requestSaved) {
      setPassword("");
      setConfirmPassword("");
    }
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setAccessCode("");
    setPassword("");
    setConfirmPassword("");
    setPendingRequestId("");
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

    if (hasAccessCode) {
      if (accessCode.trim().length < 10) {
        return "Please enter a valid access code.";
      }
      if (password.length < 8) {
        return "Password must contain at least 8 characters.";
      }
      if (password.length > 128) {
        return "Password cannot contain more than 128 characters.";
      }
      if (password !== confirmPassword) {
        return "Password and confirmation do not match.";
      }
    }

    return "";
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    const validation = validate();
    if (validation) {
      setErrorMsg(validation);
      return;
    }

    let requestId = pendingRequestId;

    try {
      setSubmitting(true);

      if (!requestId) {
        const email = form.email.trim().toLowerCase();
        const db = getFirestore(app);
        const requestRef = await addDoc(collection(db, "registration_requests"), {
          name: form.name.trim(),
          email,
          phone: form.phone.trim(),
          company: form.company.trim(),
          website: form.website.trim(),
          shippingAddress: form.shippingAddress.trim(),
          ...(hasAccessCode
            ? { submittedAccessCode: accessCode.trim().toUpperCase() }
            : {}),
          status: "new",
          createdAt: serverTimestamp(),
        });

        requestId = requestRef.id;
        setPendingRequestId(requestId);
      }

      if (!hasAccessCode) {
        setSuccessMsg(
          "Thanks, your request was received. H2 Hardware will review it and contact you when your account is approved.",
        );
        resetForm();
        return;
      }

      const response = await fetch("/api/auth/registration-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          code: accessCode,
          password,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 429) {
        setSuccessMsg("Your request is saved for review.");
        setErrorMsg("Too many code attempts. Please wait 15 minutes before trying again.");
        return;
      }

      if (response.status === 409) {
        setSuccessMsg("Your request is saved for review.");
        setErrorMsg(
          String(
            data?.error ||
              "An account already exists for this email. Please log in or use Forgot password.",
          ),
        );
        return;
      }

      if (!response.ok) {
        throw new Error(
          String(data?.error || "Could not complete immediate account activation."),
        );
      }

      if (data?.approved !== true) {
        setSuccessMsg("Your request is saved for review.");
        setErrorMsg(
          "Invalid access code. Correct the code and password, then try again.",
        );
        return;
      }

      setSuccessMsg(
        "Your account is ready. You can now sign in using the email and password you entered.",
      );
      resetForm();
    } catch (error) {
      if (requestId) {
        setSuccessMsg("Your request is saved for review.");
        setErrorMsg(
          "Immediate account activation could not be completed. Check the code and try again, or wait for H2 Hardware review.",
        );
      } else {
        setErrorMsg(
          error instanceof Error ? error.message : "Failed to submit the request.",
        );
      }
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
            <h1>Request Account Access</h1>
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
              <form onSubmit={handleSubmit} className="form">
                <div className="field">
                  <label>Name *</label>
                  <input
                    value={form.name}
                    onChange={(event) => update("name", event.target.value)}
                    placeholder="Your full name"
                    autoComplete="name"
                    disabled={requestSaved}
                  />
                </div>

                <div className="field">
                  <label>Email *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => update("email", event.target.value)}
                    placeholder="email@company.com"
                    autoComplete="email"
                    disabled={requestSaved}
                  />
                </div>

                <div className="field">
                  <label>Phone number *</label>
                  <input
                    value={form.phone}
                    onChange={(event) => update("phone", event.target.value)}
                    placeholder="+1 403 000 0000"
                    autoComplete="tel"
                    disabled={requestSaved}
                  />
                </div>

                <div className="field">
                  <label>Company *</label>
                  <input
                    value={form.company}
                    onChange={(event) => update("company", event.target.value)}
                    placeholder="Company name"
                    autoComplete="organization"
                    disabled={requestSaved}
                  />
                </div>

                <div className="field">
                  <label>Website</label>
                  <input
                    value={form.website}
                    onChange={(event) => update("website", event.target.value)}
                    placeholder="Company website"
                    autoComplete="url"
                    disabled={requestSaved}
                  />
                  <div className="help">Optional.</div>
                </div>

                <div className="field">
                  <label>Delivery address *</label>
                  <textarea
                    value={form.shippingAddress}
                    onChange={(event) => update("shippingAddress", event.target.value)}
                    placeholder="Street, city, province, postal code"
                    autoComplete="street-address"
                    rows={4}
                    disabled={requestSaved}
                  />
                </div>

                <section className="accountAccess">
                  <div className="sectionTitle">Account access</div>

                  <div className="field">
                    <label>Access code</label>
                    <input
                      value={accessCode}
                      onChange={(event) => updateAccessCode(event.target.value)}
                      placeholder="H2-ACCESS-2026"
                      maxLength={64}
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </div>

                  <div className="passwordGrid">
                    <div className="field">
                      <label>Password</label>
                      <input
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Create your password"
                        minLength={8}
                        maxLength={128}
                        autoComplete="new-password"
                        disabled={!hasAccessCode}
                      />
                    </div>

                    <div className="field">
                      <label>Confirm password</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        placeholder="Confirm your password"
                        minLength={8}
                        maxLength={128}
                        autoComplete="new-password"
                        disabled={!hasAccessCode}
                      />
                    </div>
                  </div>
                </section>

                {errorMsg ? <div className="error">{errorMsg}</div> : null}
                {successMsg ? <div className="success">{successMsg}</div> : null}

                <button
                  type="submit"
                  className="submitBtn"
                  disabled={submitting || (requestSaved && !hasAccessCode)}
                >
                  {submitting
                    ? requestSaved ? "Checking..." : "Sending..."
                    : requestSaved
                      ? hasAccessCode ? "Try access code again" : "Request submitted"
                      : hasAccessCode
                        ? "Create account"
                        : "Submit access request"}
                </button>
              </form>
            </div>
          </section>

          <aside className="starCard sideCard">
            <div className="starCardHeader">CONTACT US</div>
            <div className="starCardBody">
              <p className="muted">Questions? Contact our team.</p>

              <div className="contactBox">
                <div className="contactItem">
                  <div className="contactLabel">Phone</div>
                  <a href={CONTACT_PHONE_LINK} className="contactValue">{CONTACT_PHONE}</a>
                </div>

                <div className="contactItem">
                  <div className="contactLabel">Email</div>
                  <a href={CONTACT_EMAIL_LINK} className="contactValue">{CONTACT_EMAIL}</a>
                </div>

                <div className="contactItem">
                  <div className="contactLabel">Address</div>
                  <div className="contactValue">{CONTACT_ADDRESS}</div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <style jsx>{`
        .page { min-height: 100vh; background: #f4f6f8; padding: 24px 0 60px; }
        .wrap { max-width: 1180px; margin: 0 auto; padding: 0 18px; }
        .hero { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 18px; }
        .eyebrow { display: inline-block; font-size: 12px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; color: #b91c1c; margin-bottom: 8px; }
        h1 { margin: 0; font-size: 34px; line-height: 1.05; font-weight: 950; color: #0f172a; }
        .heroLinks { display: flex; gap: 10px; flex-wrap: wrap; }
        .ghostBtn { display: inline-flex; align-items: center; justify-content: center; height: 42px; padding: 0 14px; border-radius: 10px; background: #fff; border: 1px solid #e2e8f0; color: #0f172a; font-weight: 800; text-decoration: none; }
        .grid { display: grid; grid-template-columns: minmax(320px, 620px) minmax(320px, 420px); gap: 28px; justify-content: center; align-items: start; }
        .starCard { background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; overflow: hidden; box-shadow: 0 10px 26px rgba(0, 0, 0, .07); }
        .starCardHeader { background: linear-gradient(180deg, #121212, #000); color: #fff; font-weight: 900; font-size: 13px; padding: 12px 14px; letter-spacing: .08em; text-transform: uppercase; border-bottom: 3px solid #b91c1c; }
        .starCardBody { padding: 18px; }
        .form { display: grid; gap: 14px; }
        .field { display: grid; gap: 6px; }
        .field label { color: #0f172a; font-size: 13px; font-weight: 900; }
        .field input, .field textarea { width: 100%; box-sizing: border-box; border: 1px solid #d1d5db; border-radius: 10px; padding: 12px 14px; font-size: 14px; outline: none; background: #fff; font-family: inherit; transition: border-color .18s ease, box-shadow .18s ease, background .18s ease, opacity .18s ease; }
        .field textarea { resize: vertical; min-height: 90px; }
        .field input:focus, .field textarea:focus { border-color: #94a3b8; box-shadow: 0 0 0 3px rgba(148, 163, 184, .14); }
        .field input:disabled, .field textarea:disabled { background: #f3f4f6; color: #64748b; cursor: not-allowed; opacity: .78; }
        .help { font-size: 12px; color: #64748b; line-height: 1.35; }
        .accountAccess { display: grid; gap: 14px; margin-top: 4px; padding-top: 18px; border-top: 1px solid #e5e7eb; }
        .sectionTitle { display: flex; align-items: center; gap: 9px; color: #0f172a; font-size: 14px; font-weight: 900; }
        .sectionTitle::before { content: ""; width: 4px; height: 18px; border-radius: 999px; background: #b91c1c; }
        .passwordGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .error { background: #fff; border: 1px solid rgba(185, 28, 28, .24); border-left: 5px solid #b91c1c; border-radius: 10px; padding: 13px; color: #7f1d1d; font-size: 13px; font-weight: 700; }
        .success { background: rgba(16, 185, 129, .07); border: 1px solid rgba(16, 185, 129, .22); border-left: 5px solid #10b981; border-radius: 10px; padding: 13px; color: #065f46; font-size: 13px; font-weight: 700; }
        .submitBtn { height: 48px; border: none; border-radius: 10px; background: #b91c1c; color: #fff; font-weight: 900; font-size: 14px; cursor: pointer; }
        .submitBtn:disabled { opacity: .7; cursor: not-allowed; }
        .sideCard { align-content: start; }
        .muted { margin: 0 0 14px; color: #555; font-size: 13px; line-height: 1.45; }
        .contactBox { display: grid; gap: 10px; }
        .contactItem { border: 1px solid #eef2f7; border-radius: 10px; padding: 12px; background: #fbfcfd; }
        .contactLabel { color: #64748b; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 4px; }
        .contactValue { color: #0f172a; font-size: 15px; font-weight: 900; line-height: 1.45; overflow-wrap: anywhere; text-decoration: none; }
        @media (max-width: 980px) { .grid { grid-template-columns: 1fr; } }
        @media (max-width: 620px) { .passwordGrid { grid-template-columns: 1fr; } }
      `}</style>
    </main>
  );
}
