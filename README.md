<!-- OGO Manager Pro — GitHub README -->
<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=E16428&height=180&section=header&text=Manager%20Pro&fontSize=48&fontColor=F6E9E9&animation=fadeIn&fontAlignY=32&desc=OGO%20Technology&descAlignY=54&descSize=16" alt="Manager Pro header" width="100%" />
</p>

<p align="center">
  <img src="public/logo.gif" alt="OGO animated logo" width="88" />
  &nbsp;&nbsp;
  <img src="public/2OGOlogo.png" alt="OGO Technology" width="88" />
  &nbsp;&nbsp;
  <img src="public/app.png" alt="Manager Pro app icon" width="72" />
</p>

<h1 align="center">OGO · Manager Pro</h1>

<p align="center">
  <b>Next-gen sales &amp; project operations</b> for OGO Technology<br/>
  Projects · People · Payments · Analytics — offline-ready PWA
</p>

<p align="center">
  <a href="#-interactive-tour"><img src="https://img.shields.io/badge/Explore-Interactive_Tour-E16428?style=for-the-badge&labelColor=1a1818" alt="Tour" /></a>
  <a href="#-quick-start"><img src="https://img.shields.io/badge/Setup-Quick_Start-272121?style=for-the-badge&labelColor=1a1818" alt="Setup" /></a>
  <a href="#-live-preview"><img src="https://img.shields.io/badge/UI-Live_Preview-363333?style=for-the-badge&labelColor=1a1818" alt="Preview" /></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=white&style=flat-square" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript&logoColor=white&style=flat-square" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite&logoColor=white&style=flat-square" alt="Vite" />
  <img src="https://img.shields.io/badge/Supabase-Live-3FCF8E?logo=supabase&logoColor=white&style=flat-square" alt="Supabase" />
  <img src="https://img.shields.io/badge/Tailwind-3.4-06B6D4?logo=tailwindcss&logoColor=white&style=flat-square" alt="Tailwind" />
  <img src="https://img.shields.io/badge/PWA-Installable-5A0FC8?style=flat-square" alt="PWA" />
  <img src="https://img.shields.io/badge/License-MIT-E16428?style=flat-square" alt="MIT" />
  <img src="https://img.shields.io/badge/Version-26-272121?style=flat-square&labelColor=E16428" alt="V.26" />
</p>

<p align="center">
  <img src="https://skillicons.dev/icons?i=react,ts,vite,supabase,tailwind,nodejs&theme=dark" alt="Tech stack icons" />
</p>

---

## 🎛 Interactive tour

> Click each section to expand — designed for GitHub reading.

<details open>
<summary><b>① What is Manager Pro?</b></summary>
<br/>

**Manager Pro** is OGO Technology’s operations cockpit: one dark, brand-forward workspace to run client projects from intake → payment → delivery.

| Pillar | What you get |
|:------:|--------------|
| 📊 | Live dashboard KPIs with PIN / biometric reveal |
| 📋 | Full project board + mobile cards |
| 👥 | Employee profiles & payment allocations |
| 📈 | Analytics, exports, calendar deadlines |
| 🔐 | Password · PIN · Fingerprint / Face ID |
| 📴 | Offline cache + sync when back online |

</details>

<details>
<summary><b>② Feature map</b></summary>
<br/>

```mermaid
mindmap
  root((Manager Pro))
    Dashboard
      KPIs
      PIN Reveal
      Biometrics
    Projects
      Status Flow
      Receipts
      WhatsApp Share
    Employees
      Profiles
      Payments
    Analytics
      Charts
      Exports
    Calendar
      Deadlines
    Settings
      Types
      Captions
      Security
```

</details>

<details>
<summary><b>③ Architecture</b></summary>
<br/>

```mermaid
flowchart TB
  subgraph Client["Browser · PWA"]
    UI["React + Tailwind UI"]
    IDB["IndexedDB Offline Store"]
    SW["Service Worker"]
  end

  subgraph Cloud["Supabase"]
    PG[(PostgreSQL)]
    API["Supabase JS Client"]
  end

  UI --> IDB
  UI --> API
  SW --> UI
  API --> PG
  IDB -.->|sync when online| API

  style Client fill:#1a1818,stroke:#E16428,color:#F6E9E9
  style Cloud fill:#272121,stroke:#E16428,color:#F6E9E9
  style UI fill:#272121,stroke:#E16428,color:#F6E9E9
  style IDB fill:#272121,stroke:#60A5FA,color:#F6E9E9
  style SW fill:#272121,stroke:#A78BFA,color:#F6E9E9
  style PG fill:#1a1818,stroke:#3FCF8E,color:#F6E9E9
  style API fill:#1a1818,stroke:#3FCF8E,color:#F6E9E9
```

</details>

<details>
<summary><b>④ Auth paths</b></summary>
<br/>

```mermaid
sequenceDiagram
  actor Admin
  participant Login as Login Page
  participant Sec as Security Prefs
  participant App as Manager Pro

  Admin->>Login: Open app
  alt Password
    Login->>App: Email + password
  else PIN enabled
    Login->>Sec: Load PIN preference
    Login->>App: 4–6 digit PIN
  else Biometrics
    Login->>App: Fingerprint / Face ID
  end
  App-->>Admin: Session (24h)
```

</details>

---

## 🖼 Live preview

<p align="center">
  <img src="public/pclogin.webp" alt="Desktop login" width="78%" />
</p>
<p align="center"><sub>Desktop login · brand photography + password / PIN tabs</sub></p>

<p align="center">
  <img src="public/mobilelogin.webp" alt="Mobile login" width="32%" />
  &nbsp;&nbsp;
  <img src="public/logo_ogo.png" alt="OGO wordmark" width="28%" />
</p>
<p align="center"><sub>Mobile login experience · OGO wordmark</sub></p>

---

## 📊 Charts & insights

Brand-styled visuals included for docs and GitHub — mirrors what Analytics / Dashboard communicate inside the app.

<p align="center">
  <img src="docs/assets/revenue-chart.svg" alt="Revenue pulse chart" width="92%" />
</p>

<p align="center">
  <img src="docs/assets/status-chart.svg" alt="Project status chart" width="92%" />
</p>

<p align="center">
  <img src="docs/assets/workflow-chart.svg" alt="Status workflow" width="92%" />
</p>

<details>
<summary><b>Interactive Mermaid · status mix</b></summary>
<br/>

```mermaid
pie showData
  title Project status mix (sample)
  "Delivered" : 34
  "Running" : 28
  "Pending" : 14
  "Pending Payment" : 12
  "Correction" : 7
  "Rejected" : 5
```

</details>

<details>
<summary><b>Interactive Mermaid · monthly revenue</b></summary>
<br/>

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': { 'primaryColor': '#E16428', 'pie1': '#E16428'}}}%%
xychart-beta
  title "Monthly revenue (sample LKR)"
  x-axis [Jan, Feb, Mar, Apr, May, Jun, Jul]
  y-axis "Revenue" 0 --> 100
  bar [42, 55, 68, 50, 78, 92, 75]
  line [42, 55, 68, 50, 78, 92, 75]
```

</details>

---

## ✨ Capabilities

<table>
<tr>
<td width="33%" align="center">

### 🏠 Dashboard  
KPI cards · reveal lock  
PIN / Face ID unlock  

</td>
<td width="33%" align="center">

### 📋 Projects  
Status workflow · filters  
Receipts & sharing  

</td>
<td width="33%" align="center">

### 👥 Employees  
Profiles · assignments  
Partial payments  

</td>
</tr>
<tr>
<td width="33%" align="center">

### 📈 Analytics  
Charts · periods  
Export reports  

</td>
<td width="33%" align="center">

### 📅 Calendar  
Deadline radar  
Status colors  

</td>
<td width="33%" align="center">

### ⚙️ Settings  
Types · captions  
Security toggles  

</td>
</tr>
</table>

<details>
<summary><b>Payment & receipt flow</b></summary>
<br/>

```mermaid
flowchart LR
  A[Create Project] --> B[Advance]
  B --> C[Work]
  C --> D{Balance?}
  D -->|Partial / Full| E[Payment Modal]
  E --> F[Receipt PDF / Image]
  F --> G[Delivered]

  style A fill:#272121,stroke:#E16428,color:#F6E9E9
  style B fill:#272121,stroke:#E16428,color:#F6E9E9
  style C fill:#272121,stroke:#60A5FA,color:#F6E9E9
  style D fill:#272121,stroke:#FACC15,color:#F6E9E9
  style E fill:#272121,stroke:#A78BFA,color:#F6E9E9
  style F fill:#272121,stroke:#34D399,color:#F6E9E9
  style G fill:#E16428,stroke:#E16428,color:#F6E9E9
```

</details>

---

## 🚀 Quick start

<details open>
<summary><b>Install & run</b></summary>
<br/>

```bash
# 1) Clone
git clone https://github.com/<your-org>/ogo-manager.git
cd ogo-manager

# 2) Install
npm install

# 3) Point Supabase client
#    edit → src/supabaseClient.ts

# 4) Dev server
npm run dev
# → http://localhost:5173
```

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local HMR server |
| `npm run build` | Production bundle |
| `npm run preview` | Preview `dist/` |
| `npm run lint` | ESLint |

</details>

<details>
<summary><b>Security SQL (PIN / biometrics)</b></summary>
<br/>

Run in Supabase SQL Editor once:

```sql
-- supabase-admin-security.sql
alter table public.admin
  add column if not exists pin_hash text,
  add column if not exists pin_enabled boolean default false,
  add column if not exists biometric_enabled boolean default false;
```

Then open **Settings → Security** in the app.

</details>

<details>
<summary><b>Database folder</b></summary>
<br/>

Apply from [`DB/`](DB/) as needed:

| Script | Role |
|--------|------|
| `database_schema.sql` | Core schema |
| `projects_table.sql` | Projects |
| `migration_employee_payments*.sql` | Employee payments |
| `migration_give_discount.sql` | Discounts |
| `analytics_comparison_table.sql` | Analytics |
| `export_reports_table.sql` | Exports |

</details>

---

## 🎨 Brand system

<p align="center">
  <img src="public/2OGOlogo.png" height="56" alt="OGO" />
  &nbsp;&nbsp;&nbsp;
  <img src="public/logo.gif" height="56" alt="OGO motion" />
  &nbsp;&nbsp;&nbsp;
  <img src="public/app.png" height="56" alt="App" />
  &nbsp;&nbsp;&nbsp;
  <img src="public/logo_ogo.png" height="48" alt="Wordmark" />
</p>

| Token | Hex | Preview |
|-------|-----|---------|
| Primary | `#E16428` | ![](https://img.shields.io/badge/-%23E16428-E16428?style=flat-square) |
| Surface | `#272121` | ![](https://img.shields.io/badge/-%23272121-272121?style=flat-square) |
| Deep | `#1a1818` | ![](https://img.shields.io/badge/-%231a1818-1a1818?style=flat-square) |
| Text | `#F6E9E9` | ![](https://img.shields.io/badge/-%23F6E9E9-F6E9E9?style=flat-square) |

**Type:** Playfair Display · Poppins · Inter

---

## ⌨️ Shortcuts

| Keys | Action |
|------|--------|
| <kbd>Alt</kbd> + <kbd>1</kbd>–<kbd>6</kbd> | Switch main tabs |
| <kbd>Alt</kbd> + <kbd>A</kbd> | Add project |
| <kbd>Alt</kbd> + <kbd>L</kbd> | Logout |
| <kbd>Esc</kbd> | Close / cancel |
| <kbd>Enter</kbd> | Confirm logout |

---

## 📁 Structure

```text
ogo-manager/
├── public/                 # Logos · login art · PWA
│   ├── 2OGOlogo.png
│   ├── logo.gif
│   ├── logo_ogo.png
│   ├── app.png
│   ├── pclogin.webp
│   └── mobilelogin.webp
├── docs/assets/            # README charts (SVG)
│   ├── revenue-chart.svg
│   ├── status-chart.svg
│   └── workflow-chart.svg
├── DB/                     # SQL migrations
├── src/
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   ├── utils/
│   └── supabaseClient.ts
└── supabase-admin-security.sql
```

---

## 🌐 Deploy

<details>
<summary><b>Netlify</b></summary>

```text
Build:   npm run build
Publish: dist
```

Config also lives under `public/netlify.toml`.

</details>

<details>
<summary><b>Vercel</b></summary>

```bash
npm i -g vercel
vercel --prod
```

Confirm production uses the correct Supabase project.

</details>

---

## 🤝 Contribute

1. Fork → branch `feature/your-idea`  
2. Match the dark / `#E16428` system  
3. PR with [`.github/pull_request_template.md`](.github/pull_request_template.md)  

See [`CONTRIBUTING.md`](CONTRIBUTING.md) · [`CHANGELOG.md`](CHANGELOG.md)

---

## 📄 License

[MIT](LICENSE) © 2024–2026 **OGO Technology**

---

<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=E16428&height=120&section=footer&text=OGO%20Technology&fontSize=22&fontColor=F6E9E9&animation=twinkling" alt="footer" width="100%" />
</p>

<p align="center">
  <img src="public/logo.gif" width="52" alt="OGO" /><br/><br/>
  <b>Manager Pro · V.26</b><br/>
  <sub>Built for real operations — projects, people, payments.</sub>
</p>

<p align="center">
  <a href="#-interactive-tour"><img src="https://img.shields.io/badge/↑_Back_to_Tour-E16428?style=for-the-badge&labelColor=1a1818" alt="Back to top" /></a>
</p>
