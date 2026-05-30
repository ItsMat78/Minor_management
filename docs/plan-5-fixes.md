# Implementation Plan — 5 Fixes

## Current state (what already exists)
- **Item 1 backend is ~90% done.** `Settings.ts` model + `getGlobalSettings()`, admin endpoints `GET/PUT /admin/default-faculty-limits`, GF-event creation writes global defaults & applies to all faculty, and `createUser`/`commitImport` make new faculty inherit defaults. **Missing:** the actual "big button" + modal JSX in the Faculty Directory (only React state/handlers were added, never rendered).
- Group formation UI lives in `client/src/pages/Dashboard.tsx` (not `GroupFormation.tsx`, which is a redirect stub).
- Backend already blocks proposal creation when `pendingMembers.length > 0` (`projectController.createProject:22`), but the frontend doesn't surface invite status, and multiple `Pending` proposals are still allowed.

---

## Item 1 — Finish the "default mentorship limit" button + modal

**Backend:** already complete. No changes needed. (Optional sanity check: `setDefaultFacultyLimits` correctly persists global settings and applies to existing faculty.)

**Frontend — `client/src/pages/AdminDashboard.tsx`:**
1. In the **Faculty Directory** tab view (rendered when `activeTab === 'faculty'`, near line 1602), add a prominent full-width button/card at the top: **"Set Default Mentorship Limit for All Faculty"** that calls the already-defined `openDefaultLimitsModal()`.
2. Add the modal JSX (state already exists: `showDefaultLimitsModal`, `defaultLimitsMaxGroups`, `defaultLimitsMaxStudents`, `defaultLimitsSaving`, `defaultLimitsMsg`, and handler `handleSaveDefaultLimits` at line ~1019). The modal has two number inputs (Max Groups default 7, Max Students default 21), a save button, and shows `defaultLimitsMsg`. Mirror the styling of existing modals in this file.
3. Verify the GF event modal's default-limit inputs (lines ~4300–4335, already added) are wired into the create-event payload (lines ~4528, already added `defaultMaxStudents`/`defaultMaxGroups`).

---

## Item 2 — Block leaving a group after a proposal is accepted

**Backend — `server/src/controllers/groupController.ts`, `leaveGroup` (line 221):**
- After fetching the group, block leaving if the group has an **approved** project. Add check:
  ```ts
  if (group.status === 'Approved') {
      return res.status(403).json({ message: 'Cannot leave the group after a project proposal has been accepted.' });
  }
  ```
- Be defensive (status could lag): also query `Project.findOne({ group: group._id, status: 'Approved' })` and block if found.

**Frontend — `client/src/pages/Dashboard.tsx`:**
- Where the **Leave Group** button is rendered (right-column actions, after line ~1434), hide/disable it when `group.status === 'Approved'` (or any `group.projects` has status `Approved`), with a tooltip/inline note: "Locked — project proposal accepted." The `handleLeaveGroup` (line 281) already surfaces backend errors via `alert`, so server-side block is the safety net.

---

## Item 3 — Only one active proposal at a time per group

**Backend — `server/src/controllers/projectController.ts`, `createProject` (line 12):**
- Currently only blocks an existing **Approved** project (line 28). Change the rule so that when `status !== 'Draft'` (i.e. submitting `Pending`), reject if the group already has **any `Pending` or `Approved`** project:
  ```ts
  const existingActive = await Project.findOne({
      group: group._id,
      status: { $in: ['Pending', 'Approved'] }
  });
  if (existingActive) {
      return res.status(400).json({ message: 'Your group already has an active proposal. Withdraw or wait for it to be rejected before sending another.' });
  }
  ```
- Decide on drafts: keep allowing multiple `Draft` saves, but block **submitting** a second one while one is `Pending`. (Confirm with the existing `updateProject` path at line 511/523 — submitting a draft→Pending and re-submitting a rejected proposal must also respect "no other Pending exists".)

**Frontend — `client/src/pages/Dashboard.tsx`:**
- The "Create New Proposal" button (line 1131) already pops `isProposalWarningOpen` when non-rejected proposals exist. Tighten it: if any proposal is `Pending` (or `Approved`), **disable** the button entirely (not just warn) with text like "One proposal already pending." Drafts may still be edited/submitted.
- `ProjectProposal.tsx` already locks faculty to the prior proposal's faculty — keep that.

---

## Item 4 — Per-semester branch restriction on group formation

**Model — `server/src/models/Event.ts`:**
- Add field `branchRestricted?: boolean` (default `false`) to `IEvent` and the schema. (`participatingBatches` already exists; the admin asked to "set the batch and the restriction" — batches are done, restriction is new.)

**Backend — `server/src/controllers/eventController.ts`, `createEvent` (line 77):**
- Destructure `branchRestricted` from `req.body` and persist it on the new `Event`. Also handle it in `updateEvent` if events are editable.

**Backend — `server/src/controllers/groupController.ts`, `createGroup` (line 9):**
- Look up the active GF event. If `branchRestricted` is true, enforce that every invited member's `branch` matches the creator's `branch`:
  ```ts
  if (member.branch !== user.branch) {
      return res.status(400).json({ message: `This semester groups must be single-branch. ${member.name} (${member.branch}) cannot join a ${user.branch} group.` });
  }
  ```
- Reuse the existing active-event lookup pattern from `userController.getActiveParticipatingBatches()`.

**Frontend — `client/src/pages/AdminDashboard.tsx`:**
- In the GF event modal, directly under the Participating Batches block (after line ~4300), add a toggle/checkbox **"Restrict groups to same branch (CSE/DSAI/ECE cannot mix)"** bound to a new `branchRestricted` state, and include it in the create-event payload (near line 4528).

**Frontend — `client/src/pages/Dashboard.tsx`:**
- When the active GF event is branch-restricted, filter the student directory selection (`toggleStudentSelection`, line 246 / the `students` list) to only show/allow same-branch students, and show a banner explaining the restriction. The backend block is the safety net.

---

## Item 5 — Invite visibility + block proposal until all invites resolved + edge cases

**Backend — already partially enforced** (`createProject:22` blocks while `pendingMembers > 0`). Reuse it; surface it in UI.

**Frontend — `client/src/pages/Dashboard.tsx` (group detail view, members area ~1398–1431):**
1. Render **pending (invited-but-not-responded) members** alongside accepted members, each with a status badge: `Accepted`, `Pending`, and (if you add rejection tracking) `Declined`. `getMyGroup` populates `members`; **also populate `pendingMembers`** — currently `getMyGroup` (groupController line 119) does **not** populate `pendingMembers`, so add `.populate('pendingMembers', 'name email rollNumber photoUrl branch')` and include it in the response.
2. **Block proposal sending** in the UI while any `pendingMembers` remain: disable "Create New Proposal" with a note "All invited members must accept or decline first." (Backend already returns 400.)

**Edge cases to handle:**
- **Invitee already has invites but creates their own group with others** — `createGroup` (line 18) already blocks if the user is in `members` OR `pendingMembers` of any group. Confirm this also prevents a pending-invitee from being added to a second group (line 43 check). Keep these.
- **Declined invites leaving a group stuck** — `rejectInvite` (line 190) just removes the user from `pendingMembers`; the creator can re-invite. Ensure the UI reflects the reduced pending count and re-enables proposal submission once `pendingMembers` is empty.
- **Group's `pre('validate')` limit of 3** (`Group.ts:34`) counts members + pending — make sure re-invites after a decline don't exceed it.

---

## Suggested execution order (lowest risk first)
1. **Item 1 frontend** (button + modal) — backend done, purely additive UI.
2. **Item 2** (leave block) — small, isolated backend + UI guard.
3. **Item 3** (single active proposal) — backend rule + button disable.
4. **Item 5** (invite visibility) — populate `pendingMembers` in `getMyGroup`, render badges, gate proposal.
5. **Item 4** (branch restriction) — new Event field touches model + 3 files; do last.

## Verification
- Backend: `cd server && npx tsc --noEmit` to typecheck after each model/controller change; run existing Jest suite (`project_testing.md` tracks setup).
- Frontend: `cd client && npx tsc --noEmit` (or build) after the AdminDashboard/Dashboard edits.
- Manual: create a GF event with branch restriction on + custom limits → create a new faculty (inherits limits) → form a cross-branch group (blocked) → invite member, try proposal before they accept (blocked) → accept, send proposal → send a 2nd (blocked) → approve → try to leave (blocked).
