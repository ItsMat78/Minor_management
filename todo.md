# Minor Management Portal — TODO

## Bugs & Security Fixes

### Critical
- [x] **`isVerified` / `isActive` split** — OTP flow sets `isActive = true` but never `isVerified = true`. Admin "Unactivated Accounts" stat is always wrong for seeded/imported users. Fix: unify flags or make `verifyOtp` set both.
- [x] **Shadowed `panel` variable in `submitEvaluation`** (`projectController.ts`) — `panel` is destructured from `req.body` then re-declared with `const panel = await Panel.findOne(...)`. Authorization check is broken. Rename one.
- [x] **Wrong default DB in `seedFaculty.ts`** — defaults to `minor-project-portal` (hyphen) while the app uses `minor_management` (underscore). Align the hardcoded fallback.
- [x] **OTP never actually emailed** (`authController.ts:68`) — OTP is only `console.log`'d (TODO comment). Wire up Nodemailer so `isActive: false` users can actually activate.
- [x] **JWT secret defaults to `'secret'`** — tokens are forgeable without a real `JWT_SECRET` env var. Add `.env.example` and a startup guard.

### Security
- [x] **`PUT /api/users/:id` has no auth guard** — any logged-in user can update any user's fields, including escalating their own `role` to Admin. Add `adminAuth` or self-only check.
- [x] **Import routes missing admin guard** — `POST /api/users/import-preview` and `import-commit` only require `auth`. Any student can mass-insert users.
- [x] **`GET /api/projects` unfiltered** — returns every project to every authenticated user. Add role-based filtering.
- [x] **Socket.IO chat unauthenticated** — no JWT verification on socket connections; sender name is a plain string from the client. Add auth middleware to the socket handshake.

### Minor
- [x] Remove 53+ `console.log` debug statements from server code (including `'--- PING HIT ---'`, `'--- USER ROUTES FILE LOADED ---'`). Removed from routes, middleware, and controllers. Scripts and startup log kept intentionally.
- [x] Fix `AuthContext.tsx` using raw `axios` with hardcoded `localhost:5000` instead of the shared `api` instance (missing request interceptors).
- [x] Fix `Login.tsx` using raw `axios` with hardcoded `localhost:5000` — replaced with shared `api` instance.
- [x] Fix `Event` interface in `AuthContext.tsx` declaring `label` and `description` fields that don't exist in the Mongoose model.
- [x] Move misplaced `import bcrypt from 'bcryptjs'` from the middle of `groupController.ts` to the top of the file.
- [x] Remove `// Trigger nodemon restart` leftover comment in `Group.ts`.

---

## Admin Features

- [x] **Setup Events** — human-readable labels, deadlines, extension dates, and confirmation warnings all present.
  - [x] **Gap:** Mid-term creation blocking is client-only. Add server-side guard in `createEvent` to reject mid-term if group formation event is still active.
- [x] **Panel formation** — faculty with 0 groups correctly go to reserve sidebar; auto-fill and drag-and-drop both work.
- [x] **Group directory** — archived/dissolved groups are hidden from the admin group directory. Evaluation marks columns (Mid, End, Total) appear dynamically when their corresponding event is active; events are loaded in parallel so columns show without visiting Setup Events first.
- [x] **Group formation → archive** — when a new group-formation event starts, archive all existing projects in each account:
  - Archived groups are read-only (no update feature).
  - Current mentor detached but stored as an archived label.
  - Each account can still access their archived groups/projects.
- [x] **Student data export** — student directory export with roll number, branch, semester, group status works.
- [x] **Evaluation export bug** — `midE1` and `midE2` in the Excel sheet are always identical (same panel score duplicated). Fix `exportEvaluations` in `panelController.ts` to correctly split or label a single panel score.
- [x] **Panel groups showing 0** — `getPanels` was filtering on `status: 'Approved'` which returned zero groups after semester reset (all dissolved). Fixed by accepting all non-archived statuses. Panel card faculty-vs-group count was broken due to ObjectId `===` string comparison; fixed with `String()` wrapping.
- [x] **`rubricParams` customization** — evaluations (rubric mode and direct mode max marks) now read from the event's stored `rubricParams.sections` instead of hardcoded config. Panel score aggregation (`average` vs `sum` of E1/E2) is configurable per event and applied in both faculty and admin views.
- [x] **Evaluation mode persistence** — which marks-entry mode (Direct / Rubric) was used is stored in the evaluation object and restored when reopening for editing.
- [x] **Panel room numbers** — replace hardcoded `Room no. 304/305/...` in Excel export with admin-configurable room assignments.
- [x] **Account creation for new people** — admin flow to create/activate accounts for new students or faculty.
- [x] **Mark all current students inactive** — exposed as `POST /api/admin/mark-students-inactive` (admin only). Also accessible as a quick action on the Admin Dashboard overview tab. Script also available via `src/scripts/markStudentsInactive.ts`.
- [x] **Admin dashboard** — stat tiles complete: Total Students, Ungrouped, Activated/Unactivated Accounts, Groups, Faculty, Projects. Group Status Breakdown card added (Forming / Proposal Pending / Approved / Assigned). Mark Students Inactive quick-action button added.

---

## Student Features

- [x] **Student migration / activation** — OTP-based activation end-to-end complete: server sends real OTP email (via Nodemailer), Login page uses shared `api` instance (no hardcoded localhost), `verifyOtp` sets both `isVerified` and `isActive`. Pending e2e QA with real SMTP credentials.
- [x] **Mark all current students inactive** — see Admin Features above.
- [x] **Group formation UI** — member search with branch/status filters, dropper `targetBatch` override checkbox, confirmation step with live group number fetch. Polished modal UI.
  - [x] **Gap:** No batch-year filter in member picker — `getAllStudents` already scopes results to the requesting student's cohort server-side, so students from other batches don't appear.
- [x] **Archive tab** — student dashboard Archive tab shows 4 hardcoded fake cards. Fetch and display real archived groups and projects.
- [x] **`/group/create` page** — route now redirects immediately to `/dashboard` where the fully-featured group-formation modal lives. The old stub form is removed.
- [x] **Server-side pagination** — `GET /api/users/students`, `GET /api/groups`, and `GET /api/projects` all support optional `?page=N&limit=M` query params returning `{ data, total, page, pages }`. Admin dashboard students table has pagination controls (50 per page). Non-paginated callers receive a plain array for backwards compat.
- [x] **`filterStatus` server-side** — `getAllStudents` applies `filterStatus` (`grouped` / `available`) on the server after computing `isGrouped` per student.

---

## Faculty Features

- [x] **Marks overflow fix** — both `max` HTML attribute and `Math.min` JS clamping present in rubric-mode and manual-mode inputs.
- [x] **Incorrect sidebar on MenteeGroupPage** — `MenteeGroupPage.tsx` sidebar always renders faculty nav items with no `user.role` check. Students can navigate to `/faculty/group/:groupId` and see faculty navigation. Add a faculty-only route guard or role-conditional sidebar.
- [x] **Panel/evaluation UI** — right sticky "Panel Information" sidebar appears when a batch is selected, showing panel members alongside the group list.
- [x] **Mentor feedback per student** — `PUT /api/projects/:id/student-feedback` (body: `studentId`, `comment`) upserts per-student feedback on the project. `MenteeGroupPage.tsx` shows a "Student Feedback" card in the right column listing all members with their individual feedback; faculty can add/edit via modal.

---

## Notification System (Email)

- [x] **Group creation** — email to all group members on group creation (`sendGroupCreationEmail` called in `createGroup`).
- [x] **Project proposals** — email to faculty on proposal submission (`sendProposalSubmissionEmail`); email to students on approval/rejection (`sendProposalStatusEmail`).
- [x] **Panel creation** — email to faculty when assigned to a panel (`sendPanelAssignmentEmail` called in `createPanel`).
- [x] **Event creation & deadline reminders** — email on event creation (`sendEventNotificationEmail` called in `createEvent`).
- [x] **Progress update notifications** — email to mentor when a student group posts an update (added to `addUpdate` in `projectController.ts`).

---

## Final / Misc Features

- [x] **Admin dashboard** — all stat tiles and overview complete. See Admin Features above.
- [x] **Customized rubric components during evaluation creation** — UI for building rubric fields per event (wire up `rubricParams`).
- [x] **Report / PPT submission during evaluation periods** — students submit files during active evaluation events (`PUT /api/projects/:id/submissions`); faculty/panel can download via `/uploads/` path. UI present in Dashboard.tsx with `isSubmitDialogOpen` modal.
- [x] **Plagiarism reports** — upload slot for plagiarism report per submission (`plagiarismReport` field in `submissions`; accepted in `uploadSubmissions` controller for `final_evaluation` type).
- [x] **Smart import with inconsistency handling** — on XLSX import, detect and surface inconsistencies (duplicate roll numbers, missing fields, mismatched batch) before commit.
- [x] **Full Excel import** — students, faculty, groups, and projects imported from IIITNR Excel format in one shot with two-phase preview/commit. Commit reports per-group and per-student error details inline.
- [x] **Full database snapshot export/import** — portable JSON snapshot covering users, groups, projects (with evaluations), and panels. Preview shows create vs. skip counts; commit restores complete DB state on any machine. All three import flows (simple user, Excel full, snapshot) report per-record created counts and errors inline — no alerts.
- [x] **Software Requirements Specification (SRS)** — written as `SRS.md` at project root. Covers functional requirements (Auth, Student, Faculty, Admin, Notification), non-functional requirements (Security, Performance, Usability, Maintainability), system architecture, data models, and environment variable reference.
