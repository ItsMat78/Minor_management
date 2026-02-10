# Supabase Integration Guide

Follow these steps to connect your application to a live Supabase database.

## 1. Create a Supabase Project
1.  Go to [database.new](https://database.new) and sign in with GitHub.
2.  Create a new project (e.g., "Student Group Allocator").
3.  Set a database password (save it somewhere safe) and choose a region close to you.
4.  Wait for the project to finish setting up (takes ~1-2 minutes).

## 2. Set Up the Database Schema
1.  In your Supabase project dashboard, go to the **SQL Editor** (icon on the left sidebar).
2.  Click **New Query**.
3.  Copy the entire content of the file `supabase/schema.sql` from your project folder.
4.  Paste it into the SQL Editor in Supabase.
5.  Click **Run** (bottom right).
    *   *Success:* You should see "Success" or "No rows returned" in the results.

## 3. Get API Credentials
1.  Go to **Project Settings** (gear icon at the bottom left).
2.  Click on **API**.
3.  Find the **Project URL** and **anon public** key.

## 4. Connect Application
1.  In your VS Code logic (this project), find the file named `.env.local`.
2.  Replace the placeholder values with your actual keys:

    ```env
    NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your-long-anon-key-string
    ```

3.  Save the file.

## 5. Restart Development Server
1.  Stop the current server (Ctrl+C in terminal).
2.  Run `npm run dev` again.
3.  Refresh your browser at `http://localhost:3000`.

## 6. Create Your First Account
1.  Go to Sign Up.
2.  Create an account.
3.  By default, all new users are **Students**.
4.  To test **Faculty** or **Admin** features:
    *   Go to **Table Editor** > `profiles` table in Supabase dashboard.
    *   Find your user row.
    *   Change the `role` column from `student` to `faculty` or `admin`.
