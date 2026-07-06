# Latest storefront behaviors

This note summarizes the latest behavior changes added to the H2 Hardware storefront.

## Cart behavior

The cart is stored in the browser using `localStorage` under the key `starpro_cart_v1`.

Current behavior:

- The cart stores only product `slug`, quantity `qty`, and an internal `updatedAt` timestamp.
- Prices are not stored in the cart. Prices are recalculated from current product data when the cart, checkout, order, or PDF is generated.
- When a customer logs out, the cart is cleared immediately.
- If the customer does not log out, the cart expires automatically after 48 hours of inactivity.
- Any cart change, such as add, remove, or quantity update, refreshes the cart timestamp.
- Older carts saved as a plain array are still readable for compatibility.

## Price visibility behavior

Public prices are hidden from visitors who are not logged in.

Current behavior:

- Catalog product cards show a subtle `Pricing available after sign in` message instead of a price for signed-out users.
- Product detail pages show a simple pricing card for signed-out users, without repeating login buttons inside the pricing area.
- Cart rows avoid repeated price warnings. The main signed-out pricing message appears in the cart summary area.
- Checkout requires login before quote pricing or the quote PDF can be viewed.
- Logged-in users continue to see pricing normally, including tier pricing when applicable.

Customer-facing message:

```txt
Pricing available after sign in
```

Design notes:

- The price area should never be left empty.
- The message should be calm and readable, not styled like an error.
- Avoid repeating the word login in every row/card.
- The catalog and product pages should remain usable for browsing.
- Customers can browse products before login, then sign in when ready to view pricing or check out.

Important note:

This is a storefront display behavior. For stronger protection in a future phase, pricing can be moved behind authenticated reads or a server-side pricing flow.

## Catalog PDF download behavior

The catalog page includes a customer-facing `Download Catalog PDF` button.

Current behavior:

- The PDF is generated in the browser from active product records.
- The PDF includes the H2 Hardware logo, contact information, generation date, product categories, product names, item codes, descriptions/features, and product images when available.
- The PDF does not include public prices.
- The PDF shows the message `Pricing available after sign in`.
- The generated filename uses the current date, for example `h2-hardware-catalog-2026-07-01.pdf`.

Design notes:

- The button sits near the bottom of the catalog experience in a small catalog download card.
- The card is responsive and stacks cleanly on mobile.
- The PDF is intended as a commercial product catalog, not as a quote or price sheet.

## Registration request behavior

The public account access form now collects a phone number.

Current required fields:

- Name
- Email
- Phone number
- Company
- Delivery address

When an admin approves a registration request:

- The Firebase Auth user is created or re-enabled.
- The customer profile is saved or updated in `customers`.
- The customer profile includes name, company, email, phone, and delivery address when available.
- The account setup email is sent using the custom H2 Hardware email flow.

## Admin and super admin behavior

Admin access has two levels.

Super admins:

- Are fixed fallback admins in code and Firestore Rules.
- Can access admin pages.
- Can approve or re-enable users from Registration Requests.
- Can disable users from Registration Requests.
- Can grant admin access using `Make Admin`.
- Can remove admin access using `Remove Admin`.
- Keep admin access even if dynamic admin claims are changed.

Current super admin emails:

```txt
admin@starpro.com
admin@h2hardware.com
admin@h2hardwareltd.com
maia@h2hardwareltd.com
```

Operational admins:

- Are approved users who received the Firebase Auth custom claim `admin: true`.
- Can access admin pages after logging out and logging in again.
- Can perform admin operations allowed by Firestore Rules and server Functions.
- Cannot grant or remove admin access for other users.

Important behavior:

- The `Make Admin` button sets a Firebase Auth custom claim: `admin: true`.
- The `Remove Admin` button removes that custom claim.
- Only super admins can use `Make Admin` and `Remove Admin`.
- A user promoted to admin must log out and log in again so the Firebase token refreshes with the new claim.
- Firestore Rules must include `request.auth.token.admin == true` inside `isAdmin()` so operational admins can read admin data.

Recommended Firestore Rules helper:

```js
function isAdmin() {
  return isSignedIn() && (
    request.auth.token.admin == true
    || request.auth.token.email in [
      "admin@starpro.com",
      "admin@h2hardware.com",
      "admin@h2hardwareltd.com",
      "maia@h2hardwareltd.com"
    ]
  );
}
```

## Sample request behavior

The sample request form requires phone number and email address.

Current required fields:

- Company name
- Contact name
- Phone number
- Email address
- Sample delivery address

Optional fields:

- Website

The form no longer requires a website or name card image URL before submitting.

After submitting a sample request:

- The customer sees a confirmation message on the page.
- H2 Hardware receives the internal sample request notification.
- The customer receives an automatic confirmation email saying the request was received and the team will organize the sample shipment as soon as possible.

## Firestore rules reminder

The Firestore rules must allow the `phone` and `email` fields in `registration_requests` and `sample_requests`.

The current public create rules should validate:

- `registration_requests.phone` as a required string with a reasonable max length.
- `sample_requests.phone` as a required string with a reasonable max length.
- `sample_requests.email` as a required valid email string with a reasonable max length.
- `sample_requests.website` as optional.
- `isAdmin()` as either a super admin email or `request.auth.token.admin == true`.
