<div align="center">

<img src="public/2OGOlogo.png" alt="OGO Technology" width="96" />

# Manager Pro

**Sales & project operations platform for OGO Technology**

Track projects, employees, payments, and analytics — offline-ready, mobile-friendly, and built for daily business use.

<br />

[![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=white&style=flat-square)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript&logoColor=white&style=flat-square)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white&style=flat-square)](https://vitejs.dev)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-3FCF8E?logo=supabase&logoColor=white&style=flat-square)](https://supabase.com)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?logo=tailwindcss&logoColor=white&style=flat-square)](https://tailwindcss.com)
[![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?logo=pwa&logoColor=white&style=flat-square)](https://web.dev/progressive-web-apps/)
[![License](https://img.shields.io/badge/License-MIT-E16428?style=flat-square)](LICENSE)

<br />

[Features](#-features) ·
[Quick Start](#-quick-start) ·
[Security](#-security) ·
[Database](#-database) ·
[Deploy](#-deployment) ·
[Contributing](#-contributing)

</div>

---

## Overview

**Manager Pro** is an internal management web app used to run OGO Technology’s project pipeline end to end:

- Create and track client projects with deadlines and status workflows  
- Manage employees and per-project payment allocations  
- Record advances, balances, discounts, and receipts  
- Review performance on Dashboard, Analytics, and Calendar  
- Work on mobile with PIN / biometric login and offline sync  

Brand accent: `#E16428` · Dark UI · Desktop + mobile

---

## Features

<table>
  <tr>
    <td width="50%" valign="top">

### Dashboard
Real-time KPIs, revenue snapshot, and project status overview. Sensitive totals can be revealed with PIN or biometrics.

### Projects
Full lifecycle: Running → Pending → Pending Payment → Delivered / Correction / Rejected. Month filters, search, sorting, receipts, and WhatsApp-ready sharing.

    </td>
    <td width="50%" valign="top">

### Employees
Profiles, assignments, active status, and employee payment tracking (pending / partial / paid).

### Analytics & Reports
Period views, metrics, and exportable reports for business insight.

    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">

### Calendar
Deadline-focused calendar with status-aware visuals.

### Settings
Project types, receipt captions, account email/password, and security preferences.

    </td>
    <td width="50%" valign="top">

### Payments & Receipts
Advance / balance / discount flows with branded PDF & image receipts.

### Offline & PWA
IndexedDB caching, background sync when online, and installable PWA support.

    </td>
  </tr>
</table>

---

## Tech stack

| Layer | Technology |
|--------|------------|
| UI | React 18, TypeScript, Tailwind CSS, Lucide, Framer Motion |
| Charts | Chart.js, Recharts |
| Build | Vite 5, vite-plugin-pwa |
| Backend | Supabase (PostgreSQL + client SDK) |
| Offline | IndexedDB (`idb`) + sync managers |
| Exports | jsPDF, html2canvas |

---

## Quick start

### Requirements

- **Node.js** 18+  
- **npm** 9+  
- A **Supabase** project (or use an existing one)

### Install

```bash
git clone https://github.com/<your-org>/ogo-manager.git
cd ogo-manager
npm install
```

### Configure Supabase

Credentials are currently set in:

```text
src/supabaseClient.ts
```

Update `SUPABASE_URL` and `SUPABASE_ANON_KEY` for your project.  
Keep secrets out of public forks — prefer environment variables for production.

Optional reference file: [`env.example`](env.example)

### Run locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### Production build

```bash
npm run build
npm run preview
```

| Script | Description |
|--------|-------------|
| `npm run dev` | Development server (HMR) |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview production build |
| `npm run lint` | ESLint |

---

## Security

Manager Pro supports admin security preferences:

| Option | Description |
|--------|-------------|
| **Password login** | Standard account password |
| **Login PIN** | 4–6 digit PIN (hashed; never stored plain) |
| **Biometrics** | Device fingerprint / Face ID where supported |

### Database migration (PIN / biometrics)

Run once in the **Supabase SQL Editor**:

[`supabase-admin-security.sql`](supabase-admin-security.sql)

```sql
alter table public.admin
  add column if not exists pin_hash text,
  add column if not exists pin_enabled boolean default false,
  add column if not exists biometric_enabled boolean default false;
```

Configure toggles in **Settings → Security** after login.

> Session restore opens the app directly when a valid session exists.  
> PIN / biometrics are used on the **Login page** and for revealing sensitive dashboard data — not as a separate unlock popup.

---

## Database

SQL assets live in [`DB/`](DB/). Apply what your environment needs in Supabase:

| File | Purpose |
|------|---------|
| `database_schema.sql` | Core schema |
| `projects_table.sql` | Projects table |
| `migration_employee_payments*.sql` | Employee payments |
| `migration_employee_is_active.sql` | Active employee flag |
| `migration_give_discount.sql` | Discount support |
| `analytics_comparison_table.sql` | Analytics helpers |
| `export_reports_table.sql` | Export reports |
| `../supabase-admin-security.sql` | Admin PIN / biometric flags |

---

## Project structure

```text
ogo-manager/
├── public/                 # Logos, PWA assets, login imagery
├── DB/                     # SQL schema & migrations
├── src/
│   ├── components/         # UI screens & modals
│   ├── contexts/           # Shared React context
│   ├── hooks/              # Data, offline, biometric, network
│   ├── lib/                # Offline store, sync, realtime
│   ├── types/              # Shared TypeScript types
│   ├── utils/              # PIN hash, receipts, security helpers
│   ├── App.tsx             # Auth gate + shell layout
│   ├── main.tsx
│   └── supabaseClient.ts   # Supabase client
├── supabase-admin-security.sql
├── vite.config.ts
└── package.json
```

---

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt` + `1`–`6` | Jump between main sections |
| `Alt` + `A` | Add project (Projects) |
| `Alt` + `L` | Logout confirm |
| `Esc` | Close modal / cancel logout |
| `Enter` | Confirm logout (when dialog open) |

---

## Design system

| Token | Value | Use |
|-------|-------|-----|
| Primary | `#E16428` | Accent, CTAs, active states |
| Surface | `#272121` | Cards / panels |
| Background | `#363333` → `#272121` | App gradient |
| Text | `#F6E9E9` | Primary typography |

**Fonts:** Playfair Display (display) · Poppins (UI) · Inter (body)

---

## Deployment

### Netlify

`public/netlify.toml` is included. Connect the repo and set build:

```text
Build command: npm run build
Publish directory: dist
```

### Vercel

```bash
npm i -g vercel
vercel --prod
```

Ensure production builds point at the correct Supabase project before shipping.

---

## Contributing

1. Fork & create a branch: `feature/your-change`  
2. Keep UI consistent with the existing dark / orange system  
3. Open a PR using [`.github/pull_request_template.md`](.github/pull_request_template.md)  

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for guidelines.  
Notable changes are tracked in [`CHANGELOG.md`](CHANGELOG.md).

---

## License

Released under the [MIT License](LICENSE).

```text
Copyright (c) 2024–2026 OGO Technology
```

---

<div align="center">

**OGO Technology · Manager Pro**

Built for real operations — projects, people, and payments in one place.

<br />

<img src="public/logo.gif" alt="OGO" width="64" />

</div>
