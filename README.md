# H2 Hardware Website

Commercial catalog and admin website for **H2 Hardware Ltd.**

The site supports product browsing, cart, checkout, customer account requests, sample requests, order management, product administration, and automated email notifications through Firebase Cloud Functions.

Live domain:

```txt
https://h2hardwareltd.com
```

Primary Firebase project:

```txt
starpro-web
```

For the detailed operational handover, see:

```txt
docs/site-admin-guide.md
```

---

## Table of contents

- [Overview](#overview)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Main flows](#main-flows)
- [Admin features](#admin-features)
- [Environment variables](#environment-variables)
- [Firebase secrets](#firebase-secrets)
- [Local development](#local-development)
- [Build and deploy](#build-and-deploy)
- [Operational notes](#operational-notes)

---

## Overview

This project is a static-exported Next.js application hosted on Firebase Hosting, with Firebase used for authentication, database, hosting rewrites, and backend functions.

The frontend is exported to the `out` folder and deployed by Firebase Hosting.

Key capabilities:

- Product catalog and product detail pages.
- Cart stored in the customer's browser.
- Checkout and order creation.
- Customer order history.
- Public account access request form.
- Admin approval, enable, disable, and admin role actions for users.
- Sample request flow available only to logged-in approved customers.
- Admin review pages for orders, products, registration requests, and sample requests.
- Email notifications for orders, registration requests, and sample requests.

---

## Tech stack

- Next.js App Router
- React
- TypeScript
- Firebase Hosting
- Firebase Authentication
- Firestore
- Firebase Cloud Functions
- Firebase Admin SDK
- Nodemailer / SMTP
- jsPDF

Runtime notes:

- Frontend build command: `npm run build`
- Functions build command: `cd functions && npm run build`
- Cloud Functions runtime: Node.js 20
- Static hosting output folder: `out`

---

## Project structure

```txt
app/                         Next.js App Router pages
components/                  Shared UI components
lib/                         Firebase client and shared frontend helpers
functions/src/               Firebase Cloud Functions source
docs/site-admin-guide.md     Current operational/admin guide
firebase.json                Hosting, cache headers, and function rewrites
next.config.ts               Static export configuration
```

Important files:

```txt
app/sample-request/page.tsx
app/registration-request/page.tsx
app/admin/registration-requests/page.tsx
app/admin/sample-requests/page.tsx
app/contact/page.tsx
functions/src/index.ts
functions/src/adminActionsHttp.ts
functions/src/accountEmailHttp.ts
```

---

## Main flows

### Catalog and products

Customers can browse products from `/` or `/catalog`, open product detail pages, select quantities, and add items to the cart.

Product detail route:

```txt
/product?slug=PRODUCT_SLUG
```

The cart stores only the product slug and quantity in browser `localStorage`. Product data and prices are recalculated from Firestore when displayed.

Current cart key:

```txt
starpro_cart_v1
```

### Checkout and orders

Checkout creates a document in the `orders` collection. When a new order is created, the `notifyNewOrder` Cloud Function sends:

- an internal email to H2 Hardware;
- an order received email to the customer when a valid customer email is available.

### Account access request

Public route:

```txt
/registration-request
```

Customers use this page to request account access. The form does not create login access automatically.

Current fields:

- Name — required.
- Email — required.
- Phone number — required.
- Company — required.
- Website — optional.
- Delivery address — required.

Submitted documents are stored in:

```txt
registration_requests
```

Admins review and approve access from:

```txt
/admin/registration-requests
```

When approved, user and customer data are created/enabled through Firebase Auth and Firestore.

### Sample request

Public route:

```txt
/sample-request
```

Current behavior:

- Users who are not logged in cannot submit a sample request.
- The page shows that account access is required and provides a button to request access.
- Logged-in customers see a prefilled form using data from `customers/{uid}` when available.
- Website is not collected on the sample request form.

Required requester-facing step-by-step copy:

```txt
How to Request a Free Sample

To qualify for a free sample, please complete the following steps:

1. Register for an account on the H2 Hardware website.
2. Complete and submit the Free Sample Request Form.
```

Submitted documents are stored in:

```txt
sample_requests
```

### Contact

Public route:

```txt
/contact
```

Current contact information:

```txt
Phone: +1 (226) 788-1924
Email: info@h2hardwareltd.com
Address: 4510 10 St NE, Calgary, AB T2E 6K3
```

---

## Admin features

Admin links appear based on frontend admin configuration and/or Firebase custom claims.

Frontend admin emails are controlled by:

```txt
NEXT_PUBLIC_ADMIN_EMAILS
```

Because this variable is public and used by the frontend, changes require a new frontend build and hosting deploy.

Main admin pages:

```txt
/admin/orders
/admin/products
/admin/products/edit
/admin/sample-requests
/admin/registration-requests
/admin/carousel-builder
/admin/category-highlights
```

Registration request admin actions are routed through Firebase Hosting rewrites to HTTP Cloud Functions:

```txt
/api/admin/registration-requests/approve
/api/admin/registration-requests/disable
/api/admin/registration-requests/set-admin
```

This avoids direct browser calls to `cloudfunctions.net` and keeps admin actions under the same public domain.

---

## Environment variables

The frontend requires Firebase public configuration variables.

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

Optional admin configuration:

```bash
NEXT_PUBLIC_ADMIN_EMAILS=admin@example.com,another-admin@example.com
```

Do not commit real environment files or credentials.

---

## Firebase secrets

Cloud Functions email delivery uses SMTP secrets.

Set them once per Firebase project:

```bash
firebase functions:secrets:set SMTP_USER
firebase functions:secrets:set SMTP_PASSWORD
```

Email sending depends on:

- the secrets being configured in the correct Firebase project;
- the functions being deployed after email-related changes;
- the SMTP account allowing the configured authentication method.

---

## Local development

Install dependencies on first setup:

```bash
npm install
cd functions
npm install
cd ..
```

Start the frontend locally:

```bash
npm run dev
```

Build the frontend:

```bash
npm run build
```

Build Cloud Functions:

```bash
cd functions
npm run build
cd ..
```

---

## Build and deploy

Always confirm the active Firebase project before deploying:

```bash
firebase use
```

Expected project:

```txt
starpro-web
```

### Deploy only the website

Use when only frontend pages, CSS, content, or client-side behavior changed.

```bash
git pull origin main
npm run build
firebase deploy --only hosting
```

### Deploy website and functions

Use when Cloud Functions, emails, admin HTTP actions, or backend behavior changed.

```bash
git pull origin main
npm run build

cd functions
npm run build
cd ..

firebase deploy --only hosting,functions
```

### Deploy only functions

Use when only Cloud Functions changed.

```bash
git pull origin main

cd functions
npm run build
cd ..

firebase deploy --only functions
```

---

## Operational notes

- Keep the official H2 Hardware logo exactly as provided. Do not recreate it manually with a different font, border, spacing, or proportions.
- Do not change domain, DNS, Firebase Hosting, or public routing settings without confirmation.
- If a frontend change works locally but not on production, confirm that `firebase deploy --only hosting` was completed and clear browser/cache if needed.
- If email notifications fail, confirm SMTP secrets and redeploy functions.
- If admin links do not appear, confirm the admin email configuration and redeploy hosting.
- Keep the Sample Request step-by-step wording unchanged unless the requester approves a copy change.
- For detailed operational behavior and admin usage, maintain `docs/site-admin-guide.md` as the source of truth.

---

## Delivery checklist

Before handing over a change:

- Run the relevant build command.
- Deploy hosting and/or functions according to the change type.
- Test the affected public page or admin page.
- For email changes, create or trigger a safe test event and confirm delivery/logs.
- Confirm the live site is showing the latest deployed version.
