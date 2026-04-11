# H2 Hardware Website Handover

## Overview

This website was built for H2 Hardware as a product catalog and order workflow running on Firebase Hosting and Firestore.

The current version includes:

- Public product catalog
- Product detail pages
- Cart and order flow
- Admin product management
- Admin orders page
- Admin carousel builder
- Public sample request page
- Admin sample requests page
- Custom domain support through Firebase Hosting

---

## Main stack

- Next.js App Router
- React
- TypeScript
- Firebase Hosting
- Firebase Authentication
- Firestore

---

## Main public routes

- `/` or `/catalog`
  - Product catalog page
  - Includes category filters and homepage/catalog carousel
- `/product?slug=...`
  - Product details page
- `/about`
  - About page
- `/contact`
  - Contact page
- `/login`
  - Login page
- `/cart`
  - Cart page
- `/orders`
  - Customer orders page
- `/sample-request`
  - Public sample request form

---

## Main admin routes

Admin visibility depends on the email list inside:

`NEXT_PUBLIC_ADMIN_EMAILS`

Examples:
- `admin@starpro.com`
- `admin@h2hardware.com`

Admin routes:

- `/admin/orders`
  - View all orders
- `/admin/products`
  - Manage products
- `/admin/carousel-builder`
  - Manage catalog carousel slides
- `/admin/sample-requests`
  - View all sample request submissions

---

## Environment variables

Required environment variables:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_ADMIN_EMAILS=admin@starpro.com,admin@h2hardware.com

Important:

NEXT_PUBLIC_ADMIN_EMAILS supports multiple emails separated by commas
Because these are NEXT_PUBLIC_* variables, any change requires a new build and deploy
Firebase collections currently used
1. products

Stores all product catalog items.

Typical fields:

slug
name
series
category
description
publicPrice
currency
active
sortOrder
images
features

Important mapping:

series = main category
category = subcategory
2. orders

Stores customer orders.

Typical fields:

uid
userEmail
customer
items
total
currency
createdAt
3. site_config / catalog_carousel

Stores the carousel configuration used on the catalog page.

Document path:

site_config/catalog_carousel

Each slide can support:

title
subtitle
src
linkType
series
category
productSlug
pagePath
url

Supported linkType values:

filter
product
page
url

Examples:

filter: filters the catalog by category/subcategory
page: opens a page such as /sample-request
product: opens a product page by slug
url: opens an external link
4. sample_requests

Stores sample request submissions from the public form.

Fields:

companyName
website
nameCardImageUrl
phone
email
deliveryAddress
thankYouText
status
createdAt

Current implementation note:

The name card is stored as a URL, not as a file upload
This was intentionally done to keep the delivery simple, stable, and fast
If a future version needs direct image upload, Firebase Storage should be added
How to use the admin area
Admin products

Route:

/admin/products

Use this page to:

create products
edit products
activate/deactivate products
organize sort order

Recommended product data:

product name
slug
category
subcategory
public price
images
description
Admin orders

Route:

/admin/orders

Use this page to:

view all customer orders
search by order ID, customer email, customer name, UID, or product
generate PDF copies
Carousel builder

Route:

/admin/carousel-builder

Use this page to control the top carousel shown on the catalog page.

Each slide can be one of these types:

Filter

Use when the slide should filter the catalog.
Example:

Category: Premium
Subcategory: Window
Product

Use when the slide should open a specific product.
Example:

Product slug: premium-window-panel-x1
Internal page

Use when the slide should open a site page.
Example:

/sample-request
/about
/contact
External URL

Use when the slide should open another website.

Important:

The catalog page was updated to respect linkType
If a slide is configured as page, it will no longer be treated as a filter
Sample requests admin page

Route:

/admin/sample-requests

Use this page to:

view all sample request submissions
search by company, website, phone, email, address
open the name card image URL
review delivery information
Public sample request flow

Route:

/sample-request

The public form collects:

Company Name
Website
Name Card Picture URL
Phone Number
Email Address
Sample Delivery Address

Validation rules:

Company name is required
Delivery address is required
At least one of:
website
name card image URL
At least one of:
phone
email

Thank you text shown to the user:

Thanks, we will review your info and send you the sample.
Domain and hosting

The site is hosted through Firebase Hosting.

Custom domain:

h2hardwareltd.com

Domain notes:

The domain now points to Firebase Hosting
DNS propagation can take time after changes
If a domain is already connected in Firebase and the site still shows old content, this is often DNS cache or propagation
Build and deploy
Install dependencies
npm install
Run locally
npm run dev
Build
npm run build
Deploy

Use your existing Firebase deployment process.

Typical command:

firebase deploy

If only Hosting should be deployed:

firebase deploy --only hosting

If Firestore rules are updated:

firebase deploy --only firestore:rules
Git notes

If moving the project to a new repository:

Check remotes:

git remote -v

Replace the old origin:

git remote remove origin
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main

If origin should be kept as backup:

git remote rename origin old-origin
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
Final delivery checklist

Before final delivery, confirm:

Domain is connected and working
Admin email list is correct
Product catalog loads correctly
Orders page works for admin
Carousel builder saves and reflects changes
Sample request form submits correctly
Sample requests admin page loads correctly
Thank you message is correct
Branding text is reviewed
About page content is reviewed
Contact page content is reviewed
Recommended future improvements

These are not required for the current delivery, but they may be useful later:

Direct name card upload using Firebase Storage
Status editing for sample requests
CSV export for sample requests
Email notification after sample request submission
Richer admin dashboard
More polished final branding assets and logo file naming
Final note

This version is designed to be practical and stable for handover.

The key goal was to keep the website easy to use, easy to update, and safe to deploy without adding unnecessary complexity before launch.