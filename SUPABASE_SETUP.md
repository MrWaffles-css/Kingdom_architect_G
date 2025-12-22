# Supabase Setup Guide

Follow these steps to set up the backend for your game.

## 1. Create a Supabase Project
1.  Go to [supabase.com](https://supabase.com) and Sign In (or Sign Up).
2.  Click **"New Project"**.
3.  Choose your Organization.
4.  **Name**: `Kingdom Architect` (or your preferred name).
5.  **Password**: Generate a strong password and save it.
6.  **Region**: Choose a region close to you (e.g., US East, EU Central).
7.  Click **"Create new project"**.
8.  Wait a minute for the project to initialize.

## 2. Get API Keys
1.  Once the project is ready, go to **Project Settings** (gear icon at the bottom left).
2.  Click on **API**.
3.  Look for the **Project URL** and **Project API keys**.
4.  Copy the **URL**.
5.  Copy the **`anon`** `public` key.
    > **WARNING**: Never share the `service_role` key.

## 3. Create Database Tables
1.  Go to the **SQL Editor** (icon on the left sidebar that looks like a terminal `>_`).
2.  Click **"New Query"**.
3.  Copy and paste the following SQL code into the editor:

```sql
-- Create a table for user profiles
create table profiles (
  id uuid references auth.users not null primary key,
  username text unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (Security Policy)
alter table profiles enable row level security;

-- Allow users to view their own profile
create policy "Users can view own profile" on profiles
  for select using (auth.uid() = id);

-- Allow users to update their own profile
create policy "Users can update own profile" on profiles
  for update using (auth.uid() = id);

## 5. (Optional) Auto-Create Profile Trigger
To automatically save the **Username** when a user signs up, run this SQL:

```sql
-- Function to handle new user creation
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data ->> 'username');
  return new;
end;
$$;

-- Trigger to call the function on sign up
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

## 6. Phase 1: Add Game Stats
Now that Auth is working, run this SQL to add the game columns to your `profiles` table:

```sql
alter table profiles 
add column gold bigint default 1000,
add column turns int default 100,
add column soldiers int default 0,
add column grid_size int default 10;
```
```

4.  Click **"Run"** (bottom right).

## 4. Connect to Your Code
I will need the **Project URL** and **`anon` Key** to connect your game.
