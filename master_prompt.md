Create a comprehensive web application for automating the Minor Project management process at IIIT-Naya Raipur (Indian Institute of Information Technology - Naya Raipur). The app should be named "IIITNR Minor Project Portal" and designed to streamline group formation, project proposals, faculty mentorship, evaluations, communications, and administrative oversight for semesters starting from Semester 3. There are three branches: CSE (Computer Science and Engineering), ECE (Electronics and Communication Engineering), and DSAI (Data Science and Artificial Intelligence). The system must support groups of up to 3 students (cross-branch allowed), faculty supervisors (limited to 21 students or 7 groups per faculty), and role-based access for students, faculty, and admins.

Use a modern tech stack: React.js for the frontend with Radix-UI for components (keep the design plain, simple, and minimalist—use a clean sans-serif font like Inter, neutral color palette with blues and grays for accents, ample white space, and subtle shadows for depth). Ensure the UI is intuitive, with tooltips, guided workflows (e.g., step-by-step wizards for group formation and project creation), error messages in plain language, and accessibility features like ARIA labels, keyboard navigation, high contrast modes, and screen reader compatibility. Make it responsive for mobile and desktop, assuming users may have varying tech literacy—include onboarding tutorials, FAQ sections, and contextual help buttons. Avoid complex jargon; use simple labels like "Form Your Group" instead of "Initiate Team Assembly." The app should feel modern yet timeless, appealing to tech-savvy students and less digital-native faculty/admins, with no flashy animations—focus on functionality and ease.

For the backend, use Node.js with Express.js, MongoDB for the database (schema should include collections for Users, Groups, Projects, Proposals, Evaluations, Messages, Notifications, and Settings). Implement authentication via institute email (e.g., integrate with Google OAuth or a custom JWT system verifying @iiitnr.edu.in domains). Use Socket.io for real-time features like notifications and chat. Ensure data security with role-based access control (RBAC), encryption for sensitive data (e.g., grades), and audit logs for admin actions. Host on a platform like Vercel or AWS for scalability.

Define user roles clearly:
- **Students**: Can log in, form/reverse groups, create/submit project proposals, view faculty availability, communicate with mentors, upload progress, view personal evaluations/results.
- **Faculty**: Can log in, review/approve/reject proposals (with feedback), mentor groups (up to 21 students/7 groups), communicate, enter evaluation marks, choose grading methods.
- **Admin**: Has superuser access—view/edit all data, approve/reject groups/proposals, set faculty limits/deadlines, compile results, manage users, and generate reports.

Core Features:

1. **Authentication and Onboarding**:
   - Login/signup exclusively with institute email (auto-detect branch from email or profile setup). First-time users get a simple profile setup wizard: enter name, branch, semester, roll number.
   - Passwordless login option via email OTP for simplicity.
   - Role assignment: Students auto-assigned; faculty/admins verified by admin or predefined list.
   - Dashboard home page tailored by role: Students see group status, deadlines; Faculty see pending proposals, mentee list; Admins see overview stats (e.g., unassigned students, faculty load).

2. **Group Formation (Early Semester)**:
   - Students access a "Form Group" section: Search for batchmates by name, roll number, or branch (with filters and suggestions to avoid errors).
   - Invite up to 2 others via email or in-app notification; invites expire after 48 hours.
   - Group creation is reversible if no project proposal is submitted—add a "Dissolve Group" button with confirmation prompt.
   - Display a "Surplus Students" list: Public view of students without groups or with unaccepted projects (anonymized or opt-in for privacy), color-coded (e.g., yellow for "Group Formed, Project Pending").
   - Cross-branch teams allowed; validate group size (1-3) with real-time feedback.
   - Once formed, lock group until proposal approval or dissolution.

3. **Project Proposal**:
   - From group dashboard, create project: Input title, objective (rich text editor for descriptions), tags (e.g., AI, Hardware, Software), and optional attachments (PDFs up to 5MB for proposals).
   - Faculty selection: Searchable list of faculty with profiles (name, department, expertise areas, current load—show available slots as "X/21 students" or "Y/7 groups" in green/red for availability).
   - Submit proposal: Sends notification/email to selected faculty; students see status (Pending, Approved, Rejected).
   - Faculty reviews in their dashboard: View proposal details, group members' profiles, approve with one click, or reject with mandatory feedback message (textarea with character limit).
   - Upon approval, move group to "Approved Projects" section; auto-update surplus list.
   - Add creative ease: Faculty can suggest alternatives (e.g., "Similar to existing project—merge?"); students get reminders if no proposal submitted by deadline.

4. **Communication and Progress Tracking**:
   - Integrated messaging: Per-group chat room between students and mentor (real-time via Socket.io, with file uploads for reports, code snippets).
   - Progress updates: Students upload weekly/monthly logs (text, files); faculty comments inline.
   - Notification system: In-app bell icon + email/SMS for key events (proposal status, messages, deadlines approaching—e.g., "2 days left for mid-evaluation").
   - Calendar integration: Shared group calendar showing deadlines, evaluation dates (set by admin); reminders via push notifications if browser allows.

5. **Evaluations**:
   - Mid-semester and End-term: Admin sets dates; on those periods, faculty access "Evaluate Groups" section.
   - Panel simulation: Though evaluations are panel-based, app focuses on individual faculty input—faculty enters marks (out of 100) for each student/group, with rubrics (e.g., presentation, innovation—customizable by admin).
   - Post-entry, faculty chooses grading method later: Absolute (direct marks), Relative (curve based on batch), Manual (adjust individually).
   - Compile results: Admin triggers "Release Results" on set date—generates grades (A-F or percentages), visible to students in their dashboard.
   - Creative additions: Auto-generate evaluation reports (PDF export); peer review option within group; anonymous feedback from students to faculty.

6. **Admin Controls**:
   - Master dashboard: View all groups, projects, faculty loads (sortable tables with search/export to CSV).
   - Approve/reject groups/proposals (override faculty decisions if needed).
   - Set global limits: Per-faculty student/group caps (default 21/7, editable).
   - Manage deadlines: Date pickers for group formation, proposal submission, evaluations, results release—with auto-enforcement (e.g., lock submissions post-deadline).
   - User management: Add/remove users, reset passwords, bulk import from Excel (e.g., student lists).
   - Analytics: Reports on branch-wise participation, average grades, faculty utilization (charts via Recharts integrated with Radix-UI).
   - Audit logs: Track all changes (who, what, when) for accountability.
   - Emergency tools: Mass notifications, system maintenance mode.

Additional Creative Features for Ease and Usability:
- **Search and Filters**: Global search bar for quick access (e.g., find projects by keyword); filters in lists (e.g., by branch, status).
- **Help and Support**: In-app chatbot (simple FAQ-based) or contact admin button; video tutorials embedded (YouTube iframes).
- **Customization**: Users set preferences (e.g., dark mode, notification frequency); admins customize email templates.
- **Integration**: Optional Google Calendar sync for deadlines; export data to institute LMS if API available.
- **Error Handling and UX Polish**: Prevent common mistakes (e.g., auto-save drafts for proposals); loading spinners with messages like "Fetching faculty list..."; success toasts (e.g., "Group formed successfully!").
- **Scalability and Future-Proofing**: Design for multi-semester support (archive past data); add hooks for extensions like plagiarism checks or integration with GitHub for code projects.
- **Testing Considerations**: Ensure edge cases like single-student groups, faculty overload alerts, concurrent edits (use optimistic UI).

The final app should be deployable, with a focus on performance (lazy loading, code splitting). Generate the full codebase structure, including sample components (e.g., GroupForm.tsx using Radix-UI Dialog and Select), routes (React Router), API endpoints (e.g., POST /api/proposals), and database schemas. Prioritize simplicity—avoid over-engineering; make it functional for a small team to maintain.