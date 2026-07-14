# H2 Hardware Site Admin Guide

This guide describes the current operational flow for the H2 Hardware website.

Last updated: 2026-07-14

---

## 1. Current site flow

The website works as a commercial catalog with cart, checkout, customer account requests, sample requests, and admin review pages.

Main customer flow:

1. Customer browses the catalog.
2. Customer adds products to the cart.
3. Customer completes checkout.
4. An order is created in Firestore.
5. Email notifications are sent by Firebase Cloud Functions.

Main account/sample flow:

1. Customer requests account access.
2. Admin reviews the registration request.
3. Admin approves or disables the user from the admin page.
4. Approved users can log in.
5. Logged-in users can submit a sample request.

---

## 2. Public pages

### Catalog

Routes:

```txt
/
/catalog
```

Purpose:

- Show active products.
- Filter by category and subcategory.
- Open product detail pages.
- Add products to cart from the product page.

### Product detail

Route:

```txt
/product?slug=PRODUCT_SLUG
```

Purpose:

- Show product details.
- Calculate the current price.
- Apply tier pricing for logged-in customers when available.
- Add the selected quantity to cart.

Important behavior:

- If the selected quantity exceeds the internal availability threshold, the product can still be added to the cart.
- The customer only sees that the team will confirm availability.
- The site must not expose internal stock rules or thresholds.

### Cart

Route:

```txt
/cart
```

Purpose:

- Show cart items.
- Change quantities.
- Remove items.
- Recalculate totals.
- Continue to checkout.

The cart is stored in browser `localStorage`.

Current key:

```txt
starpro_cart_v1
```

### Checkout

Route:

```txt
/checkout
```

Purpose:

- Collect customer and delivery information.
- Create an order in Firestore.
- Allow PDF generation/viewing, according to the current implementation.
- Trigger order email notifications through Firebase Cloud Functions.

When an order is created in `orders`, the function `notifyNewOrder` sends:

- an internal email to H2 Hardware;
- an order received email to the customer, when the order has a valid email address.

### Login

Route:

```txt
/login
```

Purpose:

- Allow customers to sign in.
- Allow password reset.
- Show admin links for users considered admins by the frontend configuration.

### Registration request

Route:

```txt
/registration-request
```

Purpose:

- Public form used by customers to request account access.
- This form does not create login access automatically.
- Admin review is required before account access is created/enabled.

Current fields:

- Name — required.
- Email — required.
- Phone number — required.
- Company — required.
- Website — optional.
- Delivery address — required.

Firestore collection:

```txt
registration_requests
```

Current success message:

```txt
Thanks, we will review your request and contact you before creating the account.
```

### Sample request

Route:

```txt
/sample-request
```

Purpose:

- Allow approved/logged-in customers to submit a free sample request.
- Customers who are not logged in cannot submit the form.
- Instead of redirecting automatically, the page shows that account access is required and provides the account access request button.

Required requester-facing step-by-step text:

```txt
How to Request a Free Sample

To qualify for a free sample, please complete the following steps:

1. Register for an account on the H2 Hardware website.
2. Complete and submit the Free Sample Request Form.
```

Current logged-in form fields:

- Company Name — required.
- Contact Name — required.
- Phone Number — required.
- Email Address — required.
- Sample Delivery Address — required.

Important behavior:

- Website is not used on the sample request form.
- When the user is logged in, the form is prefilled from the `customers/{uid}` document when available.
- The user can still correct missing or outdated information before submitting.
- The created `sample_requests` document includes `uid` and `userEmail`.

Firestore collection:

```txt
sample_requests
```

Current success message:

```txt
Sample request received. We will contact you shortly.
```

### Contact

Route:

```txt
/contact
```

Current contact information:

```txt
Phone: +1 (226) 788-1924
Email: info@h2hardwareltd.com
Address: 4510 10 St NE, Calgary, AB T2E 6K3
```

The previous right-side panel "Before you contact us" was removed.

---

## 3. Admin pages

Admin links appear based on the frontend admin email configuration.

Configuration:

```txt
NEXT_PUBLIC_ADMIN_EMAILS
```

Changing this value requires a new frontend build and hosting deploy.

### Admin orders

Route:

```txt
/admin/orders
```

Purpose:

- Review all customer orders.
- Search orders.
- Review customer and delivery information.
- Generate/open order PDF according to the current implementation.

### Admin products

Routes:

```txt
/admin/products
/admin/products/edit
```

Purpose:

- Create products.
- Edit products.
- Activate/deactivate products.
- Configure price, tiers, stock, images, category, subcategory, description and sorting.

Important product mapping:

```txt
series   = main category
category = subcategory
```

Keep this mapping unless the catalog logic is also revised.

### Admin sample requests

Route:

```txt
/admin/sample-requests
```

Purpose:

- Review submitted sample requests.
- Search by company, contact, phone, email, address, status or requester information.

Current sample requests do not include website.

### Admin registration requests

Route:

```txt
/admin/registration-requests
```

Purpose:

- Review account access requests.
- Search by name, email, company, website, phone, address or status.
- Approve/create users.
- Enable existing users.
- Disable users without deleting history.

Main actions:

- `Approve / Create User`: creates or enables Firebase Auth access.
- `Approve / Enable User`: enables an existing user.
- `Disable User`: disables login access without deleting history.

When a registration request is approved, the customer profile is saved in:

```txt
customers/{uid}
```

Current customer profile data includes:

- name;
- email;
- phone;
- company;
- website;
- shipping address.

---

## 4. Email notifications

Emails are sent from Firebase Cloud Functions using SMTP secrets.

Required secrets:

```bash
firebase functions:secrets:set SMTP_USER
firebase functions:secrets:set SMTP_PASSWORD
```

### New order

Trigger:

```txt
orders/{orderId}
```

Function:

```txt
notifyNewOrder
```

Current behavior:

- Sends internal email: `[H2 Hardware] New order received`.
- Sends customer email: `[H2 Hardware] Order received`.

The customer email is sent only when a valid customer email is available in the order data.

### New registration request

Trigger:

```txt
registration_requests/{requestId}
```

Current behavior:

- Sends an internal notification to the H2 Hardware team.
- Includes phone and website when available.

### New sample request

Trigger:

```txt
sample_requests/{requestId}
```

Current behavior:

- Sends an internal notification to the H2 Hardware team.
- Does not include website, because website was removed from the sample form.

---

## 5. Deploy guide

### Pull latest changes

```bash
git pull origin main
```

### Build and deploy only the website

Use this when only frontend/pages/CSS changed.

```bash
npm run build
firebase deploy --only hosting
```

### Build and deploy website + functions

Use this when email logic, Cloud Functions, admin HTTP actions, or backend behavior changed.

```bash
npm run build

cd functions
npm run build
cd ..

firebase deploy --only hosting,functions
```

### Deploy only functions

Use this when only Cloud Functions changed.

```bash
cd functions
npm run build
cd ..

firebase deploy --only functions
```

### Confirm Firebase project before deploy

```bash
firebase use
```

Current expected Firebase project:

```txt
starpro-web
```

---

## 6. Operational notes

- Do not recreate or alter the official H2 Hardware logo manually. Use the provided logo asset.
- Avoid changing public domain or Firebase Hosting settings without confirming first.
- If a frontend change appears correct locally but not on the live site, check whether hosting was deployed and clear browser/cache if needed.
- If emails do not send, confirm Functions deployment and SMTP secrets first.
- If admin links do not appear for a user, confirm `NEXT_PUBLIC_ADMIN_EMAILS` and redeploy hosting after changes.
- Keep the Sample Request step-by-step text unchanged unless the requester approves the wording change.
