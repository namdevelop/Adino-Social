-- ============================================
-- SCHEMA TỔNG HỢP - CỘNG ĐỒNG XÃ HỘI
-- ============================================

-- =====================
-- BẢNG: profiles
-- =====================
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  role text NOT NULL DEFAULT 'Thành viên',
  avatar_url text,
  bio text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_all" ON profiles FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  TO authenticated WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Admin/Phó Admin có thể sửa profile người khác (đổi role)
CREATE POLICY "profiles_update_admin" ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = ANY (ARRAY['Admin', 'Phó Admin'])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = ANY (ARRAY['Admin', 'Phó Admin'])
    )
  );

-- =====================
-- BẢNG: posts
-- =====================
CREATE TABLE posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  content text NOT NULL,
  image_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "posts_select_all" ON posts FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "posts_insert_own" ON posts FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "posts_update_own" ON posts FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "posts_delete_own" ON posts FOR DELETE
  TO authenticated USING (user_id = auth.uid());

-- Admin/Phó Admin có thể xóa bài bất kỳ
CREATE POLICY "posts_delete_admin" ON posts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = ANY (ARRAY['Admin', 'Phó Admin'])
    )
  );

-- =====================
-- BẢNG: comments
-- =====================
CREATE TABLE comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comments_select_all" ON comments FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "comments_insert_own" ON comments FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "comments_delete_own" ON comments FOR DELETE
  TO authenticated USING (user_id = auth.uid());

-- Admin/Phó Admin có thể xóa comment bất kỳ
CREATE POLICY "comments_delete_admin" ON comments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = ANY (ARRAY['Admin', 'Phó Admin'])
    )
  );

-- =====================
-- BẢNG: likes
-- =====================
CREATE TABLE likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "likes_select_all" ON likes FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "likes_insert_own" ON likes FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "likes_delete_own" ON likes FOR DELETE
  TO authenticated USING (user_id = auth.uid());

-- =====================
-- BẢNG: chat_messages
-- =====================
CREATE TABLE chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  recipient_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  room_type text DEFAULT 'global' CHECK (room_type = ANY (ARRAY['global', 'direct'])),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Xem tin global hoặc tin nhắn riêng của mình
CREATE POLICY "chat_select_global" ON chat_messages FOR SELECT
  TO authenticated
  USING (
    room_type = 'global'
    OR (room_type = 'direct' AND (sender_id = auth.uid() OR recipient_id = auth.uid()))
  );

CREATE POLICY "chat_insert_own" ON chat_messages FOR INSERT
  TO authenticated WITH CHECK (sender_id = auth.uid());

CREATE POLICY "chat_delete_own" ON chat_messages FOR DELETE
  TO authenticated USING (sender_id = auth.uid());

-- =====================
-- BẢNG: chat_read_state
-- =====================
CREATE TABLE chat_read_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  room_type text NOT NULL,
  room_key text NOT NULL,
  last_read_at timestamptz DEFAULT now()
);

ALTER TABLE chat_read_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_state_select_own" ON chat_read_state FOR SELECT
  TO authenticated USING (user_id = auth.uid());

CREATE POLICY "read_state_insert_own" ON chat_read_state FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "read_state_update_own" ON chat_read_state FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
