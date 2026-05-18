# IIITNR Minor Project Management Portal

This is a web-based application for managing minor projects at IIIT Naya Raipur. It includes features for students, faculty, and administrators to streamline project proposals, group formation, and evaluations.
  
## Prerequisites

- [Node.js](https://nodejs.org/) installed
- [MongoDB](https://www.mongodb.com/) installed and running

## Getting Started

To run the application locally, follow these steps:

### 1. Start the Database
The application requires a running MongoDB instance.

- **Option A (Easy)**: Double-click the `start_db.bat` file located in the project root folder.
- **Option B (Manual)**: Run the following command in a terminal:
  ```bash
  "C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe" --config "C:\Program Files\MongoDB\Server\8.2\bin\mongod.cfg"
  ```

### 2. Start the Application
Open a terminal in the project root directory (`e:\Projects\Minor_management`) and run:

```bash
npm run dev
```

This command will start both the backend server (on port 5000) and the frontend client (on port 5173).

## Features

- **Students**: form groups, submit project proposals.
- **Faculty**: review proposals, mentor students.
- **Admin**: manage users, oversee project cycles.
