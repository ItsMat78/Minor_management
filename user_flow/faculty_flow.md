# Faculty User Flow

```mermaid
flowchart TD
    Start([Faculty Opens Portal]) --> Login

    %% ── AUTH ──────────────────────────────────────────────
    subgraph AUTH["Authentication"]
        Login[Enter Email + Password]
        Login --> AuthCheck{Credentials valid?}
        AuthCheck -- No --> LoginErr[/"Error: Invalid credentials"/]
        LoginErr --> Login
        AuthCheck -- Yes, unverified --> OTPFlow[OTP sent to email → enter OTP]
        OTPFlow --> OTPOk{OTP valid?}
        OTPOk -- No --> OTPErr[/"Error: Invalid or expired OTP\nResend after 60 s"/]
        OTPErr --> OTPFlow
        OTPOk -- Yes --> MustChange
        AuthCheck -- Yes, verified --> MustChange
        MustChange{mustChangePassword?}
        MustChange -- Yes --> ForceChange[/change-password — old pw + new pw 6+ chars/]
        ForceChange --> PwOk{Valid?}
        PwOk -- No --> PwErr[/"Inline error"/]
        PwErr --> ForceChange
        PwOk -- Yes --> Dashboard
        MustChange -- No --> Dashboard
    end

    %% ── DASHBOARD ─────────────────────────────────────────
    Dashboard([Faculty Dashboard])
    Dashboard --> TabSelect{Which tab?}

    TabSelect -- Proposals --> PROP
    TabSelect -- Mentees --> MENT
    TabSelect -- "Mid-Term (event active)" --> MIDT
    TabSelect -- "End-Term (event active)" --> ENDT
    TabSelect -- "Panels (if assigned)" --> PANEL
    TabSelect -- Archive --> ARCH

    %% ── PROPOSALS TAB ─────────────────────────────────────
    subgraph PROP["Proposals Tab"]
        PropList[List of Pending proposals addressed to this faculty\nShows: Group # · Members · Tags · Date]
        PropList --> DropperBadge{/"Any member is a dropper?\nRed Original Batch label shown"/}
        DropperBadge --> NewUpdateBadge{/"Student posted unread update?\nBlue New Update badge shown"/}
        NewUpdateBadge --> PropAction{Action on proposal?}

        PropAction -- "Open Details" --> PropModal[Full details modal\nTitle · Description · Files · Links]
        PropModal --> PropDecision{Approve or Reject?}

        %% Approve path
        PropDecision -- Approve --> CapacityCheck{Faculty within\nstudent + group limits\nfor this batch?}
        CapacityCheck -- No --> CapErr[/"Error: Student or group limit reached.\nContact admin to increase limit"/]
        CapErr --> PropList
        CapacityCheck -- Yes --> ApproveModal[Optional feedback message]
        ApproveModal --> Approved[Project → Approved\nGroup → Approved\nFaculty load incremented\nEmail to all members]
        Approved --> PropList

        %% Reject path
        PropDecision -- Reject --> RejectModal[Feedback message REQUIRED]
        RejectModal --> FeedbackFilled{Feedback provided?}
        FeedbackFilled -- No --> FeedbackErr[/"Error: Feedback required for rejection"/]
        FeedbackErr --> RejectModal
        FeedbackFilled -- Yes --> Rejected[Project → Rejected\nFaculty load NOT consumed\nEmail to all members]
        Rejected --> PropList
    end

    %% ── MENTEES TAB ───────────────────────────────────────
    subgraph MENT["Mentees Tab"]
        MentList[Cards for each group with Approved project\nGroup # · Title · Members · Status]
        MentList --> MentClick[Click card → full group page]
        MentClick --> MentDetail[Left sidebar: members with photos\nMain: project info + update timeline]

        MentDetail --> MentAction{Action?}

        MentAction -- "Post Faculty Update" --> FacUpdate[Modal: Content required · Links · Files]
        FacUpdate --> FacUpdateVal{Content filled?}
        FacUpdateVal -- No --> FacUpdateErr[/"Error: Content required"/]
        FacUpdateVal -- Yes --> UpdatePosted[Update in timeline tagged Faculty Name\nNo email sent]

        MentAction -- "General Project Feedback" --> GenFeedback[Text area modal]
        GenFeedback --> GenFeedVal{Not empty?}
        GenFeedVal -- No --> GenFeedErr[/"Error: Feedback cannot be empty"/]
        GenFeedVal -- Yes --> GenSaved[Feedback visible to all group members]

        MentAction -- "Per-Student Feedback" --> SelStudent[Select student from group]
        SelStudent --> PerFeed[Enter feedback text]
        PerFeed --> PerSaved[Feedback visible to that student only]

        MentAction -- "Mark Updates Read" --> MarkedRead[Unread badge cleared]

        UpdatePosted --> MentDetail
        GenSaved --> MentDetail
        PerSaved --> MentDetail
        MarkedRead --> MentDetail
    end

    %% ── SHARED EVALUATION SUBGRAPH ────────────────────────
    subgraph EVALFLOW["Evaluation Flow (shared by Mid-Term, End-Term, Panels)"]
        EvalList[List of groups to evaluate\nCheckmark = done · Red button = not evaluated]
        EvalList --> EvalAction{Open group?}
        EvalAction -- "Evaluate (first time) or Edit" --> EvalModal[Evaluation modal]

        EvalModal --> ModeSelect{Input mode?}

        ModeSelect -- "Rubric Mode" --> RubricEntry[Structured fields per event rubric\nMid-term default: Guide 3×5 + Panel 3×5 = 30\nEnd-term default: Guide 5×7 + Panel 4×10 = 70\nTotal auto-calculated\nMax enforced by HTML5 attr — server clamps on save]

        ModeSelect -- "Direct Mode" --> DirectEntry[Single Marks field 0 to maxMarks\nRemarks text area]

        RubricEntry --> AttendStars[Per-student: Attendance toggle\nOptional star rating 0-5]
        DirectEntry --> AttendStars

        AttendStars --> Remarks[Optional remarks text]
        Remarks --> SaveEval{Save Evaluation}

        SaveEval -- "Event still active" --> EvalSaved[Scores stored\nCan re-edit any number of times while event active]
        SaveEval -- "Event ended between opening and saving" --> EventEndErr[/"Server 400: Evaluation event is not active.\nContact admin to re-activate event"/]

        EvalSaved --> EvalList
        EventEndErr --> EvalList
    end

    %% ── MID-TERM TAB ──────────────────────────────────────
    subgraph MIDT["Mid-Term Tab (shown only when Mid-Term event is active)"]
        MidGroups[Groups to evaluate — own mentees]
        MidGroups --> EVALFLOW
    end

    %% ── END-TERM TAB ──────────────────────────────────────
    subgraph ENDT["End-Term Tab (shown only when End-Term event is active)"]
        EndGroups[Groups to evaluate — own mentees]
        EndGroups --> EVALFLOW
    end

    %% ── PANELS TAB ────────────────────────────────────────
    subgraph PANEL["Panels Tab (shown only when assigned to a panel)"]
        PanelInfo[Panel number · Other faculty · Room · Batch]
        PanelInfo --> PanelGroups[Groups assigned to this panel\nNot necessarily own mentees]

        PanelGroups --> PanelAction{Action?}

        PanelAction -- "Evaluate group" --> EVALFLOW
        PanelAction -- "Download Evaluation Template" --> TemplateDown[Pre-filled XLSX with group list + rubric columns]
        PanelAction -- "Upload Filled Template" --> TemplateUp[Select filled XLSX]
        TemplateUp --> TemplatePreview{Valid format?}
        TemplatePreview -- No --> TemplateErr[/"Error: Unrecognised format\nUse downloaded template"/]
        TemplatePreview -- Yes --> TemplateConfirm[Preview scores\nWarning if missing student rows\nServer clamps overflowed marks]
        TemplateConfirm --> TemplateCommit[Scores committed]

        PanelAction -- "Export Final Sheet" --> FinalSheet[Download XLSX\nAll members · marks · grades for this panel]

        BothRoles{/"Edge case: Faculty is both mentor\nand panelist for same group?\nEnter Guide score via Mentees tab\nEnter Panel score via Panels tab\nStored separately — admin config aggregates"/}
        PanelGroups --> BothRoles

        DoublePanelNote{/"Edge case: Group on two panels?\nPanel 1 and Panel 2 scores stored separately\nAdmin config: average or sum"/}
        PanelGroups --> DoublePanelNote
    end

    %% ── ARCHIVE TAB ───────────────────────────────────────
    subgraph ARCH["Archive Tab"]
        ArchList[Archived mentored groups from previous semesters\nTitle · Group name · Batch · Members · Evaluation data]
        ArchList --> ArchNote[/"Read-only — no actions available\nEdge case: faculty email changed after archival\narchivedMentorName is a string snapshot — still shows correctly"/]
    end

    %% ── LOGOUT ────────────────────────────────────────────
    Dashboard --> Logout[Logout]
    Logout --> End([Session ended])
```
