# Weekly Progress Workbook — Minor Project Management Portal
**Project:** B.Tech Minor Project Management System, IIIT Naya Raipur
**Team:** Shreyash Rai, Praveen Bajpai (+ team)
**Duration:** 10 Weeks (Mar 9 – May 19, 2026)

---

## Week 1 — Mar 9–15, 2026
**Theme:** Problem Definition & Requirements Gathering

**Work Done:**
- Identified the problem: manual coordination of minor project groups, faculty assignments, and evaluations was error-prone and scattered across spreadsheets.
- Finalized scope: three-role system (Student, Faculty, Admin) covering the full project lifecycle — group formation → proposal submission → evaluations → archive.
- Drafted the Software Requirements Specification (SRS) document covering functional requirements for all three roles.
- Decided on tech stack: Node.js + Express + TypeScript (server), React + Vite + Tailwind CSS (client), MongoDB + Mongoose (database).
- Set up GitHub repository and defined branching strategy.

**Outcome:** SRS finalized; repository created; team aligned on architecture.

---

## Week 2 — Mar 16–22, 2026
**Theme:** Core Architecture & Initial Scaffolding

**Work Done:**
- Initialized Express server with TypeScript configuration (`tsconfig.json`, `nodemon`).
- Set up MongoDB connection with Mongoose; defined initial schemas for User, Group, and Project.
- Created folder structure: `server/src/controllers`, `routes`, `models`, `middleware`, `utils`.
- Added JWT-based authentication skeleton (register/login endpoints, token signing).
- First exploratory commits — experimenting with middleware order and route structure.

**Outcome:** Server boots, connects to MongoDB, and issues JWTs. Basic project skeleton in place.

---

## Week 3 — Mar 23 – Apr 5, 2026
**Theme:** Authentication, Role System & Faculty Seeding

**Work Done:**
- Implemented role-based access control middleware (`requireAuth`, `requireRole`).
- Built faculty seeding script to bulk-import faculty accounts from CSV.
- Added first-login flow: randomized default password, forced password change on first login.
- Implemented authentication context on the client side (React context + protected routes).
- Substantial refactoring across routes and models — "loads of changes" (Apr 11 commit reflects cleanup of this week's work).

**Outcome:** Auth fully functional for all three roles; faculty can be seeded in bulk; first-login UX enforced.

---

## Week 4 — Apr 6–12, 2026
**Theme:** Group Management & Project Workflow

**Work Done:**
- Built Group model and CRUD controllers (`groupController.ts`): create group, add/remove members, assign faculty mentor.
- Built Project model and controllers (`projectController.ts`): project creation, proposal submission, status transitions.
- Implemented student dashboard showing group status, directory, and project workspace.
- Integrated email notification service (Nodemailer) for group formation and proposal events.
- Removed obsolete automation scripts and temporary test files (cleanup commit).

**Outcome:** Students can form groups, submit proposals, and receive email confirmations. Faculty can see mentee groups.

---

## Week 5 — Apr 13–19, 2026
**Theme:** Admin Dashboard Foundation & Import System

**Work Done:**
- Built the Admin Dashboard page with tabbed layout: Overview, Students, Groups, Faculty, Events, Exports, Panels.
- Implemented `importController.ts` for bulk data import (students, faculty).
- Added event management module: admin can create and schedule evaluation events.
- Built user administration module: view/edit/deactivate accounts.
- Implemented authentication context fixes and improved type safety across auth-related code.

**Outcome:** Admin has a functional dashboard to manage the full system. Bulk import reduces manual setup effort.

---

## Week 6 — Apr 20–23, 2026
**Theme:** Panel Management, Drag-and-Drop & Evaluation Exports

**Work Done:**
- Implemented drag-and-drop panel management UI for faculty workload distribution across evaluation panels.
- Built backend controllers for panel CRUD and faculty assignment to panels.
- Added Panel Excel import with preview — admin uploads `.xlsx`, sees a preview before confirming.
- Fixed Excel rich-text email parsing for reliable email extraction from imported sheets.
- Added full evaluation export (Excel) with batch filtering.
- Fixed panel group-count display to be batch-scoped instead of global.
- Fixed snapshot export and added full Excel export for evaluations.

**Outcome:** Panels can be configured visually; data can flow in (Excel import) and out (Excel export) reliably.

---

## Week 7 — Apr 24 – May 7, 2026
**Theme:** Bug Fixes, Dropper Flow & Database Exports

**Work Done:**
- Implemented "dropper" student flow: students who need to redo a minor project get a special batch-override path.
- Fixed dropper batch assignment and faculty name display in dropper context.
- Added full database export feature (all collections exportable as structured Excel/JSON).
- Fixed room number display in panel view.
- Fixed evaluation display (zero marks shown correctly, not blank).
- Multiple smaller bug fixes across the edit/manage flows and faculty panel views.

**Outcome:** Edge cases handled; exports are production-ready; dropper students supported without manual workarounds.

---

## Week 8 — May 8–14, 2026
**Theme:** Testing — Unit, Integration & End-to-End

**Work Done:**
- Added automated test suite: **153 tests across 11 suites** (Jest + Supertest for backend).
- Added Playwright E2E test suite: **36 tests**, all passing — covering login, group creation, proposal submission, admin flows.
- Added Socket.io integration tests and import/export integration tests.
- Documented testing gaps and honest coverage verdict in `todo_testing.md`.
- Fixed Priority 1 + 2 gaps identified during the testing audit.
- Improved first-login flow robustness; fixed auth type mismatches.

**Outcome:** Codebase has solid test coverage. Critical paths are verified end-to-end. Known gaps documented.

---

## Week 9 — May 15–17, 2026
**Theme:** OTP / Forgot Password & Client Setup

**Work Done:**
- Implemented forgot-password OTP flow: user requests reset, receives a time-limited OTP via email, resets password.
- Initialized the client project with React + Vite and configured all required dependencies (Tailwind, Radix UI, React Query, etc.).
- Added Socket.io real-time notifications to the client for live event updates.
- Configured local environment settings (`client/.env.local`).
- README updated to reflect current setup instructions.

**Outcome:** Forgot-password is fully self-service. Client project structure finalized and ready for production build.

---

## Week 10 — May 18–19, 2026
**Theme:** Deployment — Ansible, SSL, CI/CD & Cloud Services

**Work Done:**
- Wrote Ansible playbook for server provisioning: OS setup, Node.js installation, MongoDB configuration, Nginx reverse proxy, SSL via Let's Encrypt.
- Configured GitHub Actions runner for CI/CD: automated build and deploy on push to `main`.
- Set up Nginx with SSL and adjusted permissions for Node.js process.
- Switched email service from Nodemailer (SMTP) to **Resend** for improved deliverability and developer ergonomics.
- Added cloud object storage setup for file uploads (project attachments, profile images).
- Fixed deployment scripts: consolidated build steps, synced built client files to server, corrected API backend port.
- Consolidated admin eval modal and removed unused state for a clean production build.

**Outcome:** System is deployed on a live server with HTTPS, automated deployments, transactional email, and file storage. Project complete.

---

## Summary Table

| Week | Dates | Focus | Key Deliverable |
|------|-------|-------|----------------|
| 1 | Mar 9–15 | Requirements & Planning | SRS Document |
| 2 | Mar 16–22 | Architecture & Scaffolding | Server skeleton, DB connection, JWT auth |
| 3 | Mar 23–Apr 5 | Auth, Roles & Faculty Seeding | RBAC, seeding script, first-login flow |
| 4 | Apr 6–12 | Groups, Projects & Email | Group/project CRUD, Nodemailer integration |
| 5 | Apr 13–19 | Admin Dashboard & Imports | Tabbed admin UI, bulk import controller |
| 6 | Apr 20–23 | Panels, Drag-and-Drop & Exports | Panel UI, Excel import/export |
| 7 | Apr 24–May 7 | Bug Fixes & Dropper Flow | Dropper support, database exports |
| 8 | May 8–14 | Testing | 153 unit + 36 E2E tests |
| 9 | May 15–17 | OTP & Client Setup | Forgot-password flow, React client init |
| 10 | May 18–19 | Deployment & Cloud Services | Live server, CI/CD, Resend, storage |
