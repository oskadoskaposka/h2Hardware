# Non-Billable Corrections

This file records fixes that are considered internal corrections/rework and must not be included in future client billing.

## 2026-09-01 — Admin order PDF filename

- Area: Admin → Orders
- File: `app/admin/orders/page.tsx`
- Correction: changed generated PDF filename from `starpro-order-<id>.pdf` to `h2-hardware-order-<id>.pdf`.
- Reason: residual StarPro branding remained in the reused code after the H2 Hardware migration.
- Billing status: **NON-BILLABLE**.
- Instruction: time spent identifying, correcting, validating, or deploying this specific fix must not be charged to the client in any future billing cycle.
