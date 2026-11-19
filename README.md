# RentHub

A full-stack rental management app for house owners in Bangladesh. It covers buildings, flats and tenants, monthly rent and utility billing, and payments in Taka (৳) by cash, bank, bKash, Nagad or Rocket.

## Features

- **Property structure:** buildings → floors → flats → tenants. Each flat is vacant, occupied or under maintenance.
- **Bill types** with five ways to calculate a charge:
  - fixed amount
  - metered reading
  - slab tariff (BERC electricity rates)
  - per person
  - amount entered by hand

  You can give one flat a different amount, or leave it out of a charge.
- **Monthly billing:** enter meter readings, preview, then generate invoices. A scheduled job also generates them on the 1st of each month.
- **Carry-forward of dues:** an unpaid balance moves to the next invoice as "previous due".
- **Payments:** full or partial, by cash, bKash, Nagad, Rocket, bank or cheque. Invoice status updates automatically: pending, partially paid, paid or overdue.
- **Public invoice links:** tenants can view an invoice without logging in.
- **Expenses and reports:** income vs expense, collection, rent roll, outstanding dues and expense detail. Reports export to PDF and Excel.
- **Auth:** JWT access and refresh tokens, plus OTP and password-reset flows. Each owner only sees their own data.

## Tech stack

| | |
|---|---|
| Frontend | React 18, TypeScript, Vite, Material UI, TanStack Query, Zustand, React Hook Form, Yup |
| Backend | Node.js, Express, TypeScript, Prisma, MySQL, Zod, node-cron |

## Project structure

```
renthub/
├── backend/            Express API (port 5000)
│   ├── prisma/         schema, migrations, seed
│   └── src/
│       ├── modules/    one folder per domain: routes → controller → service
│       ├── middleware/ auth, validation, errors
│       └── shared/     prisma client, billing calculator, helpers
└── frontend/           React app (port 3000, proxies /api to the backend)
    └── src/
        ├── api/        one API module per domain
        ├── features/   pages and their components
        └── store/      auth state
```

## Getting started

### Requirements

- Node.js 18 or later
- MySQL 8 (Laragon, XAMPP or a local install all work)

### Setup

1. Install the packages for both apps:

   ```bash
   npm run install:all
   ```

2. Create `backend/.env` from the example, then set your database URL and JWT secrets:

   ```bash
   cp backend/.env.example backend/.env
   ```

3. Create the database tables, then load the demo data:

   ```bash
   npm run db:migrate
   npm run prisma:seed --prefix backend
   ```

4. Start both apps:

   ```bash
   npm run dev
   ```

5. Open http://localhost:3000 and log in with the demo account: **owner@demo.com** / **Test1234**.

> There is no email or SMS sender yet. OTP codes and password-reset tokens are printed in the backend console.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Run backend and frontend together |
| `npm run build` | Type-check and build both apps |
| `npm run db:migrate` | Apply Prisma migrations |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run prisma:seed --prefix backend` | Load demo data |
| `npm run prisma:reset --prefix backend` | Drop and recreate the database (deletes all data) |
| `npm test --prefix backend` | Run the backend tests |

## Roadmap

The full redesign (research, architecture, data model, phases) is in [docs/SYSTEM_DESIGN.md](docs/SYSTEM_DESIGN.md).

- Many owners on one system, each with their own workspace, plus staff roles (manager, caretaker, accountant).
- Tenancy agreements with rent revisions, a deposit ledger and move-out settlement.
- SMS receipts and payment reminders.
- A tenant portal in Bangla with phone login.
- Vehicle rentals (CNG daily leases, rent-a-car) built on the same billing system.
