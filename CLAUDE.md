# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

RentHub: a rental property management app for house owners in Bangladesh (currency ৳, bKash/Nagad/Rocket payment methods, BERC electricity tariff). Monorepo with two independent npm packages:

- `backend/` — Express + TypeScript + Prisma (MySQL), runs on port 5000
- `frontend/` — React 18 + Vite + MUI + TanStack Query + Zustand, runs on port 3000 and proxies `/api` to the backend

No git repo, no test framework, no linter configured.

## Commands

From the root:
- `npm run dev` — run backend and frontend together (concurrently)
- `npm run install:all` — install both packages
- `npm run build` — `tsc` backend, `tsc && vite build` frontend (the frontend build is also the type check)
- `npm run db:migrate` / `npm run db:generate` — Prisma migrate dev / generate

From `backend/`:
- `npm run prisma:seed` — seed demo data (login `owner@demo.com` / `Test1234`)
- `npm run prisma:reset` — drop and re-migrate the DB (destructive)
- `npx tsx src/shared/utils/billing.check.ts` — the only test: assert-based checks for bill calculation

Config is in `backend/.env` (`DATABASE_URL`, JWT secrets/expiry, `PORT`, `CORS_ORIGIN`, rate limit, OTP expiry), loaded by `src/config/env.ts`. There is no email/SMS sender: OTPs and password-reset tokens are only printed to the backend console (`[DEV] OTP for ...`).

## Backend architecture

- `src/app.ts` mounts every module under `/api/v1/...` and starts the cron (`src/scheduledTasks.ts`), which auto-generates the previous month's invoices for all active owners at 00:00 on the 1st.
- Each module in `src/modules/<name>/` follows `routes → controller → service`, with zod schemas in `<name>.validation.ts` applied via `validate(schema)` middleware. Controllers wrap handlers in `asyncHandler`. **Response shape differs by module**: auth, bill-type, building, dashboard, flat, floor, tenant reply via `sendSuccess` (`{ success, message, data, meta }`, frontend unwraps `res.data.data`); invoice, payment, expense, report reply with raw `res.json(result)` (frontend unwraps `res.data`). Match the module's existing convention and its `frontend/src/api/*.ts` file. Throw the `AppError` subclasses from `shared/utils/errors.ts`; `errorHandler` turns them into JSON.
- Nested resources are mounted with `Router({ mergeParams: true })` under `/buildings/:buildingId/floors/:floorId/flats/:flatId/tenants`; modules also export a `topLevel*Router` (e.g. `/api/v1/flats`) for owner-wide listings.
- **Multi-tenancy is enforced in services, not middleware**: every query filters by the owner (`req.user.userId`), either directly via `ownerId` or through the relation chain `flat → floor → building.ownerId`. Keep this when adding queries.
- Auth: JWT access + refresh tokens (`authenticate`, `authorize(...roles)` in `middleware/auth.middleware.ts`). `userId` in the token is a string; convert with `toNumberId()` before Prisma calls.
- IDs are `BigInt` and money is `Decimal`. `shared/prisma.ts` patches `toJSON` so both serialize as JSON numbers. Use the shared `prisma` client from there.

### Billing / invoice flow (spans bill-type, invoice, payment modules)

- `BillType` (per owner) defines a charge with a `CalcMethod`: FIXED, METERED, SLAB, PER_PERSON, MANUAL. `FlatCharge` overrides the amount for one flat or opts it in/out; `BillEntry` holds per-flat monthly meter readings or typed amounts.
- `shared/utils/billing.ts` (`calcCharge`) is the pure calculator. **It is duplicated verbatim in `frontend/src/utils/billing.ts` — any change must be made in both files**, then rerun `billing.check.ts`.
- `InvoiceService.generate` uses `loadBillingContext`/`billableFlatWhere` from the bill-type service: Rent item + one `InvoiceItem` per applicable bill type. Metered/manual types with no entry are left off and returned as `missing`. Invoices are unique per flat+month+year; existing ones are skipped.
- **Carry-forward**: a new invoice pulls the `dueAmount` of the latest earlier invoice that isn't `carriedForward` into `previousDue`, then marks that invoice `carriedForward`. Payments on a carried-forward invoice are rejected, and deleting an invoice reopens the one it carried.
- `recalculateInvoice()` (exported from the invoice service) re-derives `paidAmount`/`dueAmount`/`status` from payments. Call it inside the transaction after any payment create/update/delete or invoice edit.
- Public share links: `POST /invoices/:id/share` creates a `shareToken`; `GET /api/v1/public/invoices/:token` (no auth, rate-limited) backs the frontend route `/i/:token`.

## Frontend architecture

- `@/` alias → `frontend/src`. Pages live in `src/features/<domain>/` (page components plus a `components/` folder of dialogs and forms), with routes in `src/routes/index.tsx` (protected routes sit inside `DashboardLayout`).
- `src/api/client.ts` exports the axios instance (base `/api/v1`, adds the bearer token, on 401 refreshes the token once and retries, otherwise logs out). One API module per domain in `src/api/`, with matching types in `src/types/`.
- Auth state is a persisted Zustand store (`store/authStore.ts`, localStorage key `renthub-auth`). Server state uses TanStack Query; forms use react-hook-form + yup.
