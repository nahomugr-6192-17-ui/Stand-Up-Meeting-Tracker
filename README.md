# Muqecha Studios — Stand-up Meeting Notes Tracker

> **Private Stand-up Meeting Management and Record-Keeping System**  
> Official Website Reference: [https://muqecha.studio](https://muqecha.studio)

A secure, authenticated web application designed specifically for **Muqecha Studios** to replace public Notion stand-up meeting pages with an internal record-keeping platform.

---

## 1. Key Features

- **Role-Based Access Control (RBAC):**
  - **MUQECHA TEAM:** Read-only access to published stand-up notes, participant records, and scheduling indicators.
  - **MUQECHA ADMIN:** Full meeting lifecycle management (create, manage, draft, edit participant slots, cascading deletion, save & publish).
- **Exact Brand Identity:**
  - Dominant `#000000` dark theme with Muqecha brand palette (`#668284`, `#B9D7D9`, `#2A2829`, `#493736`, `#7B3B3B`).
  - **Zero gradients** and **strictly sharp-edged buttons** (`border-radius: 0px`).
  - Viewport-centered Muqecha Studios logo mark and typography across every screen.
  - Google Fonts: **Ubuntu** (headings & buttons), **Roboto** (body & tables), **Archivo Black** (Muqecha wordmark), and **Inter** (STUDIOS wordmark).
- **Full Meeting Note Record-Keeping:**
  - 9-column standard stand-up table in exact order:
    1. Name
    2. Work Since Last Stand-up
    3. Work Rating (1–10)
    4. Next Stand-up Work
    5. Description
    6. Acceptance Criteria
    7. Questions from Members
    8. Task Assignment
    9. Time/Date Estimate
  - Dedicated centered participant detail modal with blurred & darkened backdrop.
  - Admin participant row editor with ratings selector and date/time pickers.
  - Dynamic `NEXT MEETING: DD/MM/YY` scheduling indicator.
  - Copy meeting URL with link copied toast.
- **Enterprise Security & Reliability:**
  - Multi-command transaction safety for saving meetings and participant records.
  - Unsaved changes confirmation dialogs and browser `beforeunload` interception.
  - Draft meetings remain strictly hidden from Team accounts on backend and frontend.
  - Secure HTTP-only session cookies with server-side rate limiting on authentication.

---

## 2. Technology Stack

- **Frontend:** React 19, Vite, React Router 7, Lucide React, Pure CSS (modular, no UI libraries).
- **Backend:** Node.js, Express.js, REST API, Cookie-Parser, CORS, Bcrypt.
- **Database & ORM:** PostgreSQL, Prisma ORM, and embedded persistent PGlite engine.
- **Authentication:** Username/password authentication with secure session management and role-based authorization.

---

## 3. Getting Started

### Prerequisites

- **Node.js** (v18 or newer recommended, tested on v25)
- **npm** (v9 or newer)

### Installation

Clone the repository and install all root dependencies:

```bash
# Install dependencies
npm install
```

---

## 4. Environment Configuration

Copy the example environment file to `.env`:

```bash
cp .env.example .env
```

Configure your environment variables in `.env`:

```env
# Server Port
PORT=5000

# Client Application URL (for CORS)
CLIENT_URL=http://localhost:5173

# Node Environment
NODE_ENV=development

# Session Cookie Secret Key
COOKIE_SECRET=change-this-to-a-secure-random-secret-key-in-production

# PostgreSQL Connection URL
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/muqecha_standup?schema=public

# Provisioned Accounts
TEAM_USERNAME=Muqecha Team
TEAM_PASSWORD=weqachbeteseb007#

ADMIN_USERNAME=Muqecha Admin
ADMIN_PASSWORD=weqachOGadmin007#
```

---

## 5. PostgreSQL & Prisma Configuration

### Using PostgreSQL

1. Ensure your PostgreSQL server is running.
2. Create a database named `muqecha_standup`:
   ```sql
   CREATE DATABASE muqecha_standup;
   ```
3. Set your connection string in `.env`:
   ```env
   DATABASE_URL="postgresql://username:password@localhost:5432/muqecha_standup?schema=public"
   ```
4. Run Prisma schema generation and push:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

### Out-of-the-Box Local Persistence (Zero-Config)

If a remote or system-level PostgreSQL service is not running on your local machine, the application automatically uses its integrated file-backed persistent PostgreSQL storage located at `./data/pgdata/`. All SQL tables, data integrity, relations, and transactions persist across process restarts without requiring manual daemon configuration.

---

## 6. Initial Account Provisioning

The application automatically seeds the two initial accounts upon startup based on the credentials in your `.env` file:

- **Muqecha Team** (Read-Only)
  - Default Username: `Muqecha Team`
  - Default Password: `weqachbeteseb007#`
- **Muqecha Admin** (Full Management)
  - Default Username: `Muqecha Admin`
  - Default Password: `weqachOGadmin007#`

To manually run the seed script at any time:

```bash
npm run seed
```

---

## 7. Running the Application

### Development Mode

Run the backend server and frontend development server:

**Terminal 1 — Backend API Server:**
```bash
npm run server
# Starts server at http://localhost:5000
```

**Terminal 2 — Frontend Client (Vite):**
```bash
npm run client
# Starts client at http://localhost:5173
```

Navigate your browser to `http://localhost:5173`.

### Production Build & Execution

To build the client and serve everything from a single unified Express server:

```bash
# 1. Build the production client
npm run build

# 2. Start the unified production server
npm start
```

The unified server will serve both the REST API and the optimized single-page frontend from `http://localhost:5000`.

---

## 8. Running Automated System Tests

A full integration test suite is included in `server/test/system.test.js`, testing 16 critical system workflows:

```bash
node server/test/system.test.js
```

**Verified Test Cases:**
1. Health check `/api/health`
2. Unauthenticated access blocking (401)
3. Invalid login rejection (401)
4. Team login & HTTP-only session cookie issuance
5. Admin login & HTTP-only session cookie issuance
6. Session validation via `/api/auth/me`
7. Team RBAC protection against meeting creation (403)
8. Admin meeting creation in DRAFT status
9. Verification that DRAFT meetings are strictly hidden from Team accounts
10. Admin atomic transaction update and publication
11. Team retrieval of published meeting and participant records
12. Team forbidden from updating meetings (403)
13. Team forbidden from deleting meetings (403)
14. Admin meeting deletion
15. Verification of cascade deletion (404)
16. Safe logout and session revocation

---

## 9. Design System Summary

| Color Token | Hex Code | Purpose |
|---|---|---|
| Primary Background | `#000000` | Dominant surface background |
| Secondary Surface | `#2A2829` | Dark charcoal for cards & headers |
| Secondary Accent | `#668284` | Primary buttons, active borders |
| Light Accent | `#B9D7D9` | Secondary text, subtle highlights |
| Brown Accent | `#493736` | Accent details |
| Deep Red Accent | `#7B3B3B` | Important actions & destructive alerts |

*Strict rule: No gradient fills and 0px border radius across all UI elements.*

---

© 2026 Muqecha Studios. All Rights Reserved.

