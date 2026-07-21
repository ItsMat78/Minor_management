# Minor Project Management Portal — User Flows
> Covers every role, every action, and every possible error or edge case.
> Intended as source material for the user manual.

---

## Table of Contents
1. [Authentication (All Roles)](#1-authentication-all-roles)
2. [Student Flows](#2-student-flows)
3. [Faculty Flows](#3-faculty-flows)
4. [Admin Flows](#4-admin-flows)
5. [Cross-Role Edge Cases](#5-cross-role-edge-cases)

---

## 1. Authentication (All Roles)

### 1.1 Login
**Entry point:** `/login`

**Happy path:**
1. Enter email + password → Submit.
2. If account is already verified → JWT issued → Redirect:
   - Admin → `/admin`
   - Faculty or Student → `/dashboard`
3. If account is **unverified** (new student or faculty on first login):
   - Server sends a 6-digit OTP to the user's email.
   - OTP modal appears on the same page.
   - Enter OTP → account marked `isVerified: true` → JWT issued → Redirect.
4. If account has `mustChangePassword: true` (newly created by admin):
   - After JWT is issued, redirect to `/change-password` before dashboard.

**Errors:**
| Situation | What the user sees |
|-----------|-------------------|
| Wrong email or password | "Invalid credentials. Please try again." |
| OTP entered incorrectly | "Invalid or expired OTP." |
| OTP expired (>10 min) | "Invalid or expired OTP." — User must request resend. |
| OTP resend within 60 s | Button disabled with countdown "Resend OTP in Xs". |
| Network / server failure | Generic error banner at top of page. |

---

### 1.2 Change Password (First-Login Forced Change)
**Entry point:** `/change-password` (auto-redirect when `mustChangePassword: true`)

**Happy path:**
1. Enter current password (the admin-issued default, e.g. "changeme").
2. Enter new password (min 6 characters).
3. Confirm new password (must match).
4. Submit → `mustChangePassword` cleared → Redirect to dashboard.

**Errors:**
| Situation | What the user sees |
|-----------|-------------------|
| Current password wrong | "Current password is incorrect." |
| New password < 6 chars | Inline: "Password must be at least 6 characters." |
| Confirm password mismatch | Inline: "Passwords do not match." |
| Submit without filling all fields | Inline required-field highlights. |

**Special case — voluntary change (any time):**
- Same page, accessible from profile/settings menu.
- If user wants to cancel a forced change, a "Sign out" button is shown; navigating back is blocked.

---

### 1.3 Logout
- Click "Logout" in top navigation.
- JWT cleared from local storage; redirect to `/login`.
- Pressing Back does NOT re-authenticate (token gone).

---

## 2. Student Flows

### 2.1 Dashboard Entry
After login, student lands on `/dashboard`.

**Tabs visible:**
- **Directory** — visible only if student is NOT in a group.
- **Group** — visible only if student IS in a group.
- **Project** — visible only if student's group has at least one project.
- **Archive** — always visible.

---

### 2.2 Directory Tab

#### 2.2.1 View Student Directory
- Table lists all students in the same batch (cohort-filtered).
- Columns: Name, Roll Number, Branch, Email, Group Status, Verification Status.
- Filters: Branch, Group Status (Ungrouped / Grouped), Verification (Active / Inactive).
- Search bar: filters by name.

**Edge cases:**
- Student with `targetBatch` override (dropper) sees the directory for their **target batch**, not their roll-number batch.
- Inactive/unverified students appear in the list but cannot be selected for group invites.

---

#### 2.2.2 Pending Invites Section
- Shown at the top of Directory if the student has received group invites.
- Each invite card shows: group creator name, current member names, group batch.
- Actions: **Accept** or **Reject**.

**Accept invite:**
1. Student clicks Accept.
2. Student added to group; group status remains Forming until all members accept.
3. Notification email sent to group creator and existing members.
4. Student's Directory tab disappears; Group tab appears.

**Reject invite:**
1. Student clicks Reject.
2. Invite removed; email sent to creator.
3. Student stays in Directory.

**Errors:**
| Situation | What the user sees |
|-----------|-------------------|
| Student already joined another group between seeing invite and clicking Accept | "You are already in a group." Invite disappears. |
| Group already full when accepting | "Group is already full." Invite disappears. |
| Invite no longer valid (creator dissolved group) | Invite silently removed on next page load. |

---

#### 2.2.3 Create Group

**Precondition:** Student has no group AND a Group Formation event is active.

**Steps:**
1. Click **Create Group**.
2. Search/select up to 2 other students from the directory (3 total including self).
3. Click **Review Group**.
   - System fetches estimated group number from API.
   - Confirmation modal shows: "Your group will be Group #N."
4. Click **Confirm Create**.
5. Group created with status `Forming`.
6. Invite emails sent to selected students (if any were selected).
7. Student is redirected to the Group tab.

**Validation & errors:**
| Situation | What the user sees |
|-----------|-------------------|
| Trying to select more than 2 other students | "You can select up to 2 other students only." Selection blocked. |
| Selecting an already-grouped student | That student's row is disabled/greyed out. |
| Selecting a student from a different batch (no override) | Row disabled or error on submit: "Selected student is not in your batch." |
| Selecting an inactive/unverified student | Row disabled. |
| No GF event active | "Create Group" button hidden or disabled with tooltip "Group formation is not currently open." |
| Student already has a group (race condition) | Server returns 400: "You are already in a group." |
| Group number fetch fails | Modal shows "Unable to estimate group number" but still allows creation. |
| Server error on create | Toast: "Failed to create group. Please try again." |

---

### 2.3 Group Tab

#### 2.3.1 View Group
- Shows: Group name/number, members (photo, name, roll, branch, email), status badge.
- Status: `Forming` → `ProposalPending` → `Approved`.
- Pending members (invited but not yet accepted) shown separately with "Awaiting Response" badge.

**Edge case — dropper in group:**
- If a member has `targetBatch` different from their roll-number batch, a red "Original Batch: YYYY" label appears next to their name.

---

#### 2.3.2 Leave Group

1. Click **Leave Group**.
2. Password confirmation modal appears: Enter your account password to confirm.
3. Submit → Student removed from group.
4. If student was the only member, group is dissolved.
5. Student returns to Directory tab.

**Errors:**
| Situation | What the user sees |
|-----------|-------------------|
| Wrong password entered | "Incorrect password." Modal stays open. |
| Student is last member and group has a Pending/Approved project | Server may warn: "Leaving will dissolve the group and its project proposal." (confirm required). |
| Server error | "Failed to leave group. Please try again." |

---

### 2.4 Project Tab

#### 2.4.1 Create a New Project Proposal

**Preconditions:** Student is in a group with status `Forming` or `ProposalPending` AND no member invites are pending.

**Step 1 — Basic Details:**
- Title (required, auto-capitalised).
- Description (required).
- Tags (optional, comma-separated).
- External links (optional).

**Step 2 — Faculty Selection:**
- Dropdown lists all faculty with: Name, Department, Expertise, current load (X/Y students, X/Y groups).
- Faculty at full capacity: shown in dropdown but option is disabled.
- If group already has a project with a specific faculty, the second proposal **auto-locks** to the same faculty (lock icon shown, cannot change).

**Step 3 — Files & Submit:**
- Upload attachments (up to 5 files).
- Two submit options:
  - **Save as Draft** — saved locally, faculty NOT notified, can edit later.
  - **Submit (Pending)** — sent to faculty, group status becomes `ProposalPending`, faculty email sent.

**Validation & errors:**
| Situation | What the user sees |
|-----------|-------------------|
| Title missing | "Title is required." Blocked from advancing to Step 2. |
| Description missing | "Description is required." |
| Submitting (Pending) without selecting a faculty | "Please select a faculty mentor." |
| Pending member invites still outstanding | "All group members must accept their invites before submitting a proposal." |
| Group already has an Approved project | Submit button disabled: "Your group already has an approved project." |
| Faculty capacity exceeded on approval (not blocked here, blocked at faculty approval step) | No error at submission time. Error surfaces when faculty tries to approve. |
| >5 files uploaded | Upload input rejects; "Maximum 5 files allowed." |
| Network error on submit | "Failed to submit proposal. Please try again." |

---

#### 2.4.2 Edit an Existing Proposal (Draft or Pending)

- Navigate to Project tab; click **Edit** on a Draft or Pending card.
  - URL changes to `?edit={projectId}`.
- Same 3-step form pre-filled with existing data.
- Existing attachments shown (can remove individually or add new ones).
- Re-submit as Draft or Pending.

**Errors:**
| Situation | What the user sees |
|-----------|-------------------|
| Trying to edit an Approved project | Edit button not shown; project is read-only. |
| Trying to edit another group's project | 403 from API; redirected to own dashboard. |

---

#### 2.4.3 View Proposal Status

- Each project card shows a status badge: Draft / Pending / Approved / Rejected.
- Clicking a card opens the full details modal with: title, description, tags, links, attachments, submitted faculty, and if Rejected — the faculty's rejection feedback.

**Rejected flow:**
1. Faculty rejected with feedback.
2. Student sees "Rejected" badge and feedback message on the card.
3. Student can submit a new or revised Pending proposal.

---

#### 2.4.4 Post a Project Update (After Approval)

**Precondition:** Group has an Approved project.

1. Click **Post Update** on the project card.
2. Modal: enter Title (optional), Content (required), Links (optional), attach files (optional).
3. Submit → Update added to timeline; faculty notified by email.

**Errors:**
| Situation | What the user sees |
|-----------|-------------------|
| Content missing | "Update content is required." |
| Upload error | "Failed to upload file. Please try again." |

---

#### 2.4.5 Submit Mid-Term / End-Term Files

**Precondition:** Corresponding evaluation event is active.

1. Click **Submit Files** (mid-term or end-term button, shown only when event active).
2. Modal: upload Report (PDF/ZIP), PPT (PPTX/ZIP), Plagiarism Report (optional).
3. At least 1 file required.
4. Submit → Files stored in `project.submissions`.

**Errors:**
| Situation | What the user sees |
|-----------|-------------------|
| No file selected | "Please upload at least one file." |
| Wrong file type | "Only PDF, ZIP, PPTX files allowed." |
| Upload fails | "File upload failed. Please try again." |

---

#### 2.4.6 View Evaluation Results

- Mid-term marks (if evaluated): Guide score, Panel score, Total, Remarks.
- End-term marks (if evaluated): all rubric fields, total, remarks.
- Per-student feedback from faculty shown below.
- General project feedback shown in a banner.

**Edge case:** If the rubric was customised by admin for the event, label names match the custom rubric (not the hardcoded defaults).

---

### 2.5 Archive Tab

**Always visible.** Read-only.

- Shows archived projects from previous semesters where student was a member.
- Each card: title, group name, batch, archived mentor name, evaluation data.
- Two sources:
  1. **Archived groups** — student's `_id` matched in the group's member list.
  2. **Orphan archived projects** — matched by student's email in `archivedMembers` (used for imported snapshots and branch-transfer cases where roll number changed).

**Edge cases:**
| Situation | What the user sees |
|-----------|-------------------|
| Student transferred branch (new roll number, same email) | Projects from old branch shown via email match. |
| No archive exists | "No archived projects found." empty state. |
| Student was in a group that had no approved project | The group appears in archive with no project card. |

---

## 3. Faculty Flows

### 3.1 Dashboard Entry
After login, faculty lands on `/dashboard`.

**Tabs visible:**
- **Proposals** — always visible.
- **Mentees** — always visible.
- **Mid-Term** — visible only when a Mid-Term evaluation event is active.
- **End-Term** — visible only when an End-Term evaluation event is active.
- **Panels** — visible only if faculty is assigned to at least one evaluation panel.
- **Archive** — always visible.

---

### 3.2 Proposals Tab

#### 3.2.1 View Incoming Proposals
- Cards for each `Pending` project addressed to this faculty member.
- Card shows: Title, Group #, Members (names, roll numbers), Tags, Submitted date.
- **New Update badge** (blue): appears if student posted a project update that faculty hasn't read.
- **Dropper label** (red): "Original Batch: YYYY" shown if any member is a dropper student.

---

#### 3.2.2 Approve a Proposal

1. Click proposal card → full details modal opens.
2. Click **Approve**.
3. Optional feedback message modal.
4. Confirm.

**Server checks on approve:**
- Faculty's current load vs. `maxStudents` and `maxGroups` for the relevant batch.
- If batch-specific limit is configured, that takes precedence over global default.

**Outcome (success):**
- Project status → `Approved`.
- Group status → `Approved`.
- Faculty `currentStudents` and `currentGroups` incremented.
- All group members receive email: "Your proposal has been approved."
- Group moves to Mentees tab.

**Errors:**
| Situation | What the user sees |
|-----------|-------------------|
| Faculty already at student capacity | "You have reached your maximum student limit (X). Please contact admin to increase your limit." Approval blocked. |
| Faculty already at group capacity | "You have reached your maximum group limit (X)." Approval blocked. |
| Server error | "Failed to approve proposal. Please try again." |

---

#### 3.2.3 Reject a Proposal

1. Click proposal card → full details modal opens.
2. Click **Reject**.
3. Feedback message (required) modal.
4. Confirm.

**Outcome (success):**
- Project status → `Rejected`.
- Faculty capacity NOT consumed.
- All group members receive email with rejection feedback.
- Proposal disappears from faculty's proposals tab.
- Students can resubmit.

**Errors:**
| Situation | What the user sees |
|-----------|-------------------|
| Feedback left empty | "Please provide feedback for the rejection." |
| Server error | "Failed to reject proposal. Please try again." |

---

### 3.3 Mentees Tab

#### 3.3.1 View Mentee Groups
- Cards for each group with an Approved project mentored by this faculty.
- Shows: Group #, Project title, Members (mini list), Status.

#### 3.3.2 View Group Details
Click card → opens full MenteeGroupPage:
- Left sidebar: all members with photos, names, roll numbers, emails.
- Main area: project info + project update feed (timeline).
- Unread student updates highlighted; faculty can dismiss (mark read).

#### 3.3.3 Post Faculty Update to Group
1. Click **Post Update** (in mentee view).
2. Modal: Title (optional), Content (required), Links, Files.
3. Submit → Update appears in group's timeline marked "Posted by [Faculty Name]".

**Errors:** Same as student post update errors.

#### 3.3.4 Post General Project Feedback
1. In mentee detail view, click **Edit Feedback** or **Add Feedback**.
2. Text area modal.
3. Submit → feedback visible to all group members in their Project tab.

**Errors:**
| Situation | What the user sees |
|-----------|-------------------|
| Empty feedback | "Feedback cannot be empty." |

#### 3.3.5 Post Per-Student Feedback
1. Click **Per-Student Feedback** button.
2. Select a student from the group.
3. Enter feedback text.
4. Submit → visible to that student only in their Project tab.

---

### 3.4 Mid-Term / End-Term Evaluation Tab

**Shown only when the corresponding event is active.**

#### 3.4.1 View Groups to Evaluate
- List or grid view of all groups that faculty mentors (Mentees) or is on the evaluation panel for (Panels).
- Each row/card: Group #, Project title, Members, evaluation status (checkmark = done, red button = not done).

#### 3.4.2 Evaluate a Group

1. Click **Evaluate** (first time) or **Edit Evaluation** (to revise).
2. Evaluation modal opens with two input modes:

**Mode A — Rubric Mode (recommended):**
- Sections match event rubric (or default if no custom rubric).
- Mid-term default: Guide (3 fields × max 5 each), Panel (3 fields × max 5 each) = 30 total.
- End-term default: Guide (5 fields × max 7 each = 35), Panel (4 fields × max 10 each = 35) = 70 total.
- Total auto-calculated in real-time.
- Toggle between Rubric and Direct mode.

**Mode B — Direct Entry Mode:**
- Single "Marks" field (0 to maxMarks).
- Remarks text area.

3. Enter per-student data:
   - Attendance toggle: Present / Absent for each member.
   - Star rating: 0–5 stars per student (optional).
4. Add optional Remarks (shown to students).
5. Click **Save Evaluation**.

**Validation & errors:**
| Situation | What the user sees |
|-----------|-------------------|
| Marks field over max (HTML5 max attr violated via pasting) | Server clamps to max silently; saved value is capped. |
| Saving with no marks entered (all zero) | Allowed — zero is valid (e.g., absent group). |
| Network error on save | "Failed to save evaluation. Please try again." |
| Event ended between opening modal and saving | Server returns 400 "Evaluation event is not active."; user must contact admin. |

**Re-editing evaluation:**
- Faculty can edit evaluation any number of times while event is active.
- Each save overwrites the previous entry for that eval type.
- After event ends, evaluations become read-only (server blocks PUT).

---

### 3.5 Panels Tab

**Shown only if faculty is a member of at least one evaluation panel.**

#### 3.5.1 View Panel Assignment
- Shows: Panel number, other faculty on the panel, Room/Location (if set), batch year.
- List of groups assigned to this panel (not necessarily faculty's own mentees).

#### 3.5.2 Evaluate Panel-Assigned Group
- Same evaluation modal as Mentees tab (Section 3.4.2).
- Scores stored as `panel1` or `panel2` scores (separate from guide scores).

**Edge case — faculty on both panel and mentor of same group:**
- Faculty can enter both Guide score (from Mentees tab) and Panel score (from Panels tab) for the same group.
- These are stored in separate fields; admin aggregation config determines final grade.

**Edge case — group on two panels:**
- If admin accidentally assigned same group to two panels, both panel faculty can enter scores.
- Scores stored as `panel1` and `panel2`; admin config decides how they combine.

#### 3.5.3 Download Evaluation Template (Excel)
- Button: "Download Evaluation Template".
- Downloads a pre-filled XLSX with the group list and rubric columns.
- Faculty can fill offline and re-upload.

#### 3.5.4 Upload Filled Evaluation Template
1. Click **Upload Evaluation Template**.
2. Select filled XLSX.
3. Server parses file, previews scores.
4. Confirm to commit scores.

**Errors:**
| Situation | What the user sees |
|-----------|-------------------|
| Wrong template format | "Unrecognised file format. Please use the downloaded template." |
| Scores exceed max in template | Server clamps; warning shown in preview. |
| Missing student rows in template | Warning: "N students not found in uploaded file. Their scores will remain unchanged." |

#### 3.5.5 Export Final Evaluation Sheet
- Button: "Export Final Sheet".
- Downloads XLSX with all group members, marks, grades for this panel.
- Useful for printing and physical sign-off.

---

### 3.6 Archive Tab

- Lists all archived mentored groups from previous semesters.
- Each card: project title, archived group name, batch, member names, all evaluation data.
- Read-only — no actions available.

**Edge case — faculty account email changed:**
- If faculty email changed after archival, old archived projects still reference the archived mentor name (denormalised string), not the live user object. Faculty sees them correctly.

---

## 4. Admin Flows

### 4.1 Dashboard Overview Tab

- Statistics cards: Total Students, Total Faculty, Total Groups, Total Projects, Groups by Status (Forming, ProposalPending, Approved, Dissolved), Unactivated Accounts.
- **Global Capacity Settings** (collapsible):
  - Set global `maxStudents` and `maxGroups` defaults for all faculty.
  - Save button.
- **Per-Faculty Capacity** (Edit → Configure Mentorship Limits):
  - Override `maxStudents` and `maxGroups` for an individual faculty member.
  - Limits are semester-wide totals across every batch that faculty mentors; there are no
    per-batch overrides.

---

### 4.2 Students Tab

#### 4.2.1 View Student Directory
- Table with filters: Batch, Branch, Group Status, Verification Status, Participation Status.
- Search by name or email.
- Sort by: Name, Roll Number, Batch.

#### 4.2.2 Edit a Student
1. Click **Edit** on a row.
2. Modal fields: Name, Email, Roll Number, Branch, Semester, Target Batch (for dropper override).
3. Save → PUT `/users/:id`.

**Dropper student setup:**
- Set `targetBatch` to the batch the student is repeating with.
- After saving, student sees the directory for their targetBatch and can join groups from that batch.
- In faculty view, a red "Original Batch: YYYY" label identifies them.

**Errors:**
| Situation | What the user sees |
|-----------|-------------------|
| Email already in use by another account | "Email already exists." |
| Roll number already in use | "Roll number already exists." |
| Empty required field | Inline required-field error. |

#### 4.2.3 Delete a Student
1. Click **Delete** → Confirmation modal: "Remove [Name]? This will remove them from any group. Irreversible."
2. Confirm → DELETE `/users/:id`.
3. Server cascades: removes student from any Group's `members` array.

**Errors:**
| Situation | What the user sees |
|-----------|-------------------|
| Student is the only member of an Approved group | Server may warn; group becomes empty / dissolved after delete. |
| Server error | "Failed to delete user." |

#### 4.2.4 Import Students (CSV / XLSX)

**Step 1 — Upload file:**
- Expected columns: Name, Email, Roll Number, Branch, Semester.

**Step 2 — Preview:**
- Green rows: valid, ready to import (new accounts or updates to existing).
- Red rows: invalid, with reason shown per row.

| Invalid row reason | Displayed reason |
|--------------------|-----------------|
| Missing Name | "Name is required." |
| Missing Email AND Roll Number | "Cannot create account without email or roll number." |
| Email already in DB (and not a name-match update) | "Email already exists." |
| Roll number already in DB | "Roll number already exists." |
| Duplicate email within the uploaded file | "Duplicate email in import file." |
| Row with no email, matched by name to existing account | Shown as yellow "Will update [Name]'s existing account." |

**Step 3 — Commit:**
- Only green rows imported.
- New accounts: `mustChangePassword: true`, `isVerified: false` (must OTP on first login).
- Updated accounts: fields overwritten with new values.

**Errors:**
| Situation | What the user sees |
|-----------|-------------------|
| File is not CSV/XLSX | "Unsupported file type." |
| File is empty | "No data found in file." |
| Commit fails mid-way | Partial import; admin sees how many succeeded in a summary. |

---

### 4.3 Faculty Tab

#### 4.3.1 View Faculty Directory
- Table: Name, Email, Department, Expertise, Load (Students/Groups vs. max), Photo, Actions.
- Search by name, email, department.
- Filter by verification status.

#### 4.3.2 Create Faculty Account
1. Click **Create Faculty**.
2. Fields: Name (required), Email (required), Department, Expertise (comma-separated).
3. Submit → Account created, role = Faculty, default password = "changeme", `mustChangePassword: true`, `isVerified: true` (no OTP needed).

**Errors:**
| Situation | What the user sees |
|-----------|-------------------|
| Email already in use | "Email already exists." |
| Missing Name or Email | Inline required-field error. |

#### 4.3.3 Edit Faculty
Same as Edit Student, plus photo upload field.

#### 4.3.4 Delete Faculty
Same cascade as Delete Student.

**Critical edge case:**
- If faculty has Approved groups with projects, deleting the faculty detaches the project's faculty reference. Admin should reassign groups first or be warned.

#### 4.3.5 Configure Faculty Capacity Limits
- **Global default**: set on Overview tab, applied to every faculty.
- **Per-faculty override**: Edit button on faculty row → "Configure Mentorship Limits" modal.
- A faculty member's `maxStudents` / `maxGroups` is their capacity for the WHOLE semester,
  counted across every batch they mentor. Approving a proposal that would push their total
  past either limit is rejected.

---

### 4.4 Groups Tab

#### 4.4.1 View All Groups
- Table: Group #, Batch, Members (count + names), Status, Project title (if any), Created date.
- Filters: Status, Batch, Search.

#### 4.4.2 Edit Group
1. Click row → Edit modal.
2. Editable: Group name, targetBatch override, Status.
3. Setting status to `Dissolved` manually marks the group as inactive.

**Use case — dropper group:**
- If a whole group is repeating, admin sets group's `targetBatch` to override.
- This affects panel assignment and batch-specific capacity lookups.

#### 4.4.3 View Group Details
- Full modal: all members (linked), all projects (with statuses), creation date.

---

### 4.5 Panels Tab

#### 4.5.1 View All Panels
- Table: Panel #, Batch, Faculty members, Room, Active/Archived, Groups count, Actions.

#### 4.5.2 Create Panel (Manual)
1. Click **Create Panel**.
2. Select batch year (required).
3. Select faculty members (multi-select).
4. Enter room/location (optional).
5. Confirm → Panel stored; faculty notified by email.

**Errors:**
| Situation | What the user sees |
|-----------|-------------------|
| No batch year selected | "Batch year is required." |
| No faculty selected | "At least one faculty member is required." |
| Server error | "Failed to create panel." |

#### 4.5.3 Auto-Create Panels
1. Click **Auto-Create Panels**.
2. Select batch year.
3. System calculates:
   - How many approved groups exist in the batch.
   - Faculty available capacity (`maxGroups` remaining).
   - Distributes groups evenly across faculty, creating panels of ~3–5 groups each.
4. Preview shows proposed panel ↔ group assignments.
5. Confirm → Panels created; all assigned faculty notified.

**Edge cases:**
| Situation | What the user sees |
|-----------|-------------------|
| More groups than available faculty capacity | Warning: "X groups could not be assigned. Please increase faculty limits or add more faculty." |
| No approved groups in batch | "No approved groups found for batch YYYY." |
| No faculty with remaining capacity | "All faculty are at maximum capacity for this batch." |

#### 4.5.4 Edit Panel
- Change faculty members, room, batch, or archive the panel.

#### 4.5.5 Delete / Archive Panel
- Sets `isArchived: true`.
- Panel disappears from active panel list.
- Faculty no longer see it in their Panels tab.

#### 4.5.6 Export Panels (XLSX)
- Generates Excel with Panel Summary sheet + individual Panel sheets.
- Download as `Panel_Distribution_Batch_YYYY.xlsx`.

**Errors:**
| Situation | What the user sees |
|-----------|-------------------|
| No panels exist for selected batch | No file downloaded; toast: "No panels found." |

#### 4.5.7 Import Panels from Excel
1. Click **Upload Panel Template**.
2. Select batch year.
3. Upload XLSX (columns: Faculty Email, Batch Year, Room).
4. Preview parsed rows; confirm.

**Errors:**
| Situation | What the user sees |
|-----------|-------------------|
| Faculty email not found in DB | Row shown as invalid: "Faculty [email] not found." |
| Batch year missing | Row invalid: "Batch year required." |
| Wrong file format | "Unrecognised file format." |

---

### 4.6 Events Tab

#### 4.6.1 View Events
- Timeline: Group Formation events, Mid-Term events, End-Term events.
- Status: Active / Inactive / Ended.
- Shows: Start date, End date, Extension date, Participating batches.

---

#### 4.6.2 Create Group Formation Event

**What this does (important — destructive operation):**
- Archives ALL current non-archived groups → `isArchived: true`, status `Dissolved`.
- Archives ALL current non-archived projects → `isArchived: true`, with denormalised mentor name, group name, batch, members.
- Archives ALL non-archived panels → `isArchived: true`.
- Resets all faculty `currentStudents` and `currentGroups` to 0.
- Sets `isParticipating: true` for all students whose batch matches participating batches.
- Sends email to all participating students.

**Steps:**
1. Click **Create Event** → Select type: "Group Formation / Project Proposal".
2. Set End Date.
3. Set Extension Date (optional — extends deadline for late submissions).
4. Select Participating Batches (multi-select: 2024, 2023, etc.).
5. Configure rubric (Builder or JSON mode).
6. Enter admin password (required for all event operations).
7. Confirm.

**Errors:**
| Situation | What the user sees |
|-----------|-------------------|
| Admin password wrong | "Incorrect password." Event NOT created. |
| End date in the past | "End date must be in the future." |
| No participating batches selected | "At least one batch must be selected." |
| Server error during archival | "Event creation failed. Some data may have been partially archived. Please check and retry." |

**Guard:**
- Cannot create a new Group Formation event if a Mid-Term or End-Term event is currently active. Blocked with: "Please close the active evaluation event before starting a new group formation period."

---

#### 4.6.3 Create Mid-Term Evaluation Event

**Steps:**
1. Click **Create Event** → Select "Mid-Term Evaluation".
2. Set End Date, optional Extension Date.
3. Configure rubric (or use defaults).
4. Enter admin password.
5. Confirm → Mid-Term tab appears for all faculty with mentee groups.

**Guard:**
- Cannot create if a Group Formation event is still active: "Group Formation event is still ongoing."

**Errors:** Same password/date validations as GF event.

---

#### 4.6.4 Create End-Term Evaluation Event

- Same as Mid-Term.
- Can co-exist with Mid-Term (both tabs shown simultaneously to faculty).

---

#### 4.6.5 Toggle Event Active / Inactive
1. Click **Activate** or **Deactivate** toggle on event row.
2. Enter admin password.
3. Confirm → `isActive` flag toggled.

**Effect:**
- Deactivated event: faculty can no longer save evaluations; students can no longer create groups (GF).
- Reactivating: re-opens the event (allows late evaluation if re-activated).

**Errors:**
| Situation | What the user sees |
|-----------|-------------------|
| Wrong admin password | "Incorrect password." Toggle not applied. |

---

#### 4.6.6 Edit Event
- Change End Date, Extension Date, Participating Batches, Rubric.
- Requires admin password.
- Does NOT re-trigger archival (archival is a one-time creation side-effect).

**Edge case — changing participating batches mid-event:**
- Students in newly added batches get `isParticipating: true` set.
- Students in removed batches NOT automatically set to false (manual cleanup needed).

---

#### 4.6.7 Delete Event
- Requires admin password.
- Event removed from DB.
- Does NOT un-archive groups/projects (archival is irreversible in the normal workflow).

---

### 4.7 Exports Tab

#### 4.7.1 Export Student Directory
- Select batch (or All).
- Downloads `Students_Batch_YYYY.xlsx`.
- 204 returned (no file) if no students in batch.

#### 4.7.2 Export Faculty Directory
- Downloads `Faculty_Directory.xlsx` with all faculty.

#### 4.7.3 Export Panel Distribution
- Select batch (or All).
- Downloads `Panel_Distribution_Batch_YYYY.xlsx`.
- Includes: Panel Summary sheet (side-by-side faculty + groups) + individual Panel sheets.
- 204 returned if no panels exist.

#### 4.7.4 Export Evaluations
- Select batch and evaluation type (Mid-Term / End-Term / Full).
- Downloads XLSX with all rubric scores per group per student.

#### 4.7.5 Export Official IIITNR Format
- Select batch.
- Downloads formatted XLSX matching the institute's official format:
  - College header, Semester, Batch, Academic Year.
  - All panels as separate sheets with formatted marks table.

#### 4.7.6 Export JSON Snapshot
- Downloads full database snapshot as `.json`.
- Includes: all students, faculty, groups, projects, panels, evaluations.
- Can be re-imported for backup/migration.

#### 4.7.7 Complete Database Export (Zip)
1. Click **Export Entire Database**.
2. System auto-detects active batches (from active GF event → fallback: student roll numbers → fallback: current year).
3. Fetches and packages:
   - `Students/Students_Batch_YYYY.xlsx` per batch.
   - `Faculty/Faculty_Directory.xlsx`.
   - `Official_Format/MINOR_Project_Batch_YYYY-YYYY.xlsx` per batch.
   - `Snapshot/projects_snapshot.json`.
   - `Panel_Distribution/Panel_Distribution_Batch_YYYY.xlsx` per detected batch. **Fallback:** if no per-batch panel files are found (batch mismatch), exports all panels as `Panels_All_Batches.xlsx`.
   - `Evaluations/Evaluations_Full_Batch_YYYY.xlsx` per batch.
4. Downloads as `Complete_MINOR_Project_Database_YYYY-MM-DD.zip`.

**Errors:**
| Situation | What the user sees |
|-----------|-------------------|
| One sub-export fails (e.g., official format for one batch) | That file is silently skipped; rest of zip still generated. Console error logged. |
| No data at all (empty DB) | Zip downloaded but mostly empty folders. |
| Network timeout on large dataset | Browser may stall; retry by downloading individual exports. |

---

### 4.8 Import Tab

#### 4.8.1 Excel Full Import (IIITNR Official Format)
- Upload comprehensive XLSX (institution's official format).
- Select semester.
- Preview shows: tab-by-tab parsed data, valid/invalid rows with reasons.
- Commit imports students, faculty, groups, projects, panel assignments atomically.

**Errors:**
| Situation | What the user sees |
|-----------|-------------------|
| Faculty name in Excel not matched to any account | Row invalid: "Faculty '[Name]' not found. Create the faculty account first." |
| Student already exists with different roll number | Row invalid: "Email already exists with different roll number." |
| Missing required columns | "Required column '[ColName]' not found in sheet." |
| Group references non-existent student | Row invalid: "Student '[Name]' not found." |

#### 4.8.2 JSON Snapshot Import
1. Upload `.json` snapshot file.
2. Preview: project count, group count, orphan projects (no live group reference), warnings.
3. Commit → restores DB state.

**Errors:**
| Situation | What the user sees |
|-----------|-------------------|
| Invalid JSON format | "Invalid snapshot file." |
| Orphan projects (no matching live group) | Warning: "X projects have no matching group. They will be imported as archived orphan records." |
| Duplicate emails in snapshot | Warning per record: "Email already exists; skipping [email]." |

---

### 4.9 Archive Tab

#### 4.9.1 View Archived Data
- Year selector: All, 2025, 2024, 2023, etc.
- Three sub-tabs: **Projects**, **Participants**, **Panels**.

**Projects sub-tab:**
- Expandable rows: click to see all members, evaluation scores, feedback.

**Participants sub-tab:**
- Table: Name, Email, Roll Number, Branch, Batch, which groups they were in.

**Panels sub-tab:**
- Archived panel compositions and group assignments.

**Edge case — archived project with no mentor:**
- If faculty was deleted before archival, `archivedMentorName` may be null.
- Displayed as "Mentor: Unknown."

#### 4.9.2 Export Archived Data
- Export archived projects/participants to XLSX for a selected year.
- Read-only — no editing possible.

---

## 5. Cross-Role Edge Cases

### 5.1 Dropper Student — Full Flow

**Setup (Admin):**
1. Go to Students tab → find student.
2. Edit → set `targetBatch` to the year they're retaking with (e.g., student from 2022 retakes with 2024 batch).
3. Save.

**Student experience:**
- Sees Directory for batch 2024 (not 2022).
- Can create/join groups with 2024 students.
- In group/proposal view, a red "Original Batch: 2022" label appears next to their name.
- Evaluated with 2024 cohort panels.

**Faculty experience:**
- Proposal card shows red "Original Batch: 2022" label under student's name.
- Capacity check uses batch 2024 limits (not 2022).

**Admin experience:**
- Student appears under batch 2024 filter in Students tab.
- Panel auto-creation assigns them to 2024 panels.

**Errors / edge cases:**
| Situation | Effect |
|-----------|--------|
| Admin sets targetBatch to a batch with no active GF event | Student can still join groups but `isParticipating` may be false; may not receive event emails. |
| Two dropper students from different original batches in same group | Both show original batch labels; group's targetBatch determines panel assignment. |
| Dropper's old batch still has active groups | Old archived group appears in Archive tab under original batch. |

---

### 5.2 Faculty at Capacity — Approval Block

1. Faculty A has global `maxGroups = 7` and currently has 7 approved groups.
2. A new group submits a proposal selecting Faculty A.
3. Faculty A sees the proposal in Proposals tab.
4. Faculty A clicks Approve → Server blocks: "You have reached your maximum group limit."
5. Faculty A must:
   - Contact admin to increase their limit, OR
   - Reject the proposal so the group can choose another faculty.
6. Admin increases `maxGroups` for Faculty A (or sets a batch-specific override).
7. Faculty A can now approve.

---

### 5.3 Group with Pending Members Cannot Submit Proposal

1. Student A creates a group, invites Students B and C.
2. Student B accepts. Student C has not responded.
3. Student A (or B) tries to submit a project proposal.
4. Error: "All group members must accept their invites before submitting a proposal."
5. Options:
   - Wait for Student C to accept.
   - Student A can remove the pending invite (if UI supports), then submit with 2 members.

---

### 5.4 Faculty Evaluates Wrong Group (Panel Assignment Error)

1. Admin accidentally assigns Group X to Panel 1 (Faculty A) AND Panel 2 (Faculty B).
2. Both Faculty A and B can evaluate Group X.
3. Scores stored as `panel1` (A's scores) and `panel2` (B's scores).
4. Admin configures aggregation (average or sum) in rubric settings.
5. Final marks computed accordingly.

**Resolution (admin):**
- Remove Group X from one of the panels via Panels tab edit.

---

### 5.5 Student Leaves Group After Proposal Submitted

1. Group has a Pending project proposal.
2. Student A leaves the group.
3. Group now has 1 member (below typical minimum of 2, if configured).
4. Pending proposal still in faculty's queue.
5. Faculty can approve or reject — no automatic rejection.
6. If approved, single-member group proceeds; faculty sees only 1 student in mentee view.

**Edge case — last member leaves:**
- Group is left with 0 members (if Student A was the only one and others were still pending).
- Group remains in DB with 0 active members but may have pending invite slots.
- Admin should manually clean up via Groups tab.

---

### 5.6 Faculty Deleted Mid-Semester

1. Admin deletes Faculty A's account.
2. Group X had Faculty A as mentor and an Approved project.
3. Project's `faculty` field is now a dangling reference.
4. In student dashboard, supervisor shown as blank or "Unknown."
5. In evaluation records, faculty scores may still be stored from before deletion.
6. Next archival event will snapshot `archivedMentorName` as empty/null.

**Recommended admin action before deleting faculty:**
- Re-assign all mentee groups to another faculty (no direct UI — must change project's faculty reference manually via DB or by having groups resubmit).

---

### 5.7 Event Ended Before Faculty Finished Evaluating

1. End-Term event's deadline passes (or admin deactivates event).
2. Faculty A has not evaluated Group X.
3. Faculty A opens End-Term tab → still sees Group X with "Not Evaluated" status.
4. Faculty A clicks Evaluate → saves submission → **Server returns 400: "Evaluation event is not active."**
5. Group X remains unevaluated.

**Resolution (admin):**
- Reactivate event temporarily (toggle back to active) via Events tab → Faculty evaluates → Deactivate event again.
- Or: Admin can manually enter evaluation via Admin's evaluation override (if implemented).

---

### 5.8 Snapshot Import Creates Orphan Projects

1. Admin imports a JSON snapshot from a previous semester.
2. Snapshot contains archived projects for students who:
   - Have since changed their email address, OR
   - Were deleted from the system.
3. These projects have no matching live `group._id` and cannot be matched by email.
4. Preview shows: "X orphan projects found — no matching student or group."
5. Admin can still commit; orphan projects stored with `archivedMembers` array.
6. Students whose email matches will see them in Archive tab.
7. Unmatched projects visible in Admin Archive tab under the relevant year.

---

### 5.9 Batch Detection Failure in Complete Export

1. Admin clicks "Export Entire Database."
2. No active GF event exists; student roll number scan returns no results.
3. System falls back to current calendar year as the only batch.
4. If panels/students/evaluations are from a different year, those files will be empty or missing.

**What to do:**
- Export individual sub-exports manually (Student export → select correct batch; Panel export → select batch).

---

### 5.10 OTP Loop (Student Cannot Activate Account)

1. Student logs in for the first time.
2. OTP email goes to spam / not received.
3. Student clicks "Resend OTP" — 60-second cooldown activates.
4. Student requests again after 60 s.
5. New OTP issued; old OTP invalidated.
6. If student enters old OTP: "Invalid or expired OTP."
7. If email delivery fails repeatedly: Student must contact admin.

**Admin resolution:**
- Admin can manually set `isVerified: true` on the student's account via DB or a future admin UI toggle.

---

### 5.11 Mid-Term and End-Term Events Both Active Simultaneously

- Both tabs appear for faculty.
- Faculty evaluates each independently.
- Scores stored in separate fields (`midTermEvaluation`, `endTermEvaluation`).
- Students see both sets of results in Project tab.
- No conflict; system handles both independently.

---

### 5.12 Custom Rubric vs. Default Rubric

**If admin created event with custom rubric:**
- Faculty sees custom field labels and max values in evaluation modal.
- Total auto-calculated from custom fields.
- All marks clamped to custom max values (server-side).

**If admin created event without rubric (or deleted rubric config):**
- System falls back to hardcoded defaults:
  - Mid-term: 30 marks (Guide 15 + Panel 15).
  - End-term: 70 marks (Guide 35 + Panel 35).

**Edge case — rubric changed after some evaluations already saved:**
- Existing evaluations stored with old rubric field keys.
- New evaluations use new field keys.
- Admin should avoid changing rubric mid-event; exported data may show mixed column names.

---

*End of User Flows document.*
