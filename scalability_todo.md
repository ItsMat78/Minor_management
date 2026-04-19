# Scalability Refactor — TODO

Source plan: `C:\Users\shrey\.claude\plans\big-scalability-issue-currently-sharded-melody.md`

Tick items as they are completed.

## 1. Schema changes

- [x] `server/src/models/User.ts` — rename `isActive` → `isParticipating` (interface line 19, schema line 48); default `false`
- [x] `server/src/models/User.ts` — add index `{ role: 1, isParticipating: 1 }`
- [x] `server/src/models/Panel.ts` — add `isArchived: { type: Boolean, default: false }`
- [x] `server/src/models/Panel.ts` — add index `{ batchYear: 1, isArchived: 1 }`
- [x] `server/src/models/Event.ts` — add `participatingBatches?: string[]`

## 2. One-shot migration

- [x] Create `server/src/scripts/migrateIsActive.ts` (copy `isActive` → `isParticipating`, unset `isActive`)
- [ ] Run migration against dev DB, verify counts

## 3. Event controller (`server/src/controllers/eventController.ts`)

- [x] Require non-empty `participatingBatches` for `GROUP_FORMATION_AND_PROJECT_PROPOSAL`
- [x] Archive panels (`Panel.updateMany({ isArchived: { $ne: true } }, { $set: { isArchived: true } })`)
- [x] Reset faculty counters (`currentStudents=0, currentGroups=0` for all faculty)
- [x] Reset all students `isParticipating=false`, then flip true for matched batches (targetBatch OR rollNumber prefix)
- [x] Persist `participatingBatches` on the event doc
- [x] Update notification query at line 125 → `{ role: 'Student', isParticipating: true }`
- [ ] Wrap in mongoose transaction if replica-set supports it (best-effort — skipped, single sequential updates)

## 4. Auth controller (`server/src/controllers/authController.ts`)

- [x] Lines 23, 81, 87, 109: OTP gate switches from `isActive` → `isVerified`

## 5. Snapshot import (`server/src/controllers/importController.ts`)

- [x] Add `requireActiveGroupFormation()` helper
- [x] Gate `previewSnapshotImport` with 409 if no active GF event with batches
- [x] Gate `commitSnapshotImport` with same 409
- [x] Commit user creation: `isVerified: false`, `mustChangePassword: true`, password `changeme`, `isParticipating` per matched-batch rule (faculty always true)
- [x] Export: write `isParticipating`; bump snapshot `__version: '2.0'`; import accepts both keys one release
- [x] Panel snapshot dedupe: upgrade to `(batchYear, isArchived, room, sorted-facultyEmails)`; include `isArchived` + `room` in export
- [x] Legacy excel-import paths updated for `isParticipating`
- [x] **Simplify snapshot (v3.0): projects + evaluations only — drop users/groups/panels entirely**
- [x] Denormalize `archivedGroupName`, `archivedBatch`, `archivedMembers` onto Project; relax `group` required
- [x] GF archival populates denormalized fields so live→archive transition is self-contained
- [x] Admin Archive view + Faculty archive view fall back to denormalized fields when `group` is null
- [x] Admin archive endpoint includes orphan (imported) archived projects via `archivedBatch`

## 6. Panel controller (`server/src/controllers/panelController.ts`)

- [x] All "current panels" list/filter queries add `isArchived: { $ne: true }`
- [x] Admin list supports `includeArchived=true` flag

## 7. Admin controller (`server/src/controllers/adminController.ts`)

- [x] Manual-create: `isParticipating: false` for students, `true` for faculty
- [x] New endpoint `GET /api/admin/archive?year=<batchYear>` returning `{ projects, groups, participants (with evaluations), panels }`

## 8. Scoped archive endpoints

- [x] `GET /api/projects/archived/faculty` — faculty's archived projects (by `archivedMentorName`)
- [x] `GET /api/projects/archived` — student's archived groups with project + evaluations
- [x] Verify role middleware on both routes (both behind `auth`; faculty endpoint naturally filtered by mentor name)

## 9. Other server spots

- [x] `server/src/controllers/userController.ts` — `isParticipating: false` default for imported students
- [x] `server/src/scripts/seedAdmin.ts` — `isParticipating: true`

## 10. Frontend — `client/src/context/AuthContext.tsx`

- [x] Rename `isActive` → `isParticipating` in `User` type
- [x] Grep `client/src` for residual `.isActive` references on user objects (Event.isActive callsites left untouched)

## 11. Frontend — `client/src/pages/AdminDashboard.tsx`

- [x] Add `'archive'` to `activeTab` union
- [x] Add Archive nav tab
- [x] Event-create modal: batch multi-select + warning banner
- [x] `<ArchiveSection />` with year filter + subsections (Projects / Participants+Evaluations / Panels)

## 12. Frontend — other dashboards

- [x] `client/src/pages/FacultyDashboard.tsx` — Past Projects tab (read-only, hits `/projects/archived/faculty`)
- [x] `client/src/pages/Dashboard.tsx` — Archive tab already present; enhanced with mid/end/final marks display

## 13. Verification

- [x] Server `tsc --noEmit` clean
- [x] Client `tsc --noEmit` clean
- [ ] Pre-migration snapshot: counts of `isActive:true` users, active groups/projects/panels, faculty counters
- [ ] Run migration, confirm fields swapped
- [ ] Create GF event with subset of batches → verify archival, counter reset, participation flip
- [ ] Snapshot import before GF event → 409
- [ ] Snapshot import after GF event → preview shows correct participation
- [ ] Commit snapshot → new student login triggers `mustChangePassword` + OTP
- [ ] Archive tab visible and correct as admin, faculty, student
- [ ] `explain()` on email-recipient query confirms index usage

## Deferred (separate tickets)

- [ ] `Message` thread retention policy
- [ ] Group-name numbering audit (likely already correct per `groupController.ts:48-86, 304-311`)
- [ ] Participation audit log (beyond `event.participatingBatches` + `createdBy` + timestamps)
- [ ] Event-list pagination
