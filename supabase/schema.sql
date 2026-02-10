-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create profiles table
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  full_name text,
  role text check (role in ('student', 'faculty', 'admin')) not null,
  department text,
  faculty_limit int default 5,
  created_at timestamptz default now()
);

-- Create projects table
create table public.projects (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  faculty_id uuid references public.profiles(id),
  status text check (status in ('pending', 'approved', 'rejected')) default 'pending',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create project_members table
create table public.project_members (
  project_id uuid references public.projects(id) on delete cascade,
  student_id uuid references public.profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (project_id, student_id)
);

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;

-- Policies
create policy "Public profiles are viewable by everyone." on public.profiles for select using (true);
create policy "Users can insert their own profile." on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile." on public.profiles for update using (auth.uid() = id);

create policy "Projects are viewable by everyone." on public.projects for select using (true);
create policy "Authenticated users can create projects." on public.projects for insert with check (auth.role() = 'authenticated');
create policy "Faculty can update their projects." on public.projects for update using (auth.uid() = faculty_id);

create policy "Members are viewable by everyone." on public.project_members for select using (true);
create policy "Students can join projects." on public.project_members for insert with check (auth.uid() = student_id);

-- Function to handle new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role, department)
  values (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    coalesce(new.raw_user_meta_data->>'role', 'student'), -- Default to student if not specified
    new.raw_user_meta_data->>'department'
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- RPC: Approve Project (Atomic Check)
create or replace function approve_project(project_id_arg uuid)
returns void as $$
declare
  tgt_faculty_id uuid;
  current_count int;
  limit_count int;
begin
  -- Get the faculty_id for the project
  select faculty_id into tgt_faculty_id from public.projects where id = project_id_arg;
  
  if tgt_faculty_id is null then
    raise exception 'Project not found or has no faculty assigned';
  end if;

  -- Check if the executing user is the faculty member (Security check)
  if auth.uid() != tgt_faculty_id then
    raise exception 'Not authorized to approve this project';
  end if;

  -- Get limit
  select faculty_limit into limit_count from public.profiles where id = tgt_faculty_id;

  -- Count currently approved projects
  select count(*) into current_count from public.projects 
  where faculty_id = tgt_faculty_id and status = 'approved';

  if current_count >= limit_count then
    raise exception 'Faculty limit reached (%/%)', current_count, limit_count;
  end if;

  -- Approve the project
  update public.projects 
  set status = 'approved', updated_at = now()
  where id = project_id_arg;
end;
$$ language plpgsql;

-- Create system_settings table
create table public.system_settings (
  id int primary key default 1,
  submission_deadline timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint single_row check (id = 1)
);

-- Insert default row
insert into public.system_settings (id, submission_deadline)
values (1, now() + interval '30 days')
on conflict (id) do nothing;

-- Enable RLS
alter table public.system_settings enable row level security;

-- Policies
create policy "Settings are viewable by everyone." on public.system_settings for select using (true);
-- Note: 'admin' role check depends on your auth implementation. Here we assume 'admin' role in profiles table.
-- Using a subquery to check if the user is an admin in the profiles table.
create policy "Admins can update settings." on public.system_settings for update using (
  auth.role() = 'authenticated' and 
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
