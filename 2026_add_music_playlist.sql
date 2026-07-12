-- ============================================================
-- Migration: Playlist nhạc chung của cộng đồng (upload mp3)
-- Chạy file này trong Supabase SQL Editor SAU khi đã chạy
-- 2026_add_mute_feature.sql
-- ============================================================

-- 1. Bảng lưu danh sách bài hát chung
create table if not exists public.tracks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text,
  file_url text not null,
  storage_path text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.tracks enable row level security;

-- Ai cũng xem/nghe được playlist chung
drop policy if exists "tracks_select_all" on public.tracks;
create policy "tracks_select_all"
  on public.tracks for select
  using (true);

-- Chỉ Phó Admin trở lên được thêm bài hát
drop policy if exists "tracks_insert_admins" on public.tracks;
create policy "tracks_insert_admins"
  on public.tracks for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('Phó Admin', 'Admin', 'Sáng lập viên')
    )
  );

-- Chỉ Phó Admin trở lên được xoá bài hát
drop policy if exists "tracks_delete_admins" on public.tracks;
create policy "tracks_delete_admins"
  on public.tracks for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('Phó Admin', 'Admin', 'Sáng lập viên')
    )
  );

-- 2. Storage bucket để chứa file mp3 (public để phát trực tiếp trên trình duyệt)
insert into storage.buckets (id, name, public)
values ('music', 'music', true)
on conflict (id) do nothing;

-- Ai cũng tải/nghe được file trong bucket "music"
drop policy if exists "music_storage_select_all" on storage.objects;
create policy "music_storage_select_all"
  on storage.objects for select
  using (bucket_id = 'music');

-- Chỉ Phó Admin trở lên được tải file mp3 lên
drop policy if exists "music_storage_insert_admins" on storage.objects;
create policy "music_storage_insert_admins"
  on storage.objects for insert
  with check (
    bucket_id = 'music'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('Phó Admin', 'Admin', 'Sáng lập viên')
    )
  );

-- Chỉ Phó Admin trở lên được xoá file mp3
drop policy if exists "music_storage_delete_admins" on storage.objects;
create policy "music_storage_delete_admins"
  on storage.objects for delete
  using (
    bucket_id = 'music'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('Phó Admin', 'Admin', 'Sáng lập viên')
    )
  );

-- Lưu ý:
-- * Nếu Supabase project của bạn giới hạn dung lượng file upload mặc định
--   (thường 50MB), vào Storage > bucket "music" > Settings để chỉnh nếu cần.
-- * Nếu đã có policy trùng tên "tracks_select_all"/"music_storage_select_all"...
--   từ trước, các dòng "drop policy if exists" phía trên sẽ tự dọn trước khi tạo lại.
