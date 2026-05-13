# Student User Flow

```mermaid
flowchart TD
    Start([Student Opens Portal]) --> Login

    %% ── AUTH ──────────────────────────────────────────────
    subgraph AUTH["Authentication"]
        Login[Enter Email + Password]
        Login --> AuthCheck{Credentials valid?}
        AuthCheck -- No --> LoginErr[/"Error: Invalid credentials"/]
        LoginErr --> Login

        AuthCheck -- Yes, unverified --> OTPSent[OTP sent to email]
        OTPSent --> EnterOTP[Enter 6-digit OTP]
        EnterOTP --> OTPCheck{OTP correct & not expired?}
        OTPCheck -- No --> OTPErr[/"Error: Invalid or expired OTP"/]
        OTPErr --> ResendCheck{Waited 60 s?}
        ResendCheck -- No --> Cooldown[/"Resend button disabled — countdown shown"/]
        Cooldown --> ResendCheck
        ResendCheck -- Yes --> OTPSent
        OTPCheck -- Yes --> Verified[Account verified]

        AuthCheck -- Yes, verified --> Verified
        Verified --> MustChange{mustChangePassword?}
        MustChange -- Yes --> ForceChange["/change-password page"]
        ForceChange --> PwCheck{Old pw correct & new pw valid?}
        PwCheck -- No --> PwErr[/"Error: shown inline"/]
        PwErr --> ForceChange
        PwCheck -- Yes --> Dashboard
        MustChange -- No --> Dashboard
    end

    %% ── DASHBOARD ─────────────────────────────────────────
    Dashboard([Student Dashboard])
    Dashboard --> TabCheck{Which tab?}

    TabCheck -- Directory --> DIR
    TabCheck -- Group --> GRP
    TabCheck -- Project --> PROJ
    TabCheck -- Archive --> ARCH

    %% ── DIRECTORY TAB ─────────────────────────────────────
    subgraph DIR["Directory Tab (visible only when not in a group)"]
        DirView[View cohort student list\nFilters: Branch · Status · Verification\nSearch by name]

        DirView --> InvitesCheck{Pending invites?}
        InvitesCheck -- Yes --> InviteCard[Show invite card\nCreator + member names]
        InviteCard --> InviteAction{Accept or Reject?}

        InviteAction -- Accept --> AcceptCheck{Still eligible?\nNot grouped, group not full}
        AcceptCheck -- No --> AcceptErr[/"Error: Already in group / Group full"\nInvite removed/]
        AcceptCheck -- Yes --> Joined[Added to group\nEmail sent to creator + members]
        Joined --> Dashboard

        InviteAction -- Reject --> Rejected[Invite removed\nEmail sent to creator]
        Rejected --> DirView

        InvitesCheck -- No --> CreateBtn{GF event active\nand not in group?}
        CreateBtn -- No --> Locked[/"Group creation locked\nContact admin"/]
        CreateBtn -- Yes --> SelectMembers

        SelectMembers[Select up to 2 other students\nDisabled: grouped · inactive · wrong batch]
        SelectMembers --> MemberErr{More than 2 selected?}
        MemberErr -- Yes --> MemberLimit[/"Error: Max 2 other students"/]
        MemberLimit --> SelectMembers
        MemberErr -- No --> ReviewGroup

        ReviewGroup[Click Review Group\nFetch estimated group number]
        ReviewGroup --> NumFail{API success?}
        NumFail -- No --> NumWarn[/"Warning: Cannot estimate number\nbut can still create"/]
        NumWarn --> ConfirmCreate
        NumFail -- Yes --> ShowNum[Show confirmation: Group number N]
        ShowNum --> ConfirmCreate

        ConfirmCreate{Confirm?}
        ConfirmCreate -- No --> SelectMembers
        ConfirmCreate -- Yes --> CreateCheck{Server validates\nmembership + batch}
        CreateCheck -- Fail --> CreateErr[/"Error: Already in group /\nStudent not in your batch"/]
        CreateErr --> SelectMembers
        CreateCheck -- OK --> GroupCreated[Group created — status Forming\nInvite emails sent to selected students]
        GroupCreated --> Dashboard
    end

    %% ── GROUP TAB ─────────────────────────────────────────
    subgraph GRP["Group Tab (visible only when in a group)"]
        GrpView[View group info\nMembers · Status badge · Pending invites]
        GrpView --> DropperNote{/"Any member has targetBatch override?\nShown: red Original Batch label"/}
        DropperNote --> LeaveBtn{Want to leave?}

        LeaveBtn -- No --> GrpView
        LeaveBtn -- Yes --> PwModal[Password confirmation modal]
        PwModal --> PwValid{Password correct?}
        PwValid -- No --> PwModalErr[/"Error: Incorrect password"/]
        PwModalErr --> PwModal
        PwValid -- Yes --> LastMember{Last member\nin group?}
        LastMember -- Yes --> GroupDissolved[Group dissolved\nReturn to Directory tab]
        LastMember -- No --> RemovedFromGroup[Removed from group\nReturn to Directory tab]
        GroupDissolved --> Dashboard
        RemovedFromGroup --> Dashboard
    end

    %% ── PROJECT TAB ───────────────────────────────────────
    subgraph PROJ["Project Tab (visible when group has a project)"]
        ProjView[View project cards\nStatus: Draft · Pending · Approved · Rejected]
        ProjView --> ProjAction{Action?}

        %% Create new proposal
        ProjAction -- "Create New Proposal" --> PendingInvCheck{Pending member\ninvites in group?}
        PendingInvCheck -- Yes --> PendingErr[/"Error: All members must accept\nbefore submitting"/]
        PendingInvCheck -- No --> AlreadyApproved{Group already\nhas Approved project?}
        AlreadyApproved -- Yes --> ApprErr[/"Submit button disabled:\nGroup already has approved project"/]
        AlreadyApproved -- No --> Step1

        Step1[Step 1 — Basic Details\nTitle required · Description required · Tags · Links]
        Step1 --> Step1Val{Required fields filled?}
        Step1Val -- No --> Step1Err[/"Inline: Title / Description required"/]
        Step1Val -- Yes --> Step2

        Step2[Step 2 — Select Faculty\nDropdown shows name · dept · load X/Y\nFull capacity faculty are disabled\nLocked to same faculty if 2nd proposal]
        Step2 --> Step3

        Step3[Step 3 — Attach files max 5\nSave as Draft OR Submit as Pending]
        Step3 --> SubmitType{Draft or Pending?}
        SubmitType -- Draft --> SavedDraft[Saved as Draft\nFaculty NOT notified\nEditable later via ?edit=id]
        SubmitType -- Pending --> FacultyReq{Faculty selected?}
        FacultyReq -- No --> FacErr[/"Error: Please select a faculty mentor"/]
        FacultyReq -- Yes --> Submitted[Status → Pending\nFaculty notified by email\nGroup status → ProposalPending]

        %% Edit existing proposal
        ProjAction -- "Edit Draft/Pending" --> EditForm[Pre-filled 3-step form\nExisting files shown — can remove/add]
        EditForm --> Step3

        %% View proposal status
        ProjAction -- "View Card Details" --> DetailModal[Full details modal\nTitle · Description · Files · Faculty · Status]
        DetailModal --> RejFeedback{Status = Rejected?}
        RejFeedback -- Yes --> ShowFeedback[Show rejection feedback\nCan resubmit new proposal]
        ShowFeedback --> Step1
        RejFeedback -- No --> ProjView

        %% Post update
        ProjAction -- "Post Update (Approved only)" --> UpdateModal[Modal: Content required · Links · Files]
        UpdateModal --> UpdateVal{Content filled?}
        UpdateVal -- No --> UpdateErr[/"Error: Content required"/]
        UpdateVal -- Yes --> UpdatePosted[Update added to timeline\nFaculty notified by email]

        %% Submit evaluation files
        ProjAction -- "Submit Files (event active)" --> FileModal[Upload Report · PPT · Plagiarism Report\nAt least 1 required]
        FileModal --> FileVal{At least 1 file?}
        FileVal -- No --> FileErr[/"Error: Please upload at least one file"/]
        FileVal -- Yes --> FilesStored[Files stored in project submissions]

        %% View results
        ProjAction -- "View Evaluation Results" --> ResultsView[Mid-term: Guide score · Panel score · Total · Remarks\nEnd-term: all rubric fields · total · remarks\nPer-student feedback · General feedback]

        UpdatePosted --> ProjView
        FilesStored --> ProjView
        ResultsView --> ProjView
        SavedDraft --> ProjView
        Submitted --> ProjView
    end

    %% ── ARCHIVE TAB ───────────────────────────────────────
    subgraph ARCH["Archive Tab (always visible, read-only)"]
        ArchView[View archived projects from previous semesters]
        ArchView --> ArchSource{How matched?}
        ArchSource -- "Live group member ID" --> ArchDirect[Show project with group data]
        ArchSource -- "Email in archivedMembers\nbranch transfer / snapshot import" --> ArchOrphan[Show project via email match\nOriginal batch info shown]
        ArchSource -- "No match" --> ArchEmpty[/"No archived projects found"/]
        ArchDirect --> ArchDetail[Title · Group name · Batch · Mentor\nAll evaluation data — read-only]
        ArchOrphan --> ArchDetail
    end

    %% ── LOGOUT ────────────────────────────────────────────
    Dashboard --> Logout[Click Logout]
    Logout --> End([Session ended — redirect to login])
```
