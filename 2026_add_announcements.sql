-- ============================================================
-- Migration: Thông báo từ Admin (hiển thị qua chuông thông báo)
-- Chạy trong Supabase SQL Editor
-- ============================================================

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.announcements enable row level security;

-- Ai cũng xem được thông báo
drop policy if exists "announcements_select_all" on public.announcements;
create policy "announcements_select_all"
  on public.announcements for select
  using (true);

-- Chỉ Phó Admin trở lên được đăng thông báo
drop policy if exists "announcements_insert_admins" on public.announcements;
create policy "announcements_insert_admins"
  on public.announcements for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('Phó Admin', 'Admin', 'Sáng lập viên')
    )
  );

-- Chỉ Phó Admin trở lên được xoá thông báo
drop policy if exists "announcements_delete_admins" on public.announcements;
create policy "announcements_delete_admins"
  on public.announcements for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('Phó Admin', 'Admin', 'Sáng lập viên')
    )
  );
