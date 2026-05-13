# Minor Project Management Portal — User Manual
**Dr. SPM International Institute of Information Technology, Naya Raipur**

> This manual is for students, faculty, and administrators using the Minor Project Management Portal.
> No technical knowledge is required to follow these instructions.

---

## Table of Contents

1. [What Is This Portal?](#1-what-is-this-portal)
2. [Glossary — Words You Will See](#2-glossary--words-you-will-see)
3. [Getting Started (All Users)](#3-getting-started-all-users)
4. [Student Guide](#4-student-guide)
5. [Faculty Guide](#5-faculty-guide)
6. [Admin Guide](#6-admin-guide)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. What Is This Portal?

The Minor Project Management Portal manages the complete lifecycle of B.Tech. minor projects at IIITNR — from students forming groups and selecting a guide, through mid-term and end-term evaluations, to the final archived record of every project.

**Who uses it:**
- **Students** — form groups, propose projects, submit progress updates, and view their evaluation results.
- **Faculty** — review project proposals from student groups, mentor approved groups, and enter evaluation marks.
- **Admin (office staff)** — manage all users, control which semester phase is active, create evaluation panels, and export data.

**How a semester works (overview):**

> 📊 **[FLOWCHART]** Replace the text diagram below with the Mermaid flowchart from `user_flow/admin_flow.md` (the Events lifecycle section), rendered as an image. It should show the full semester sequence: Group Formation → proposals → Mid-Term → End-Term → Archive, with arrows between each phase.

```
Admin opens Group Formation
       ↓
Students form groups & submit project proposals
       ↓
Faculty approve or reject proposals
       ↓
Admin opens Mid-Term Evaluation
       ↓
Faculty evaluate groups (mid-term)
       ↓
Admin opens End-Term Evaluation
       ↓
Faculty evaluate groups (end-term)
       ↓
Admin exports final data & starts next semester
(all current data archived automatically)
```

---

## 2. Glossary — Words You Will See

| Term | What it means |
|------|--------------|
| **Batch** | The year a student's B.Tech. programme started. Example: a student who joined in 2022 belongs to Batch 2022. |
| **Group** | A team of up to 3 students working on one minor project together. |
| **Proposal** | A project idea submitted by a group to a faculty guide for approval. |
| **Guide / Mentor** | The faculty member who supervises a group's project. |
| **Panel** | A committee of 2–3 faculty members who evaluate student groups during mid-term and end-term. |
| **Dropper** | A student who is repeating a semester and is working with a different batch than their original joining year. |
| **Group Formation Event** | The period when students can form groups and submit proposals. Opened by admin. |
| **Mid-Term / End-Term Event** | The evaluation periods opened by admin. Faculty enter marks during these windows. |
| **Archive** | The permanent record of a previous semester's groups, projects, and evaluations. |
| **Draft** | A project proposal saved but not yet sent to the faculty guide. |
| **OTP** | A one-time 6-digit code sent to your email to verify your account on first login. |

---

## 3. Getting Started (All Users)

### 3.1 Logging In

1. Open the portal in your browser.
2. Enter your **email address** and **password**.
3. Click **Login**.

> 📸 **[SCREENSHOT]** The login page — showing the email field, password field, and Login button.

You will be taken to your dashboard based on your role.

---

### 3.2 First-Time Login (New Accounts)

If your account was just created by the admin, you will go through two extra steps before reaching your dashboard.

> 📊 **[FLOWCHART]** Render the authentication section of `user_flow/student_flow.md` as an image — showing the path: Login → OTP modal → Verify → Change Password → Dashboard, with error branches for wrong OTP and invalid password.

**Step 1 — Verify your email with an OTP:**

When you log in for the first time, a 6-digit code is sent to your email address. A box will appear on the login page asking you to enter it.

> 📸 **[SCREENSHOT]** The OTP verification modal — showing the 6-digit input field, the Verify button, and the Resend OTP button with its countdown timer.

- Check your inbox (and your spam/junk folder).
- Enter the 6-digit code and click **Verify**.
- The code expires after **10 minutes**. If it expires, click **Resend OTP** (you must wait 60 seconds between resend attempts).

**Step 2 — Change your password:**

After verification, you will be asked to set a new password.

> 📸 **[SCREENSHOT]** The Change Password page — showing the current password field, new password field, confirm password field, and Save button.

- Enter the temporary password given to you by the admin (usually `changeme`).
- Enter your new password — it must be **at least 6 characters**.
- Enter your new password again to confirm.
- Click **Save**.

You will then arrive at your dashboard. You will not have to do these steps again.

---

### 3.3 Changing Your Password Later

You can change your password at any time from your profile or settings menu.

1. Go to **Change Password** from the top navigation.
2. Enter your current password.
3. Enter your new password (at least 6 characters).
4. Confirm the new password.
5. Click **Save**.

---

### 3.4 Logging Out

Click **Logout** in the top navigation bar. You will be returned to the login page. For security, pressing the browser Back button after logging out will not bring you back in.

> 📸 **[SCREENSHOT]** The top navigation bar — highlighting the Logout button location.

---

## 4. Student Guide

### 4.1 Your Dashboard

After logging in, you land on your student dashboard. The tabs you see depend on where you are in the semester:

| Tab | When it appears |
|-----|----------------|
| **Directory** | When you are not yet in a group |
| **Group** | When you are in a group |
| **Project** | When your group has at least one project proposal |
| **Archive** | Always — shows your previous semesters |

> 📸 **[SCREENSHOT]** The student dashboard — showing the tab bar with Directory, Group, Project, and Archive tabs. Annotate which tabs appear in which situation (can be two side-by-side screenshots: one before joining a group, one after).

> 📊 **[FLOWCHART]** Render the full `user_flow/student_flow.md` diagram as an image for an overview of the complete student journey.

---

### 4.2 Directory Tab

The Directory shows all students in your batch. You can search by name and filter by branch or group status.

> 📸 **[SCREENSHOT]** The Directory tab — showing the student table with columns (Name, Roll Number, Branch, Group Status), the search bar, and the filter dropdowns along the top.

> **Note for dropper students:** If the admin has set you up to work with a different batch (for example, you are retaking a semester with the 2024 batch), you will see the directory for that batch, not your original joining year.

#### Viewing Pending Invites

If another student has invited you to join their group, a notification appears at the top of the Directory. Each invite shows the creator's name and who else is already in the group.

> 📸 **[SCREENSHOT]** The pending invite card — showing the creator's name, current member list, and the Accept / Reject buttons.

- Click **Accept** to join the group. You will be moved to the Group tab.
- Click **Reject** to decline. The invite is removed.

**What can go wrong:**

| Problem | What you see |
|---------|-------------|
| You accepted, but you had already joined another group | "You are already in a group." The invite disappears. |
| The group was already full by the time you accepted | "Group is already full." The invite disappears. |
| The invite simply disappeared | The group creator cancelled it or dissolved the group. |

---

#### Creating a Group

You can create a group only when the **Group Formation** period is open (the admin controls this).

1. Click **Create Group**.

> 📸 **[SCREENSHOT]** The Directory tab with the Create Group button visible and highlighted.

2. Select up to **2 other students** from the directory to invite. You can also create a group with just yourself.
   - Students who are already in a group, are inactive, or are from a different batch cannot be selected.

> 📸 **[SCREENSHOT]** The student selection step — showing the directory list with some rows greyed out (already grouped / inactive) and checkboxes next to selectable students.

3. Click **Review Group**.
   - A confirmation box will show your estimated group number.

> 📸 **[SCREENSHOT]** The group confirmation modal — showing "Your group will be Group #N" and the Confirm / Cancel buttons.

4. Click **Confirm** to create the group.

Invite emails are sent to the students you selected. The group is created immediately, but invited students need to accept before the group is complete.

**What can go wrong:**

| Problem | What you see |
|---------|-------------|
| You tried to select more than 2 other students | "You can select up to 2 other students only." |
| Group Formation is not currently open | The Create Group button is hidden or shows "Group formation is not currently open." |
| The server had an error | "Failed to create group. Please try again." |

---

### 4.3 Group Tab

The Group tab shows your group's details: the group number, all members (with photos and contact info), and your group's current status.

> 📸 **[SCREENSHOT]** The Group tab — showing the group number, member cards (photo, name, roll number, branch, email), the status badge, and any "Awaiting Response" pending member rows.

**Group status meanings:**

| Status | Meaning |
|--------|---------|
| **Forming** | Group created, but invited members haven't all accepted yet, or no proposal submitted |
| **Proposal Pending** | You have submitted a proposal and are waiting for your guide's decision |
| **Approved** | Your guide has approved your project |

Members who have been invited but haven't responded yet are shown separately with an "Awaiting Response" label.

> **Dropper student note:** If any group member is from a different original batch, a red label showing their original batch year appears next to their name. This is normal.

> 📸 **[SCREENSHOT]** A group member card showing the red "Original Batch: YYYY" dropper label — so users know what this looks like.

---

#### Leaving a Group

1. Click **Leave Group**.
2. A box will ask you to enter your account password to confirm.

> 📸 **[SCREENSHOT]** The Leave Group password confirmation modal — showing the password input field and Confirm / Cancel buttons.

3. Enter your password and click **Confirm**.

You will be removed from the group and returned to the Directory tab. If you were the only member, the group is dissolved.

> **Warning:** This cannot be undone. If your group had a pending or approved project, it may be affected.

---

### 4.4 Project Tab

The Project tab appears once your group has created at least one project proposal.

> 📊 **[FLOWCHART]** A simplified flowchart of the proposal lifecycle: Draft → Submit → Pending → [Approved / Rejected] → (if Rejected) resubmit loop. Can be extracted from `user_flow/student_flow.md` (the Project Tab subgraph).

#### Creating a Project Proposal

> Before submitting, make sure all invited group members have accepted their invites. You cannot submit a proposal while any member has not responded.

**Step 1 — Basic Details**

> 📸 **[SCREENSHOT]** Step 1 of the proposal form — showing the Title, Description, Tags, and Links fields, and the Next button.

Fill in:
- **Title** (required) — the name of your project.
- **Description** (required) — what your project is about.
- **Tags** (optional) — keywords like "Machine Learning, IoT".
- **Links** (optional) — any relevant external links.

Click **Next**.

**Step 2 — Select a Faculty Guide**

> 📸 **[SCREENSHOT]** Step 2 of the proposal form — showing the faculty dropdown open, with faculty names, departments, and their current load displayed (e.g., "14/21 students, 5/7 groups"). Show one faculty entry that is greyed out due to being at full capacity.

- A dropdown shows all faculty with their department, area of expertise, and how many students/groups they are currently supervising.
- Faculty who have reached their maximum capacity are shown but cannot be selected.
- If your group already has a project with a particular guide, any second proposal is automatically linked to the same guide.

Click **Next**.

**Step 3 — Attach Files and Submit**

> 📸 **[SCREENSHOT]** Step 3 of the proposal form — showing the file upload area (with a sample file attached), and the two buttons: Save as Draft and Submit.

- Attach up to **5 files** (optional).
- Choose one of two options:
  - **Save as Draft** — your proposal is saved but NOT sent to the faculty. You can continue editing it later. The faculty will not know about it.
  - **Submit** — your proposal is sent to the faculty. They will receive an email and can approve or reject it.

**What can go wrong:**

| Problem | What you see |
|---------|-------------|
| Title or description is missing | "Title is required." / "Description is required." — you cannot proceed to the next step. |
| You tried to submit without selecting a guide | "Please select a faculty mentor." |
| Invited members haven't all accepted | "All group members must accept their invites before submitting a proposal." |
| Your group already has an approved project | The Submit button is disabled. |
| You attached more than 5 files | The upload is blocked: "Maximum 5 files allowed." |

---

#### Editing a Draft or Pending Proposal

- On any **Draft** or **Pending** proposal card, click **Edit**.
- The same 3-step form opens with your existing information filled in.
- Existing attached files are shown — you can remove individual files or add new ones.
- Save as Draft again, or submit.

> You cannot edit an **Approved** project proposal. It becomes read-only once approved.

---

#### What Happens After You Submit

Your proposal card will show one of these statuses:

> 📸 **[SCREENSHOT]** Three proposal cards side by side (or stacked) showing each status badge: Pending (yellow/orange), Approved (green), Rejected (red) — so students can immediately recognise what their card means.

| Status | What it means | What you can do |
|--------|--------------|-----------------|
| **Pending** | Waiting for your guide to review | Wait. You can still submit another proposal in the meantime. |
| **Approved** | Guide approved your project | Post progress updates. Submit evaluation files when the event opens. |
| **Rejected** | Guide rejected your proposal with feedback | Read the feedback on the card and submit a revised or new proposal. |

> 📸 **[SCREENSHOT]** A Rejected proposal card expanded — showing the faculty's rejection feedback message visible below the status badge.

---

#### Posting a Progress Update (Approved Projects Only)

Once your project is approved, you can post updates to keep your guide informed.

1. On your project card, click **Post Update**.
2. Enter the update content (required). You can also add links or attach files.

> 📸 **[SCREENSHOT]** The Post Update modal — showing the Title field (optional), Content text area (required), Links field, file upload, and Submit button.

3. Click **Submit**.

Your guide receives an email notification. Updates appear in a timeline on the project page.

> 📸 **[SCREENSHOT]** The project update timeline — showing two or three updates in chronological order with timestamps, author labels, and content.

---

#### Submitting Mid-Term or End-Term Files

When the admin opens a mid-term or end-term evaluation period, a **Submit Files** button appears on your project.

> 📸 **[SCREENSHOT]** The project card or project page showing the Submit Files button — highlight that it only appears when an evaluation event is active.

1. Click **Submit Files**.
2. Upload your report (PDF or ZIP), presentation (PPTX or ZIP), and optionally a plagiarism report.

> 📸 **[SCREENSHOT]** The Submit Files modal — showing the three upload slots (Report, Presentation, Plagiarism Report) and the Submit button.

3. At least one file is required.
4. Click **Submit**.

**What can go wrong:**

| Problem | What you see |
|---------|-------------|
| No file selected | "Please upload at least one file." |
| Wrong file type | "Only PDF, ZIP, PPTX files allowed." |

---

#### Viewing Your Evaluation Results

After your guide or panel has entered your marks, you will see them on your project page:

> 📸 **[SCREENSHOT]** The evaluation results section on the project page — showing mid-term marks (guide score, panel score, total, remarks) and the general project feedback banner. Annotate each section clearly.

- **Mid-term results:** guide score, panel score, total marks, and any written remarks.
- **End-term results:** all rubric fields, total, and remarks.
- **Per-student feedback:** personal comments your guide left for you individually.
- **General project feedback:** comments about the project as a whole, visible to all group members.

---

### 4.5 Archive Tab

The Archive tab is always visible and shows your projects from previous semesters. This is read-only — you cannot make any changes here.

> 📸 **[SCREENSHOT]** The Archive tab — showing one or two archived project cards with the project title, group name, batch year, mentor name, and a collapsed evaluation data section. Show the expand button.

Each archived project card shows the project title, group name, original batch, mentor's name, and all evaluation data from that semester.

> **If you transferred branches:** Your old projects are still visible here, matched to your email address.
>
> **If there are no archived projects:** The tab will show "No archived projects found."

---

## 5. Faculty Guide

### 5.1 Your Dashboard

After logging in, you see your faculty dashboard. The tabs available to you depend on the current phase of the semester:

| Tab | When it appears |
|-----|----------------|
| **Proposals** | Always — shows pending proposals addressed to you |
| **Mentees** | Always — shows groups whose projects you have approved |
| **Mid-Term** | Only when the admin has opened a Mid-Term evaluation |
| **End-Term** | Only when the admin has opened an End-Term evaluation |
| **Panels** | Only when you have been assigned to an evaluation panel |
| **Archive** | Always — shows your mentees from previous semesters |

> 📸 **[SCREENSHOT]** The faculty dashboard tab bar — showing all six tabs. Annotate which tabs are always visible vs. conditionally visible.

> 📊 **[FLOWCHART]** Render the full `user_flow/faculty_flow.md` diagram as an image for a high-level overview of the faculty journey.

---

### 5.2 Proposals Tab

This tab shows all project proposals that student groups have submitted to you.

> 📸 **[SCREENSHOT]** The Proposals tab — showing two or three proposal cards. One card should have the blue "New Update" badge and another should have the red "Original Batch" dropper label. Annotate both badges.

Each proposal card shows:
- Project title
- Group number and member names with roll numbers
- Tags / keywords
- Date submitted

**Special labels you may see:**
- A **blue "New Update"** badge means the student posted a project update you have not read yet.
- A **red "Original Batch: YYYY"** label next to a student's name means that student is a dropper — they are from an older batch but working with the current group.

---

#### Approving a Proposal

1. Click the proposal card to open the full details.

> 📸 **[SCREENSHOT]** The proposal detail modal — showing the full project description, attached files list, links, faculty name, and the Approve and Reject buttons at the bottom.

2. Review the project description, attached files, and any links.
3. Click **Approve**.
4. Optionally enter a message for the students (they will receive it by email).

> 📸 **[SCREENSHOT]** The approval confirmation modal — showing the optional feedback text area and the Confirm button.

5. Click **Confirm**.

The group is notified by email, and the project moves to your **Mentees** tab.

**What can go wrong:**

| Problem | What you see |
|---------|-------------|
| You have too many students assigned to you already | "You have reached your maximum student limit. Please contact admin to increase your limit." You cannot approve until the admin raises your limit. |
| You have too many groups already | "You have reached your maximum group limit." Same resolution — contact admin. |

> If you are at capacity and a group is waiting, you should either contact the admin to raise your limit, or reject the proposal so the group can choose a different guide.

---

#### Rejecting a Proposal

1. Click the proposal card to open the full details.
2. Click **Reject**.
3. Enter your feedback explaining why — **this is required**. The students will receive it by email.

> 📸 **[SCREENSHOT]** The rejection modal — showing the required feedback text area (with a red asterisk or "required" label) and the Confirm button.

4. Click **Confirm**.

The proposal is removed from your list. The students can read your feedback and submit a revised proposal.

---

### 5.3 Mentees Tab

This tab shows all groups whose projects you have approved. You are their guide for the semester.

> 📸 **[SCREENSHOT]** The Mentees tab — showing a grid or list of group cards. Each card should display the group number, project title, and a mini member list.

Click any group card to open the full group page:
- **Left sidebar:** all group members with photos, names, roll numbers, and emails.
- **Main area:** project details, and a timeline of all progress updates posted by the students.

> 📸 **[SCREENSHOT]** The full mentee group page — with the left sidebar showing members (with photos) and the right area showing the project info and update timeline. Annotate the sidebar and main area separately. Also highlight an unread update (if it has a visual highlight).

Student updates you have not read yet are highlighted. Click **Mark Read** to dismiss them.

---

#### Posting a Message to a Group

You can post updates or messages in the group's timeline.

1. Click **Post Update** in the group view.
2. Enter your message (required). Add links or files if needed.

> 📸 **[SCREENSHOT]** The Post Update modal from the faculty view — same layout as the student version but shown in context of the mentee page.

3. Click **Submit**.

The update appears in the timeline labelled with your name.

---

#### Leaving Feedback

**General project feedback** (visible to the whole group):
1. Click **Add Feedback** or **Edit Feedback** on the project page.
2. Enter your feedback.
3. Click **Save**.

> 📸 **[SCREENSHOT]** The general feedback modal — showing the text area and Save button. Annotate that this is visible to all group members.

**Per-student feedback** (visible only to that individual student):
1. Click **Per-Student Feedback**.
2. Select the student.
3. Enter your feedback.
4. Click **Save**.

> 📸 **[SCREENSHOT]** The per-student feedback modal — showing the student selector dropdown and the feedback text area. Annotate that this is private to the selected student.

---

### 5.4 Mid-Term and End-Term Evaluation Tabs

These tabs appear only when the admin has opened the corresponding evaluation period.

> 📸 **[SCREENSHOT]** The Mid-Term (or End-Term) tab — showing the list of groups to evaluate. One row should have a green checkmark (already evaluated) and another should have a red Evaluate button (not yet done).

The tab shows a list of all groups you need to evaluate. A green checkmark means you have already submitted an evaluation for that group. A red **Evaluate** button means you have not.

You can revise an evaluation at any time while the evaluation period is open.

---

#### Evaluating a Group

1. Click **Evaluate** (or **Edit Evaluation** if you are revising).
2. The evaluation form opens. Choose your input method:

**Option A — Rubric Mode (recommended):**

> 📸 **[SCREENSHOT]** The evaluation modal in Rubric Mode — showing the structured fields (Guide section and Panel section with individual criterion rows), the auto-calculated total at the bottom, the Remarks text area, and the mode toggle. Annotate the max value shown on each field.

Fill in individual fields for each criterion (e.g., Problem Definition, Presentation Skills). The total is calculated automatically. Each field has a maximum — you cannot enter more than the allowed marks for that criterion.

**Option B — Direct Entry Mode:**

> 📸 **[SCREENSHOT]** The evaluation modal in Direct Entry Mode — showing the single Marks field and the Remarks text area.

Enter the total marks directly in a single field. Use this if you prefer not to break down by criterion.

3. For each group member, set their **attendance** (Present or Absent) and optionally give a **star rating** (0–5).

> 📸 **[SCREENSHOT]** The per-student section of the evaluation modal — showing attendance toggles (Present/Absent) and star rating inputs for each group member.

4. Add **remarks** (optional) — these are shown to the students.
5. Click **Save Evaluation**.

**What can go wrong:**

| Problem | What you see |
|---------|-------------|
| You tried to save after the evaluation period ended | "Evaluation event is not active." Contact the admin — they can briefly reactivate the event. |
| Marks exceed the maximum allowed | The system automatically caps them at the maximum when saved. |

---

### 5.5 Panels Tab

If the admin has placed you on an evaluation panel, this tab appears. A panel is a committee that evaluates groups — these may not be your own mentee groups.

> 📸 **[SCREENSHOT]** The Panels tab — showing the panel info header (panel number, other faculty members, room) and the list of groups assigned to this panel below it.

The tab shows:
- Your panel number
- The other faculty members on your panel
- The room/location (if the admin set one)
- The list of groups your panel is assigned to evaluate

Evaluating groups here works exactly the same as in the Mid-Term or End-Term tabs (see Section 5.4).

---

#### Downloading and Uploading an Evaluation Template

If you prefer to fill in marks offline (for example, using a printed sheet first), you can:

1. Click **Download Evaluation Template** — this gives you an Excel file with all group members and rubric columns pre-filled.

> 📸 **[SCREENSHOT]** A sample of the downloaded evaluation template Excel file — showing the column headers (Group #, Student Name, Roll Number, and rubric criterion columns) so faculty know what to expect.

2. Fill in the marks in Excel.
3. Click **Upload Evaluation Template** and select your filled file.
4. Review the preview — the system will flag any rows where marks exceed the allowed maximum.

> 📸 **[SCREENSHOT]** The upload template preview — showing parsed rows with a warning flag on any row where marks exceeded the max.

5. Click **Confirm** to save.

---

#### Exporting the Final Evaluation Sheet

Click **Export Final Sheet** to download an Excel file with all evaluation marks for your panel. This is useful for printing and obtaining physical signatures.

> 📸 **[SCREENSHOT]** A sample of the exported final evaluation sheet — showing the formatted layout with panel header, member names, scores, and a signature row at the bottom.

---

### 5.6 Archive Tab

Shows all groups you mentored in previous semesters. Each entry shows the project title, group name, batch year, member names, and all evaluation data. This is read-only.

> 📸 **[SCREENSHOT]** The faculty Archive tab — showing one or two archived mentee entries with their project details and evaluation data expanded.

> If your email address changed since a previous semester, your old archived mentee projects still show correctly — the mentor name is saved as a permanent record at the time of archival.

---

## 6. Admin Guide

### 6.1 Your Dashboard

As admin, you have access to all sections of the portal. The main tabs are:

| Tab | Purpose |
|-----|---------|
| **Overview** | System-wide statistics and faculty capacity settings |
| **Students** | View, edit, import, and delete student accounts |
| **Faculty** | View, create, edit, and delete faculty accounts |
| **Groups** | View and manage all student groups |
| **Panels** | Create and manage evaluation panels |
| **Events** | Control which semester phase is active |
| **Exports** | Download data in Excel or ZIP format |
| **Archive** | Browse all previous semester data |

> 📸 **[SCREENSHOT]** The admin dashboard — showing the full tab bar with all eight tabs labelled.

> 📊 **[FLOWCHART]** Render the full `user_flow/admin_flow.md` diagram as an image for an overview of all admin capabilities.

---

### 6.2 Overview Tab

The overview shows a summary of the current state of the portal:
- Number of students, faculty, groups, and projects
- How many groups are in each status (Forming, Proposal Pending, Approved, Dissolved)
- How many student accounts have not been activated yet

> 📸 **[SCREENSHOT]** The Overview tab — showing the statistics cards (Total Students, Total Faculty, Total Groups, Unactivated Accounts, Groups by Status). Annotate what each card means.

**Setting faculty capacity limits:**

You can control how many students and groups each faculty member can take on.

> 📸 **[SCREENSHOT]** The Global Capacity Settings section (collapsed and expanded states) — showing the maxStudents and maxGroups input fields and the Save button.

- **Global default:** Set a single limit that applies to all faculty (e.g., max 21 students, max 7 groups). Use the **Global Capacity Settings** section and click **Save**.
- **Per-batch override:** If you need a faculty member to have a different limit for a specific batch, use the **Per-Batch Overrides** section. This takes priority over the global default for that batch only.

---

### 6.3 Students Tab

#### Viewing Students

The table shows all student accounts. Use the filters at the top to narrow down by batch, branch, group status, verification status, or participation status. Use the search bar to find a student by name or email.

> 📸 **[SCREENSHOT]** The Students tab — showing the full table with columns (Name, Email, Roll Number, Branch, Group Status, Verification), the filter row at the top, and the search bar. Annotate the filter dropdowns.

---

#### Editing a Student

1. Click the **Edit** button on a student's row.
2. Update any of the fields: name, email, roll number, branch, or semester.
3. Click **Save**.

> 📸 **[SCREENSHOT]** The Edit Student modal — showing all editable fields. Highlight the **Target Batch** field specifically, as it is the key dropper configuration field.

**Setting up a dropper student:**

A dropper is a student repeating a semester with a different batch. To set this up:

1. Edit the student's account.
2. Set the **Target Batch** field to the batch they are working with (e.g., 2024).
3. Save.

After this, the student will see the 2024 batch directory, can join groups with 2024 students, and will be evaluated alongside that batch. A red "Original Batch: YYYY" label will appear next to their name in faculty views so the guide is aware.

**What can go wrong:**

| Problem | What you see |
|---------|-------------|
| Email already used by another account | "Email already exists." |
| Roll number already used by another account | "Roll number already exists." |

---

#### Deleting a Student

1. Click **Delete** on a student's row.
2. A confirmation box will appear: "Remove [Name]? This will remove them from any group. This action is irreversible."

> 📸 **[SCREENSHOT]** The delete confirmation modal — showing the warning message and the Confirm / Cancel buttons.

3. Click **Confirm**.

The student is removed from any group they belong to. If they were the only member of a group, that group will have no members.

> **Caution:** If the student is the sole member of a group with an approved project, the group will effectively be orphaned. Consider the impact before deleting.

---

#### Importing Students in Bulk

1. Click **Import Students**.
2. Upload a CSV or Excel file. The file must have these columns: **Name, Email, Roll Number, Branch, Semester**.

> 📸 **[SCREENSHOT]** The file upload step — showing the upload area and the expected column names listed.

3. A preview will appear. Each row is colour-coded:
   - **Green** — valid and ready to import (new account or update to existing).
   - **Yellow** — matched to an existing account by name (will update that account).
   - **Red** — invalid, with the reason shown.

> 📸 **[SCREENSHOT]** The import preview table — showing a mix of green, yellow, and red rows. Each red row should have the reason visible in a column (e.g., "Email already exists."). Annotate the colour coding.

4. Review the preview, then click **Commit** to import only the valid rows.

**Common reasons a row is marked invalid:**

| Reason shown | What to fix |
|--------------|------------|
| "Name is required." | The Name column is empty for this row. |
| "Cannot create account without email or roll number." | Both the Email and Roll Number columns are empty and the name doesn't match an existing account. |
| "Email already exists." | Another account already uses this email. |
| "Roll number already exists." | Another account already uses this roll number. |
| "Duplicate email in import file." | The same email appears more than once in your uploaded file. |

Newly imported students must verify their email with an OTP on first login, and will be prompted to change their password.

---

### 6.4 Faculty Tab

#### Creating a Faculty Account

1. Click **Create Faculty**.
2. Fill in: Name (required), Email (required), Department, and Expertise (comma-separated keywords).

> 📸 **[SCREENSHOT]** The Create Faculty modal — showing all input fields and the Create button.

3. Click **Create**.

The account is created immediately. The faculty member's initial password is `changeme` and they will be prompted to change it on first login. They do not need to verify via OTP.

---

#### Editing a Faculty Account

Same as editing a student, with the addition of a **photo upload** field and a **Batch Limits** section for per-batch capacity overrides.

> 📸 **[SCREENSHOT]** The Edit Faculty modal — highlighting the photo upload area and the Batch Limits configuration section (showing maxStudents and maxGroups fields per batch).

---

#### Deleting a Faculty Account

> **Important:** If the faculty member has approved student groups, deleting their account will leave those groups without a guide. The students' project pages will show a blank or "Unknown" guide name. Before deleting, ensure their groups are either reassigned or that the semester is ending.

The deletion process is the same as for students.

---

### 6.5 Groups Tab

This tab shows all current (non-archived) student groups. Use the filters to browse by status or batch.

> 📸 **[SCREENSHOT]** The Groups tab — showing the table with columns (Group #, Batch, Members, Status, Project Title, Created Date) and the filter row. Show groups in different statuses (Forming, Approved) so the status badges are visible.

**Viewing a group:** Click any row to see all members, all project proposals, and the group's history.

**Editing a group:** Click **Edit** to change the group name, target batch override, or status. You can manually set a group to **Dissolved** if needed.

> 📸 **[SCREENSHOT]** The Edit Group modal — showing the Group Name, Target Batch, and Status fields. Annotate the Dissolved option in the Status dropdown.

> **Dropper group:** If an entire group is repeating together, set the group's **Target Batch** here. This affects which panels they are assigned to and which batch capacity limits apply.

---

### 6.6 Panels Tab

Evaluation panels are committees of faculty that assess student groups during mid-term and end-term evaluations.

> 📸 **[SCREENSHOT]** The Panels tab — showing the panels table with columns (Panel #, Batch, Faculty Members, Room, Status, Groups Count) and the Create Panel and Auto-Create Panels buttons.

---

#### Creating a Panel Manually

1. Click **Create Panel**.
2. Select the **batch year** this panel is for (required).
3. Select the **faculty members** for this panel (required — at least one).
4. Optionally enter a **room or location**.
5. Click **Create**.

> 📸 **[SCREENSHOT]** The Create Panel modal — showing the batch year selector, the faculty multi-select dropdown, and the room text field.

The assigned faculty receive an email notification. The panel appears in their **Panels** tab.

---

#### Auto-Creating Panels

The system can automatically distribute groups across faculty for you.

1. Click **Auto-Create Panels**.
2. Select the batch year.
3. The system calculates how many groups exist and how much remaining capacity each faculty member has, then proposes a distribution of roughly 3–5 groups per panel.
4. Review the proposed assignments.

> 📸 **[SCREENSHOT]** The Auto-Create Panels preview — showing the proposed panel assignments (e.g., Panel 1: Faculty A + Faculty B → Groups 1, 2, 3; Panel 2: Faculty C + Faculty D → Groups 4, 5, 6).

5. Click **Confirm** to create all panels at once.

**What can go wrong:**

| Problem | What you see |
|---------|-------------|
| Faculty don't have enough combined capacity | "X groups could not be assigned. Please increase faculty limits or add more faculty." |
| No approved groups exist for this batch | "No approved groups found for batch YYYY." |

---

#### Importing Panels from Excel

1. Click **Upload Panel Template**.
2. Select the batch year.
3. Upload an Excel file with columns: **Faculty Email, Batch Year, Room**.
4. Review the preview — invalid rows will show a reason.
5. Click **Commit**.

> 📸 **[SCREENSHOT]** The panel import preview — showing parsed rows with one valid (green) and one invalid (red, "Faculty email not found") row.

---

#### Editing or Archiving a Panel

Click **Edit** on a panel to change its faculty members, room, or batch. To remove a panel from active use, check the **Archive** option — the panel disappears from faculty dashboards.

---

### 6.7 Events Tab

Events control what students and faculty can do. **Only one phase can be active at a time.**

The typical sequence is:
1. Group Formation → 2. Mid-Term Evaluation → 3. End-Term Evaluation → (repeat for next semester)

> 📸 **[SCREENSHOT]** The Events tab — showing the event timeline with one Group Formation event (active, green), one Mid-Term event (inactive, grey), and one End-Term event. Show the status badge, dates, and action buttons on each row.

---

#### Creating a Group Formation Event

> **This is a major action.** When you create a Group Formation event, the system automatically:
> - Archives all current groups, projects, and panels.
> - Resets all faculty load counters to zero.
> - Marks students in the selected batches as participating.
> - Sends an email to all participating students.
>
> **This cannot be undone.**

1. Go to the **Events** tab and click **Create Event**.
2. Select **Group Formation / Project Proposal**.
3. Set the **end date** (required — must be in the future).
4. Optionally set an **extension date** for late submissions.
5. Select the **participating batches** (e.g., 2024, 2023) — at least one required.
6. Configure the **rubric** if you want custom evaluation criteria, or leave as default.

> 📸 **[SCREENSHOT]** The Create Group Formation Event modal — showing the event type selector, end date picker, extension date picker, participating batches multi-select, and the rubric configuration section. Also show the admin password field at the bottom.

> 📸 **[SCREENSHOT]** The rubric builder interface (Builder Mode) — showing sections (Guide, Panel), individual criterion rows with name and max marks fields, and the add/remove buttons.

7. Enter your **admin password** to confirm.
8. Click **Create**.

**What can go wrong:**

| Problem | What you see |
|---------|-------------|
| Admin password is wrong | "Incorrect password." The event is NOT created. |
| End date is in the past | "End date must be in the future." |
| No batches selected | "At least one batch must be selected." |
| A Mid-Term or End-Term event is still active | "Please close the active evaluation event before starting a new group formation period." Close the evaluation event first. |

---

#### Creating a Mid-Term or End-Term Evaluation Event

> You cannot create an evaluation event while the Group Formation event is still active. End it first.

1. Click **Create Event** and select **Mid-Term Evaluation** or **End-Term Evaluation**.
2. Set the end date and optional extension date.
3. Configure the rubric (or use the default).
4. Enter your admin password.
5. Click **Create**.

> 📸 **[SCREENSHOT]** The Create Mid-Term Event modal — similar to the GF event modal but with the Mid-Term type selected. Highlight the rubric section showing the default fields (Guide and Panel sections).

Faculty will immediately see a new **Mid-Term** or **End-Term** tab on their dashboard.

Both Mid-Term and End-Term events can be active at the same time — faculty will see separate tabs for each.

---

#### Activating and Deactivating Events

You can pause any active event without deleting it.

1. Click the **Deactivate** toggle on the event row.
2. Enter your admin password.
3. Confirm.

> 📸 **[SCREENSHOT]** An event row in the Events tab — highlighting the Activate/Deactivate toggle button and the admin password prompt that appears when it is clicked.

While deactivated, faculty cannot save evaluations and students cannot form groups. You can reactivate the event at any time the same way — useful if a faculty member needs extra time to submit marks.

---

#### Editing an Event

You can change the end date, extension date, participating batches, or rubric of an existing event.

1. Click **Edit** on the event row.
2. Enter your admin password.
3. Make changes and save.

> **Note on batches:** If you add a new batch to a running event, students in that batch will become participating. If you remove a batch, those students are not automatically removed — you will need to manage that manually.

> **Note on rubric:** Avoid changing the rubric after faculty have already started entering marks. The exported data may have inconsistent column names if the rubric changes mid-event.

---

#### Deleting an Event

1. Click **Delete** on the event row.
2. Enter your admin password.
3. Confirm.

The event is removed from the system. The groups, projects, and evaluations already created are not affected.

---

### 6.8 Exports Tab

#### Individual Exports

| Export | What you get |
|--------|-------------|
| **Student Directory** | Excel file of all students in a selected batch |
| **Faculty Directory** | Excel file of all faculty with their load and capacity |
| **Panel Distribution** | Excel file showing which faculty are in each panel and which groups they cover |
| **Evaluations** | Excel file with all marks (mid-term, end-term, or both) for a selected batch |
| **Official IIITNR Format** | Formatted Excel sheet matching the institute's official evaluation template, with college header and per-panel sheets |
| **JSON Snapshot** | A complete backup of all data — can be re-imported later |

> 📸 **[SCREENSHOT]** The Exports tab — showing all export buttons with their batch selectors. Annotate each export type briefly.

For each export, select the batch (or "All") and click the export button. The file downloads automatically.

---

#### Complete Database Export (ZIP)

Click **Export Entire Database** to download everything in one ZIP file. The ZIP contains:

> 📸 **[SCREENSHOT]** The "Export Entire Database" button on the Exports tab — highlighted. Also show the loading/progress state if one exists while the ZIP is being generated.

```
Complete_MINOR_Project_Database_DATE.zip
├── Students/
│   └── Students_Batch_YYYY.xlsx (one per batch)
├── Faculty/
│   └── Faculty_Directory.xlsx
├── Official_Format/
│   └── MINOR_Project_Batch_YYYY-YYYY.xlsx (one per batch)
├── Panel_Distribution/
│   └── Panel_Distribution_Batch_YYYY.xlsx (one per batch)
├── Evaluations/
│   └── Evaluations_Full_Batch_YYYY.xlsx (one per batch)
└── Snapshot/
    └── projects_snapshot.json
```

The system automatically detects which batches to include. If some files are missing from the ZIP, individual sub-exports may have had no data for that batch — download those individually and select the correct batch manually.

---

#### Importing Data

**Bulk student/faculty import:** Covered in Section 6.3 (Import Students in Bulk) and 6.4.

**Excel Full Import (IIITNR official format):**
Upload the institute's official Excel format to import students, faculty, groups, and projects all at once.

1. Click **Excel Full Import**.
2. Upload the Excel file and select the semester.
3. Review the preview — invalid rows are shown with reasons.
4. Click **Commit**.

> 📸 **[SCREENSHOT]** The Excel Full Import preview — showing the tab-by-tab breakdown (Students tab, Faculty tab, Groups tab) with valid and invalid rows colour-coded.

**Common errors:**

| Error shown | Fix |
|-------------|-----|
| "Faculty '[Name]' not found." | Create the faculty account first, then re-import. |
| "Email already exists with different roll number." | Correct the roll number in the Excel file. |
| "Required column '[Name]' not found in sheet." | The Excel file is missing a required column — check the template format. |

**JSON Snapshot Import:**
Restore a previously exported snapshot.

1. Click **Snapshot Import**.
2. Upload the `.json` file.
3. Review the preview — it will list how many projects and groups were found, and warn you of any orphaned records (projects with no matching group).

> 📸 **[SCREENSHOT]** The snapshot import preview — showing the summary (e.g., "47 projects found, 3 orphan projects, 2 duplicate emails skipped") and the Commit button.

4. Click **Commit**.

---

### 6.9 Archive Tab

The Archive tab shows all data from previous semesters (created automatically each time a Group Formation event is started).

> 📸 **[SCREENSHOT]** The Archive tab — showing the year selector dropdown at the top and the three sub-tabs (Projects, Participants, Panels). Show the Projects sub-tab with one expanded row displaying full evaluation data.

Use the **year selector** to browse by semester. Three sub-tabs are available:

- **Projects** — all archived projects with full evaluation data. Click any row to expand all details.
- **Participants** — all students who participated that semester.
- **Panels** — all evaluation panels from that semester.

All archive data is **read-only**. You can export any year's data to Excel using the export button.

> **If a faculty member was deleted before the semester ended**, their name will appear as "Unknown" in the archived project's mentor field.

---

## 7. Troubleshooting

### "I never received my OTP email."
1. Check your spam/junk folder.
2. Wait 60 seconds and click **Resend OTP** on the login page.
3. If it still does not arrive, contact the admin — they can manually activate your account.

---

### "My OTP says 'Invalid or expired'."
OTPs are valid for only 10 minutes. If it has been longer, click **Resend OTP** (after 60 seconds) to get a new one. Entering an old OTP after a new one has been sent will also give this error — always use the most recent code.

---

### "The Create Group button is missing or greyed out."
The Group Formation period is not currently open, or you are already in a group. Contact the admin to confirm whether group formation is active for your batch.

---

### "I can't submit my proposal — it says members haven't accepted."
All students you invited to your group must click **Accept** on the invite before you can submit a proposal. Check the Group tab — anyone with an "Awaiting Response" label has not yet accepted. Ask them to log in and accept.

---

### "My guide can't approve our proposal — they say they're at capacity."
The guide has reached the maximum number of students or groups they can take on. You have two options:
1. Ask the admin to increase the guide's limit.
2. Choose a different guide — withdraw your proposal and resubmit with a different faculty member selected.

---

### "I submitted my evaluation but got an error saying the event is not active."
The evaluation period ended between when you opened the form and when you tried to save. Contact the admin — they can briefly reactivate the event so you can save your marks.

---

### "A faculty member's name shows as 'Unknown' in an archived project."
The faculty account was deleted before or during the archival process. The project data is intact, but the guide's name was not captured. This is a historical record issue and cannot be corrected retroactively.

---

### "The complete ZIP export is missing some files."
The system detects batches automatically. If no active event is running and student records are sparse, it may not detect all batches correctly. Download the missing exports individually from the **Exports** tab and manually select the correct batch.

---

### "A student can't see the correct batch directory — they see the wrong students."
Check if the student has a **Target Batch** set (admin: Students tab → Edit that student). If the target batch is set to the wrong year, update it to the correct one.

---

### "I deleted an event but the groups are still archived."
Archival is permanent. Deleting the Group Formation event that triggered the archival does not restore the archived groups or projects. If this was a mistake, contact your system administrator for a database-level restoration using a JSON snapshot backup.

---

*End of User Manual.*

> For technical support or to report an issue, contact your system administrator.
