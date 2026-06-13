# Remaining Bugs & Edge Cases — Student Workflow Review

Scope: login/auth, password change, group formation, invites, proposals, the project
lifecycle, submissions/evaluations, and transitions across **multiple semesters**.
Severity: 🔴 breaks the workflow · 🟠 wrong behaviour in a real case · 🟡 polish/hardening.

> **Status (this pass):** Items 1–13 fixed (#10 was already handled — server refuses to boot
> without `JWT_SECRET`). Each fixed item is marked ✅ below. Action required for #13:
> set `TRUST_PROXY=1` in the production environment.

---

## 🔴 1. ✅ FIXED — `getMyGroup` returns archived groups → returning students can't form a new group
**File:** `server/src/controllers/groupController.ts` — `getMyGroup` (~line 144)
```ts
const group = await Group.findOne({ members: userId })
    .sort({ isArchived: 1, createdAt: -1 })   // no isArchived filter!
```
After a semester rollover every group is `isArchived: true`. A student who returns the
next semester has only archived groups, so `getMyGroup` returns the **archived** group.
On the dashboard, `group` becomes truthy → the **Student Directory tab is hidden**
(`{!group && ...}`) and the old project is shown as if current. The student is blocked
from forming a new group even though `createGroup` (which filters `isArchived: {$ne:true}`)
would allow it. This breaks every semester after the first.
**Fix:** add `isArchived: { $ne: true }` to the `getMyGroup` query. Archived data already
has its own path (`/projects/archived` + Archive tab).

## 🔴 2. ✅ FIXED — Faculty capacity counts archived (past-semester) approved projects
**Files:** `server/src/controllers/userController.ts` `getFaculty` (~line 51);
`server/src/controllers/projectController.ts` `updateProjectStatus` capacity check (~line 151)
```ts
Project.find({ faculty: faculty._id, status: 'Approved' })          // getFaculty
Project.find({ faculty, status: 'Approved', _id: { $ne: project._id } }) // approval check
```
Neither excludes archived projects. The load count keys off the first member's roll-year
prefix, so when **the same batch does a second minor project** (e.g. sem 4 then sem 6), the
archived sem-4 approved projects still match the prefix and inflate the faculty's load —
faculty appear full and new approvals are wrongly rejected.
**Fix:** add `isArchived: { $ne: true }` to both queries.

## 🔴 3. ✅ FIXED — "Forgot password" never lets the user set a new password
**Files:** `server/src/controllers/authController.ts` `verifyForgotPasswordOtp` (~line 192);
flow in `client/src/pages/Login.tsx` / `ChangePassword.tsx`
The forgot-password OTP flow verifies the code and logs the user in, but does **not** set
`mustChangePassword`. For a genuine "I forgot my password" user (`mustChangePassword=false`),
they land on the dashboard with their password still unknown. `changePassword` requires the
current password when `mustChangePassword` is false — which they don't have — so they can
**never** set a known password and must use OTP login forever.
**Fix:** in `verifyForgotPasswordOtp`, set `user.mustChangePassword = true` before saving so
the user is routed to "Set a new password" (which skips the current-password requirement).

---

## 🟠 4. ✅ FIXED — New GF event re-activates droppers who were moved to another batch
**File:** `server/src/controllers/eventController.ts` `createEvent` (~line 136)
```ts
$or: [ { targetBatch: { $in: normalizedBatches } },
       { rollNumber: { $regex: prefixRegex } } ]
```
A student whose roll prefix matches a selected batch but whose `targetBatch` points to a
**different, non-selected** batch (a dropper moved forward) is still flipped to
`isParticipating: true` for their original batch. `getAllStudents` already excludes such
moved-out students from a cohort; the participation flip should too.
**Fix:** exclude students whose `targetBatch` is set to a batch not in `normalizedBatches`
(e.g. roll-prefix clause should also require `targetBatch` null/absent/in-selected).

## 🟠 5. ✅ FIXED — Submission upload has no server-side evaluation-window gating
**File:** `server/src/controllers/projectController.ts` `uploadSubmissions` (~line 673)
Checks membership/archived/evalType but never verifies the matching evaluation event
(mid/end-term) is currently active. The UI gates the button, but the endpoint accepts
mid/end-term file uploads at any time, including outside the window or in a later semester.
**Fix:** verify an active event of the corresponding type exists before accepting the upload.

## 🟠 6. ✅ FIXED — `handleSubmitFiles` posts to `projects[0]`, not the approved project
**File:** `client/src/pages/Dashboard.tsx` `handleSubmitFiles` (~line 137)
```ts
await api.put(`/projects/${group?.projects?.[0]?._id}/submissions`, ...)
```
`projects` is sorted by `createdAt` desc, so `[0]` is the newest, not necessarily the
approved one. Works today only because approval deletes competing proposals; fragile if that
ever changes. **Fix:** target the project with `status === 'Approved'` explicitly.

## 🟠 7. ✅ FIXED (branch) — Invite acceptance doesn't re-check branch restriction or capacity
**File:** `server/src/controllers/groupController.ts` `acceptInvite` (~line 157)
Branch restriction (and the ≤3 rule, beyond the schema hook) is only enforced at
`createGroup`. If branch restriction is toggled on after a cross-branch invite was sent,
`acceptInvite` lets it through. Minor but inconsistent with the new branch rule.
**Fix:** re-validate the creator-vs-accepter branch against the active GF event on accept.

---

## 🟡 8. ✅ FIXED — No global 401/expired-token handling on the client
**File:** `client/src/utils/api.ts` — request interceptor only; no response interceptor.
`auth` middleware returns **400** (not 401) for an invalid/expired token. After the 1-day
JWT expiry, a long-open tab gets scattered failures with no redirect to `/login` until a
manual reload (the mount-time `/auth/me` only clears the token on next load).
**Fix:** add a response interceptor that, on 401/invalid-token, clears the token and routes
to `/login`; and change `authMiddleware` to return 401 for token errors.

## 🟡 9. ✅ FIXED (forgot-password) — Account enumeration on forgot-password / login
**Files:** `authController.ts` `forgotPassword` returns 404 "No account found…"; `login`
returns distinct messages. The forgot UI already says "if that email is registered…", but
the backend still leaks existence. **Fix:** return a generic 200 for forgot-password
regardless of existence.

## 🟡 10. ✅ ALREADY HANDLED — `JWT_SECRET` falls back to the literal `'secret'`
> `index.ts` already refuses to boot if `JWT_SECRET` is unset, so the fallback is unreachable. No change needed.
**Files:** `authController.ts` & `authMiddleware.ts` (`process.env.JWT_SECRET || 'secret'`).
If the env var is unset in production, tokens are forgeable. **Fix:** fail fast on boot if
`JWT_SECRET` is missing in production.

## 🟡 11. ✅ FIXED (hint added) — Dead/confusing first-login activation-OTP path
**File:** `authController.ts` `login` `requiresActivation` branch + `verifyOtp`.
All created/imported users have a random password, so they can't pass the password check
that precedes the activation OTP — first login must actually go through "Forgot password".
The activation path is effectively unreachable and the login page gives first-timers no hint
to use it. **Fix:** either document/route first-time users to the OTP path, or add a hint.

## 🟡 12. ✅ FIXED — Leftover debug `console.log`s in `exportStudents`
**File:** `userController.ts` `exportStudents` (~lines 323–330, 370). Noise in prod logs.
**Fix:** remove.

## 🟡 13. ✅ FIXED — Auth rate limiter is shared across all auth routes (30/min/IP)
**File:** `server/src/routes/authRoutes.ts`. On a campus NAT many students share one public
IP; 30 requests/min across login+OTP+forgot for the whole campus is easy to exhaust during a
deadline rush. **Fix applied:** replaced the single 30/min/IP limiter with:
- a generous per-IP backstop (300/min) so a shared NAT isn't collectively throttled;
- a per-**email** brute-force guard on `/login` (10 failed/15min, successful logins skipped);
- a separate per-email guard on OTP verification (`/verify-otp`, `/verify-forgot-password-otp`),
  so a locked login still leaves the forgot-password path usable.
Per-account keying means brute-force protection works regardless of NAT, and only failed
attempts count so legitimate users are never blocked. Also added an opt-in `TRUST_PROXY` env
setting (`app.ts`) so the per-IP backstop sees real client IPs when behind a reverse proxy —
**set `TRUST_PROXY=1` in the production env** (single proxy hop) to activate it.

---

### Notes / verified-OK
- `createProject` / `updateProject` single-active-proposal rule and `leaveGroup` approval
  block are correct (recently fixed).
- `archivedSession` archive filtering verified working.
- Faculty/Admin correctly render their own dashboards from `/dashboard`.



## 10th June bugs
● I've reviewed the backend thoroughly (controllers, models, routes, middleware, socket). Here are the real bugs I found,
  ranked by impact. I focused on logic/security correctness, not style.

  🔴 High — Group chat has no membership authorization
  server/src/socket.ts (joinGroup / sendMessage)

  The socket auth middleware verifies the JWT, but joinGroup then joins any groupId the client sends and immediately replays
  the last 50 messages:

  socket.on('joinGroup', async (groupId: string) => {
      socket.join(groupId);
      const messages = await Message.find({ groupId })... // no check that socket.user is a member
      socket.emit('loadMessages', messages);
  });

  sendMessage is the same — it writes to whatever groupId arrives. Group IDs are returned all over the REST API (/groups,     
  /projects, panel endpoints), so any authenticated student/faculty can read and post into any group's private chat just by   
  supplying that ID. The server needs to verify socket.user.id is in that group's members before joining or sending.

  🟠 Medium — deleteUser leaves orphaned group state

  server/src/controllers/userController.ts:276

  await Group.updateMany({ members: user._id }, { $pull: { members: user._id } });
  await User.findByIdAndDelete(id);

  It only pulls from members. It does not:
  - pull the user from pendingMembers (a deleted user lingers as a phantom pending invite, blocking the group from submitting 
  a proposal),
  - dissolve a group that becomes empty (leaves an orphaned 0-member group),
  - reassign/clear createdBy when the creator is deleted (branch-restriction logic in acceptInvite/inviteMembers later reads  
  creator.branch for a user that no longer exists).

  Compare with leaveGroup, which correctly dissolves empty groups and deletes their projects.

  🟠 Medium — Evaluation writes aren't blocked on archived projects

  submitEvaluation (projectController.ts:613) and saveStudentEvaluations (:829) never check project.isArchived. Every other   
  write path (addUpdate, updateProject, uploadSubmissions, updateProjectStatus) guards against archived projects, but these   
  two let a faculty/panel member mutate evaluations on a past-semester archived project. Add the same if (project.isArchived) 
  return res.status(400)... guard.

  🟡 Low — getActiveEvents query is inconsistent with the others

  eventController.ts:60. Every other "currently active event" query in the codebase uses three $or clauses:

  { extensionDate: { $exists: true, $ne: null, $gte: now } },
  { extensionDate: { $exists: false }, endDate: { $gte: now } },
  { extensionDate: null, endDate: { $gte: now } }

  getActiveEvents (which drives the dashboard banners) has only the first two and omits the extensionDate: null fallback. An  
  event whose extensionDate is explicitly null (rather than absent) with a future endDate would be hidden from the banner     
  while still being treated as active by group/submission logic. It's a latent edge case, but the divergence is the kind of   
  thing that bites later — worth aligning.

  🟡 Low — Account enumeration in verifyForgotPasswordOtp

  authController.ts:201. forgotPassword was hardened to return a generic message, but its companion still distinguishes "user 
  not found" (Invalid request.) from "wrong OTP" (Invalid or expired OTP.), which re-leaks whether an email is registered.    
  Return the same generic 400 in both cases.

  🟡 Low — Faculty capacity counting ignores droppers

  getFaculty (userController.ts:64) and the approval check in updateProjectStatus (projectController.ts:169) both derive a    
  group's batch from members[0].rollNumber.substring(0,2) and ignore targetBatch. A dropper group (where targetBatch differs  
  from the roll prefix) is counted under the wrong batch's limit, and currentStudentsCount += members.length counts
  cross-batch members against a single batch. The whole load system is roll-prefix-based while the rest of the app honors     
  targetBatch — so droppers can make a faculty look full/not-full for the wrong cohort.

  ---
  The remaining_bugs.md items (1–13) all check out as genuinely fixed in the current code. The above are issues not on that   
  list.

  Want me to fix any of these? I'd start with the chat authorization (#1) and the deleteUser cleanup (#2), since those are the
  ones with real-world blast radius.

● Fable 5's safety measures flagged this message for cybersecurity or biology topics. They may flag safe, normal content as   
  well. These measures let us bring you Mythos-level capability in other areas sooner, and we're working to refine them.      
  Switched to Opus 4.8. Send feedback with /feedback or learn more: https://support.claude.com/en/articles/15363606