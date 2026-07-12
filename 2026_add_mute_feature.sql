-- ============================================================
-- Migration: Thêm tính năng "Cấm chat" (mute)
-- Chạy file này trong Supabase SQL Editor
-- ============================================================

-- 1. Thêm cột muted_until vào bảng profiles
alter table public.profiles
  add column if not exists muted_until timestamptz null;

-- 2. (Khuyến nghị) Đảm bảo RLS cho phép Phó Admin trở lên UPDATE
--    cột muted_until / role của người dùng KHÁC. Nếu bảng profiles của
--    bạn đã có policy cho phép Admin/Phó Admin sửa role người khác
--    (vì tính năng đổi cấp bậc trong AdminPage đã hoạt động từ trước),
--    thì policy đó thường cũng sẽ cho phép cập nhật muted_until.
--    Nếu chưa có, có thể tạo policy mẫu bên dưới (điều chỉnh theo
--    policy hiện tại của bạn để tránh trùng/xung đột):
--
-- create policy "moderators_can_update_other_profiles"
--   on public.profiles
--   for update
--   using (
--     exists (
--       select 1 from public.profiles p
--       where p.id = auth.uid()
--         and p.role in ('Phó Admin', 'Admin', 'Sáng lập viên')
--     )
--   );

-- 3. (Tuỳ chọn) Index để tra cứu nhanh người đang bị mute
create index if not exists idx_profiles_muted_until
  on public.profiles (muted_until)
  where muted_until is not null;
