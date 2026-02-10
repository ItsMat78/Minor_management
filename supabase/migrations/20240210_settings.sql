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
create policy "Admins can update settings." on public.system_settings for update using (auth.role() = 'authenticated' and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
