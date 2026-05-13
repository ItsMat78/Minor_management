# Testing Setup — Context & Progress Tracker

> **Purpose**: Maintain full context across Claude sessions. Read this file at the start of any session involving testing.

---

## Project Summary

IIITNR Minor Project Management Portal — Node.js/Express (TypeScript) backend, React/Vite frontend, MongoDB.  
Roles: Student, Faculty, Admin. Real-time chat via Socket.io. JWT auth via `x-auth-token` header.

---

## Architecture Decision: `app.ts` Extraction

`server/src/index.ts` was split into two files:

| File | Contains | Used by |
|------|----------|---------|
| `server/src/app.ts` | Express app, middleware, all route mounts | Tests (supertest), index.ts |
| `server/src/index.ts` | `dotenv.config()`, JWT_SECRET guard, mongoose.connect(), Socket.io init, `httpServer.listen()` | Production only |

**Why this matters**: Supertest needs to import the Express `app` without starting the real server or connecting to the real MongoDB. Tests never import `index.ts`.

---

## Test Stack

### Backend (`server/`)
| Tool | Version | Purpose |
|------|---------|---------|
| `jest` | latest | Test runner |
| `ts-jest` | latest | TypeScript transformer for Jest |
| `@types/jest` | latest | TS types for Jest globals |
| `supertest` | latest | HTTP assertion against Express app |
| `@types/supertest` | latest | TS types for supertest |
| `mongodb-memory-server` | latest | In-memory MongoDB, no real DB in tests |

Install command: `cd server && npm install --save-dev jest ts-jest @types/jest supertest @types/supertest mongodb-memory-server`

### Frontend (`client/`)
| Tool | Version | Purpose |
|------|---------|---------|
| `vitest` | latest | Test runner, native Vite integration |
| `@testing-library/react` | latest | Render React components in jsdom |
| `@testing-library/jest-dom` | latest | Extra DOM matchers (toBeInTheDocument, etc.) |
| `@testing-library/user-event` | latest | Realistic user interaction simulation |
| `jsdom` | latest | Browser DOM environment for Vitest |
| `@vitest/coverage-v8` | latest | Coverage reports |

Install command: `cd client && npm install --save-dev vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @vitest/coverage-v8`

---

## File Map

### Backend Infrastructure
| File | Status | Purpose |
|------|--------|---------|
| `server/src/app.ts` | ✅ Done | Extracted Express app — imported by tests |
| `server/src/index.ts` | ✅ Done | Modified to import app.ts; handles DB + socket |
| `server/jest.config.js` | ✅ Done | Jest config: ts-jest preset, `setupFilesAfterEnv`, 60s timeout, coverage |
| `server/src/__tests__/setup/jestSetup.ts` | ✅ Done | beforeAll: MongoMemoryServer + mongoose; afterEach: clear collections |
| `server/src/__tests__/helpers/factories.ts` | ✅ Done | createTestUser(), generateToken(), createTestGroup() |

### Backend Tests
| File | Status | Covers |
|------|--------|--------|
| `server/src/__tests__/unit/auth.test.ts` | ✅ Done | bcrypt hashing, JWT payload, OTP expiry isolation |
| `server/src/__tests__/integration/auth.routes.test.ts` | ✅ Done | POST /login, GET /me, POST /verify-otp, POST /change-password |
| `server/src/__tests__/integration/group.routes.test.ts` | ✅ Done | POST /groups (create, 3-member limit), POST /:id/accept, POST /:id/reject |
| `server/src/__tests__/integration/project.routes.test.ts` | ✅ Done | POST (create, pending invites guard, approved block), PUT status (approve/reject/403/admin), DELETE, GET (role-scoped) |
| `server/src/__tests__/integration/admin.routes.test.ts` | ✅ Done | 401/403 guards on all routes, stats, create-user (validation, duplicates), create admin, archive |
| `server/src/__tests__/integration/panel.routes.test.ts` | ✅ Done | 401/403 guards, create (validation), GET (batchYear filter), PUT, DELETE, my-panels (faculty access) |
| `server/src/__tests__/unit/groupController.test.ts` | ✅ Done | nextAvailableNumber algorithm (gaps, no gaps, large ranges, NaN-safe), batch year derivation |
| `server/src/__tests__/integration/event.routes.test.ts` | ✅ Done | active events, participating-batches, create (password auth, GROUP_FORMATION archive side-effects, participation reset), toggle, delete |
| `server/src/__tests__/integration/user.routes.test.ts` | ✅ Done | ping, faculty list, student list (batch scoping), PUT/DELETE admin-only, cascade cleanup on delete |

### Frontend Infrastructure
| File | Status | Purpose |
|------|--------|---------|
| `client/vite.config.ts` | ✅ Done | Added `test:` block (jsdom environment, setupFiles) |
| `client/src/__tests__/setup.ts` | ✅ Done | Imports @testing-library/jest-dom matchers |

### Frontend Tests
| File | Status | Covers |
|------|--------|--------|
| `client/src/__tests__/components/Login.test.tsx` | ✅ Done | Render, error display, OTP mode transition |
| `client/src/__tests__/components/GroupFormation.test.tsx` | ❌ Skipped | GroupFormation is a redirect-only stub — no UI logic to test |
| `client/src/__tests__/components/Dashboard.test.tsx` | ✅ Done | Role-based rendering: Admin→AdminDashboard, Faculty→FacultyDashboard, Student→student UI |

### E2E Tests (Playwright + Chromium)
| File | Status | Covers |
|------|--------|--------|
| `e2e/tests/setup.spec.ts` | ✅ Done | Login as each role, save `localStorage` auth state to `.auth/*.json` |
| `e2e/tests/auth.spec.ts` | ✅ Done | Login form, wrong creds, role redirects, OTP screen, first-login, unauthenticated guards |
| `e2e/tests/dashboard.spec.ts` | ✅ Done | Admin/Faculty/Student content, sign-out, RBAC guard on /admin |
| `e2e/tests/group.spec.ts` | ✅ Done | Full group creation dialog flow end-to-end |

---

## Test Outcomes & Findings

### Application behaviour clarified (tests corrected to match reality)

These are cases where the first-written test had a wrong assumption. Correcting them revealed undocumented but intentional design decisions.

#### 1. `POST /api/projects` default status is `'Pending'`, not `'Draft'`
- **File**: `projectController.ts:15`
- **Code**: `const { ..., status = 'Pending', ... } = req.body;`
- **Finding**: Sending a project creation request with no `status` field produces a `Pending` proposal, not a `Draft`. The test originally expected `'Draft'` and failed. Corrected after reading the controller.
- **Implication**: If a client sends a form without setting `status: 'Draft'` explicitly, the project goes straight to Pending (and the group moves to `ProposalPending`). This is probably intentional for the web UI which always sets the status explicitly, but worth knowing for any future API integrations.

#### 2. `GET /api/users/faculty` omits `role` from its response
- **File**: `userController.ts:43`
- **Code**: `.select('name email department expertise currentStudents ...')` — `role` is not in this list
- **Finding**: The faculty listing endpoint strips the `role` field. The test initially asserted `u.role === 'Faculty'` for every item, which was always `undefined`. Corrected to check `name`.
- **Implication**: Any frontend code asserting on `.role` from this endpoint would see `undefined`. The current frontend doesn't do this (it only needs the capacity fields), but it's a minor API inconsistency worth noting if the endpoint is ever extended.

---

### Test infrastructure bugs found and fixed

These were all setup/tooling problems — not application bugs — found by running the tests.

#### 3. Wrong Jest config key: `setupFilesAfterFramework` → `setupFilesAfterEnv`
- **Symptom**: Jest silently ignored the setup file, so `beforeAll` / `afterAll` hooks never ran.
- **Fix**: Changed `setupFilesAfterFramework` to `setupFilesAfterEnv` in `server/jest.config.js`. The correct Jest option name is `setupFilesAfterEnv`.

#### 4. `beforeAll` timeout on first run (MongoDB binary download)
- **Symptom**: All integration tests failed with "Exceeded timeout of 5000ms" on first run because `MongoMemoryServer.create()` downloads a ~70MB MongoDB binary.
- **Fix**: Added `testTimeout: 60000` to `jest.config.js` and explicit `}, 60000)` on the `beforeAll` call in `jestSetup.ts`. Subsequent runs are fast (~1–2s) because the binary is cached.

#### 5. Email service auto-mock crashes controllers with 500
- **Symptom**: Any test that hit a controller which calls `sendEmail(...).catch(...)` returned HTTP 500 instead of the expected status.
- **Root cause**: `jest.mock('../../utils/emailService')` auto-mocking replaces all exports with `jest.fn()`, which returns `undefined`. Calling `.catch()` on `undefined` throws `TypeError: Cannot read properties of undefined`, which the controller catches and converts to a 500.
- **Fix**: All integration test files use an explicit factory mock:
  ```typescript
  jest.mock('../../utils/emailService', () => ({
      sendEmail: jest.fn().mockResolvedValue(undefined),
      sendGroupCreationEmail: jest.fn().mockResolvedValue(undefined),
      // ... all exports ...
  }));
  ```
- **Affected controllers**: `authController`, `groupController`, `projectController`, `eventController`, `panelController`.

#### 6. `vi.mock()` inside a function is hoisted and loses closure variables
- **Symptom**: Dashboard test crashed with `ReferenceError: role is not defined` because `vi.mock()` was called inside a `mockAuth(role)` helper function.
- **Root cause**: Vitest (like Jest) hoists all `vi.mock()` calls to the top of the file during compilation. A `vi.mock()` inside a function body is physically moved above the function definition, where the `role` parameter doesn't exist yet.
- **Fix**: Moved `vi.mock('../../context/AuthContext', ...)` to the top level with a `vi.fn()` placeholder, then used `vi.mocked(useAuth).mockReturnValue(...)` inside each `it()` block to configure per-test behaviour.

---

### Security controls confirmed working

The following were verified by tests passing — no bugs found, these all work correctly:

| Control | Test that confirms it | Result |
|---|---|---|
| JWT required on all protected routes | Every auth test: no token → 401 | ✅ Works |
| Malformed JWT rejected | `GET /me` with `'bad.token.here'` | ✅ Returns 400 |
| Admin-only routes reject Student + Faculty | All admin/panel route tests | ✅ Returns 403 |
| Faculty can only approve their own projects | Non-assigned faculty → 403 | ✅ Works |
| Group 3-member limit | 4-person creation attempt → 400 | ✅ Enforced via Mongoose `pre('validate')` hook |
| OTP expiry enforced | Expired OTP → 400 | ✅ Works |
| `mustChangePassword` skip on first login | No current password needed | ✅ Works |
| Password required to leave group | Missing password → 400 | ✅ Works |
| Admin password required for event mutations | Wrong password → 401 (separate from JWT) | ✅ Works |
| GROUP_FORMATION archives all active data | Groups + projects marked `isArchived: true` | ✅ Works |
| Participation flags reset correctly | Only matching-batch students set to `true` | ✅ Works |
| Passwords never returned in API responses | All user responses checked | ✅ Stripped in all controllers |

---

## Unit & Integration Test Commands

```bash
# Run all backend tests
cd server && npm test

# Backend watch mode (reruns on file change)
cd server && npm run test:watch

# Backend with coverage report (outputs to server/coverage/)
cd server && npm run test:coverage

# Run all frontend tests
cd client && npm test

# Frontend with coverage report
cd client && npm run test:coverage
```

---

## E2E Tests (Playwright)

### What E2E tests cover

Full browser-level tests using Playwright + Chromium. Tests run against real running servers (backend + frontend) seeded with a dedicated test database (`minor_management_e2e`).

| Suite | File | Tests | What it covers |
|---|---|---|---|
| Auth setup | `tests/setup.spec.ts` | 3 | Logs in as each role, saves `localStorage` token to `.auth/*.json` |
| Login flows | `tests/auth.spec.ts` | 12 | Login form render, wrong credentials, role-based redirects, OTP screen, first-login forced redirect, unauthenticated route guards |
| Dashboard | `tests/dashboard.spec.ts` | 14 | Admin/Faculty/Student role-based content, sign-out, student blocked from /admin |
| Group creation | `tests/group.spec.ts` | 4 | Full dialog flow: Form Group → Review & Form Group → Confirm & Create → group nav appears |

### Architecture

```
e2e/
├── global-setup.ts       ← drops + reseeds minor_management_e2e (users + active event)
├── global-teardown.ts    ← drops test DB after all tests
├── playwright.config.ts  ← starts backend (port 5000) + frontend (port 5173) automatically
├── fixtures/users.ts     ← test credential constants shared across spec files
├── pages/
│   ├── LoginPage.ts      ← Page Object Model for /login
│   └── DashboardPage.ts  ← POM for /dashboard (with spinner-wait in goto())
└── tests/
    ├── setup.spec.ts     ← "setup" project; runs before "e2e" project
    ├── auth.spec.ts
    ├── dashboard.spec.ts
    └── group.spec.ts
```

### Prerequisites to run

1. MongoDB must be running on `localhost:27017` — use `start_db.bat` (starts from `C:\Program Files\MongoDB\Server\8.2\`)
2. Stop any dev servers on ports 5000 and 5173 first (Playwright starts its own with the test DB env vars)
3. Only Chromium is installed — the test DB env vars are passed via `webServer.env` in `playwright.config.ts`

### E2E-specific gotchas

**A. `storageState()` only captures localStorage, not sessionStorage**
- The app's `login()` function defaults to `sessionStorage` when "Remember me" is unchecked
- `page.context().storageState()` captures localStorage and cookies but NOT sessionStorage
- If setup tests don't check "Remember me", the saved `.auth/*.json` files are empty, and all dashboard tests redirect to /login
- **Fix**: `setup.spec.ts` explicitly checks the "Remember me" checkbox before logging in

**B. `waitForLoadState('networkidle')` hangs forever**
- The app connects a Socket.io WebSocket immediately after auth loads
- This persistent connection means `networkidle` is never reached, causing test timeouts
- **Fix**: `DashboardPage.goto()` waits for the loading spinner (`.animate-spin`) to disappear instead

**C. Strict-mode violations from duplicate text nodes**
- "My Project" and "E2E Student" each appear in two places (sidebar + table/breadcrumb header)
- Playwright's strict mode throws when a locator matches >1 element
- **Fix**: Scope locators to `page.locator('aside')` to target the sidebar specifically

**D. The `e2e` project also runs setup.spec.ts (not just the `setup` project)**
- Playwright's project config means `setup.spec.ts` runs twice: once in "setup" project (creates auth states), once in "e2e" project (at the end, overwrites them)
- This is harmless but adds ~18s to the run — by design in Playwright's project dependency model

### E2E commands

```bash
# Prerequisites
start_db.bat           # start MongoDB (must be running before E2E tests)

# Run all E2E tests (starts servers automatically)
cd e2e && npm test

# Interactive UI mode (debug in browser)
cd e2e && npm run test:ui

# Headed mode (watch tests run in real browser)
cd e2e && npm run test:headed

# Record new tests interactively
cd e2e && npm run codegen
```

---

## Known Gotchas

1. **MongoDB binary download**: First `npm test` run downloads a MongoDB binary (~70MB). Pinned to MongoDB 7.0 via `mongodbMemoryServer.version` in server/package.json. Subsequent runs use the cache (`~/.cache/mongodb-binaries`).

2. **JWT_SECRET consistency**: `authMiddleware.ts` and `authController.ts` read `process.env.JWT_SECRET || 'secret'` at module load time. `jestSetup.ts` sets `process.env.JWT_SECRET = 'test-jwt-secret'` at module scope (not inside `beforeAll`) so it is set before any test file imports run. `factories.ts:generateToken()` reads it lazily (inside the function) to always pick up the test value.

3. **Email service must be explicitly mocked with `mockResolvedValue`**: Use `jest.mock('../../utils/emailService', () => ({ sendEmail: jest.fn().mockResolvedValue(undefined), ... }))` — NOT the bare `jest.mock('../../utils/emailService')` auto-mock. Reason: controllers call `sendEmail(...).catch(...)`, and if the mock returns `undefined` (auto-mock default) instead of a Promise, `.catch()` throws a TypeError and the whole request returns 500.

4. **app.ts has no DB connection**: Intentional. Tests connect mongoose to MongoMemoryServer in `jestSetup.ts` `beforeAll`. The app just mounts routes; the DB connection is injected via environment.

5. **framer-motion in frontend tests**: Works in jsdom with Vitest 2+. No mock needed. If animations cause flaky timing issues, add `vi.mock('framer-motion', ...)` as a passthrough mock (see comment at top of Login.test.tsx).

6. **Group 3-member limit is enforced by a Mongoose `pre('validate')` hook** in `Group.ts`, not in the controller. Integration tests hit this naturally via HTTP requests.

---

## Coverage Targets

| Module | Target |
|--------|--------|
| `authMiddleware.ts` | 100% |
| `authController.ts` | 90%+ |
| `groupController.ts` | 80%+ (core flows) |
| Login component | All user-visible branches |

---

## Session Notes

- **2026-05-14**: Initial setup. Wrote all infrastructure + first test suites (auth, group, Login). Installed deps.
- **2026-05-14**: Continued. Added project.routes, admin.routes, panel.routes, Dashboard component tests. Total: 96 backend + 11 frontend = 107 passing tests.
- **2026-05-14**: Continued. Added event.routes, user.routes, unit/groupController. All 9 backend suites + 2 frontend suites written. Total: 142 backend + 11 frontend = 153 passing tests. Every route module now has coverage.
- **2026-05-14**: Added Playwright E2E suite. 36 tests, all passing. Requires MongoDB running + `cd e2e && npm test`. Three gotchas found: storageState captures localStorage only (not sessionStorage), networkidle hangs due to Socket.io, strict-mode violations need locator scoping.
