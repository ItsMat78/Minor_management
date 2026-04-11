# Minor Management Portal — TODO

## Bugs & Security Fixes

### Critical
- [x] **`isVerified` / `isActive` split** — OTP flow sets `isActive = true` but never `isVerified = true`. Admin "Unactivated Accounts" stat is always wrong for seeded/imported users. Fix: unify flags or make `verifyOtp` set both.
- [x] **Shadowed `panel` variable in `submitEvaluation`** (`projectController.ts`) — `panel` is destructured from `req.body` then re-declared with `const panel = await Panel.findOne(...)`. Authorization check is broken. Rename one.
- [ ] **Wrong default DB in `seedFaculty.ts`** — defaults to `minor-project-portal` (hyphen) while the app uses `minor_management` (underscore). Align the hardcoded fallback.
- [ ] **OTP never actually emailed** (`authController.ts:68`) — OTP is only `console.log`'d (TODO comment). Wire up Nodemailer so `isActive: false` users can actually activate.
- [ ] **JWT secret defaults to `'secret'`** — tokens are forgeable without a real `JWT_SECRET` env var. Add `.env.example` and a startup guard.

### Security
- [x] **`PUT /api/users/:id` has no auth guard** — any logged-in user can update any user's fields, including escalating their own `role` to Admin. Add `adminAuth` or self-only check.
- [x] **Import routes missing admin guard** — `POST /api/users/import-preview` and `import-commit` only require `auth`. Any student can mass-insert users.
- [ ] **`GET /api/projects` unfiltered** — returns every project to every authenticated user. Add role-based filtering.
- [ ] **Socket.IO chat unauthenticated** — no JWT verification on socket connections; sender name is a plain string from the client. Add auth middleware to the socket handshake.

### Minor
- [ ] Remove 53+ `console.log` debug statements from server code (including `'--- PING HIT ---'`, `'--- USER ROUTES FILE LOADED ---'`).
- [ ] Fix `AuthContext.tsx` using raw `axios` with hardcoded `localhost:5000` instead of the shared `api` instance (missing request interceptors).
- [ ] Fix `Event` interface in `AuthContext.tsx` declaring `label` and `description` fields that don't exist in the Mongoose model.
- [ ] Move misplaced `import bcrypt from 'bcryptjs'` from the middle of `groupController.ts` to the top of the file.
- [ ] Remove `// Trigger nodemon restart` leftover comment in `Group.ts`.

---

## Admin Features

- [x] **Setup Events** — human-readable labels, deadlines, extension dates, and confirmation warnings all present.
  - [ ] **Gap:** Mid-term creation blocking is client-only. Add server-side guard in `createEvent` to reject mid-term if group formation event is still active.
- [x] **Panel formation** — faculty with 0 groups correctly go to reserve sidebar; auto-fill and drag-and-drop both work.
- [x] **Group directory** — archived/dissolved groups are hidden from the admin group directory. Evaluation marks columns (Mid, End, Total) appear dynamically when their corresponding event is active; events are loaded in parallel so columns show without visiting Setup Events first.
- [ ] **Group formation → archive** — when a new group-formation event starts, archive all existing projects in each account:
  - Archived groups are read-only (no update feature).
  - Current mentor detached but stored as an archived label.
  - Each account can still access their archived groups/projects.
- [x] **Student data export** — student directory export with roll number, branch, semester, group status works.
- [x] **Evaluation export bug** — `midE1` and `midE2` in the Excel sheet are always identical (same panel score duplicated). Fix `exportEvaluations` in `panelController.ts` to correctly split or label a single panel score.
- [x] **Panel groups showing 0** — `getPanels` was filtering on `status: 'Approved'` which returned zero groups after semester reset (all dissolved). Fixed by accepting all non-archived statuses. Panel card faculty-vs-group count was broken due to ObjectId `===` string comparison; fixed with `String()` wrapping.
- [x] **`rubricParams` customization** — evaluations (rubric mode and direct mode max marks) now read from the event's stored `rubricParams.sections` instead of hardcoded config. Panel score aggregation (`average` vs `sum` of E1/E2) is configurable per event and applied in both faculty and admin views.
- [x] **Evaluation mode persistence** — which marks-entry mode (Direct / Rubric) was used is stored in the evaluation object and restored when reopening for editing.
- [ ] **Panel room numbers** — replace hardcoded `Room no. 304/305/...` in Excel export with admin-configurable room assignments.
- [ ] **Account creation for new people** — admin flow to create/activate accounts for new students or faculty.

---

## Student Features

- [ ] **Student migration / activation** — OTP-based activation of pre-existing (imported) accounts end-to-end (depends on OTP email fix above).
- [ ] **Mark all current students inactive** — one-time DB migration to set `isActive: false` on all existing student accounts.
- [x] **Group formation UI** — member search with branch/status filters, dropper `targetBatch` override checkbox, confirmation step with live group number fetch. Polished modal UI.
  - [ ] **Gap:** No batch-year filter in member picker — students from other batches may appear in search results for non-dropper groups.
- [x] **Archive tab** — student dashboard Archive tab shows 4 hardcoded fake cards. Fetch and display real archived groups and projects.
- [ ] **`/group/create` page** — route exists but is a non-functional stub (solo group only). Build it out or remove the route and redirect to the dashboard modal flow.
- [ ] **Server-side pagination** — students, groups, and projects lists return all records at once. Add pagination.
- [ ] **`filterStatus` server-side** — `getAllStudents` parses `filterStatus` from query but ignores it; filtering is done client-side only.

---

## Faculty Features

- [x] **Marks overflow fix** — both `max` HTML attribute and `Math.min` JS clamping present in rubric-mode and manual-mode inputs.
- [ ] **Incorrect sidebar on MenteeGroupPage** — `MenteeGroupPage.tsx` sidebar always renders faculty nav items with no `user.role` check. Students can navigate to `/faculty/group/:groupId` and see faculty navigation. Add a faculty-only route guard or role-conditional sidebar.
- [x] **Panel/evaluation UI** — right sticky "Panel Information" sidebar appears when a batch is selected, showing panel members alongside the group list.
- [ ] **Mentor feedback per student** — faculty can currently only leave group-level feedback. Add per-student feedback within a group.

---

## Notification System (Email)

- [ ] **Group creation** — email to all group members on group creation.
- [ ] **Project proposals** — email to faculty on proposal submission; email to students on approval/rejection.
- [ ] **Panel creation** — email to faculty when assigned to a panel.
- [ ] **Event creation & deadline reminders** — email on event creation and approaching deadlines.
- [ ] **Progress update notifications** — email to mentor when a student group posts an update.

---

## Final / Misc Features

- [ ] **Admin dashboard** — complete remaining stat tiles and overview (in progress).
- [ ] **Customized rubric components during evaluation creation** — UI for building rubric fields per event (wire up `rubricParams`).
- [ ] **Report / PPT submission during evaluation periods** — students submit files during active evaluation events; faculty/panel can download.
- [ ] **Plagiarism reports** — upload slot for plagiarism report per submission.
- [ ] **Smart import with inconsistency handling** — on XLSX import, detect and surface inconsistencies (duplicate roll numbers, missing fields, mismatched batch) before commit.
- [ ] **Software Requirements Specification (SRS)** — write the SRS document for the project.
