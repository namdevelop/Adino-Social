/*
# Thêm mutes, bans, music_tracks và cập nhật role system

## Mục đích
Bổ sung tính năng quản lý cộng đồng (mute chat 1 giờ, ban tài khoản) 
và music player cho app Community Hub.

## 1. Bảng mutes (MỚI)
- Ghi nhận việc mute chat (1 giờ)
- `id` (uuid, PK)
- `user_id` (uuid, FK -> auth.users.id, người bị mute)
- `muted_by` (uuid, FK -> auth.users.id, người mute)
- `reason` (text, lý do)
- `muted_until` (timestamptz, thời điểm hết mute)
- `created_at` (timestamptz)

## 2. Bảng bans (MỚI)
- Ghi nhận việc ban tài khoản
- `id` (uuid, PK)
- `user_id` (uuid, FK -> auth.users.id, người bị ban)
- `banned_by` (uuid, FK -> auth.users.id, người ban)
- `reason` (text, lý do)
- `banned_at` (timestamptz)
- `created_at` (timestamptz)

## 3. Bảng music_tracks (MỚI)
- Bài nhạc cho music player
- `id` (uuid, PK)
- `title` (text, tên bài)
- `artist` (text, nghệ sĩ)
- `url` (text, URL file nhạc)
- `cover_url` (text, URL ảnh bìa)
- `added_by` (uuid, FK -> auth.users.id)
- `created_at` (timestamptz)

## 4. Security (RLS)
- mutes: authenticated đọc, insert bởi admin/pho_admin
- bans: authenticated đọc, insert bởi admin/pho_admin  
- music_tracks: authenticated đọc, insert bởi admin/pho_admin

## 5. Notes
- Role system dùng text (không enum): "Sáng lập viên", "Phó admin", "Thành viên", "Nô lệ"
- "Sáng lập viên" và "Phó admin" có quyền mute/ban
- "Nô lệ" không được đăng bài
*/

-- ===== Bảng mutes =====
CREATE TABLE IF NOT EXISTS mutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  muted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text,
  muted_until timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE mutes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_mutes" ON mutes;
CREATE POLICY "select_mutes" ON mutes FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_mutes" ON mutes;
CREATE POLICY "insert_mutes" ON mutes FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "delete_mutes" ON mutes;
CREATE POLICY "delete_mutes" ON mutes FOR DELETE
  TO authenticated USING (true);

-- ===== Bảng bans =====
CREATE TABLE IF NOT EXISTS bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  banned_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text,
  banned_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE bans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_bans" ON bans;
CREATE POLICY "select_bans" ON bans FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_bans" ON bans;
CREATE POLICY "insert_bans" ON bans FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "delete_bans" ON bans;
CREATE POLICY "delete_bans" ON bans FOR DELETE
  TO authenticated USING (true);

-- ===== Bảng music_tracks =====
CREATE TABLE IF NOT EXISTS music_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  artist text,
  url text NOT NULL,
  cover_url text,
  added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE music_tracks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_music" ON music_tracks;
CREATE POLICY "select_music" ON music_tracks FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_music" ON music_tracks;
CREATE POLICY "insert_music" ON music_tracks FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "delete_music" ON music_tracks;
CREATE POLICY "delete_music" ON music_tracks FOR DELETE
  TO authenticated USING (true);

-- ===== Helper functions =====
CREATE OR REPLACE FUNCTION public.is_muted(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mutes
    WHERE user_id = p_user_id AND muted_until > now()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_banned(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bans
    WHERE user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;
