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

- Catalog product cards show `Log in to view pricing` instead of a price for signed-out users.
- Product detail pages show a styled pricing box asking the visitor to log in.
- Cart rows and cart total show `Log in to view pricing` for signed-out users.
- Checkout requires login before quote pricing or the quote PDF can be viewed.
- Logged-in users continue to see pricing normally, including tier pricing when applicable.

Customer-facing message:

```txt
Log in to view pricing
```

Design notes:

- The price area should never be left empty.
- The message should remain readable on mobile and desktop.
- The catalog and product pages should remain usable for browsing.
- Customers can browse products before login, then log in when ready to view pricing or check out.

Important note:

This is a storefront display behavior. For stronger protection in a future phase, pricing can be moved behind authenticated reads or a server-side pricing flow.

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

## Sample request behavior

The sample request form now requires a phone number.

Current required fields:

- Company name
- Contact name
- Phone number
- Sample delivery address

Optional fields:

- Website
- Email address

The form no longer requires a website or name card image URL before submitting.

## Firestore rules reminder

The Firestore rules must allow the `phone` field in `registration_requests` and `sample_requests`.

The current public create rules should validate:

- `registration_requests.phone` as a required string with a reasonable max length.
- `sample_requests.phone` as a required string with a reasonable max length.
- `sample_requests.website` as optional.
- `sample_requests.email` as optional.
