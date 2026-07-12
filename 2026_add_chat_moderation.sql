-- ============================================================
-- Migration: Cho phép Phó Admin trở lên xoá tin nhắn của người khác
-- (phục vụ chức năng "Xoá toàn bộ" / "Xoá tin nhắn trước mốc thời gian"
-- trong Bảng quản trị). Chạy trong Supabase SQL Editor.
-- ============================================================

-- Nếu bảng chat_messages hiện chỉ cho phép chủ tin nhắn tự xoá tin của mình,
-- policy này bổ sung thêm quyền: Phó Admin/Admin/Sáng lập viên xoá được
-- BẤT KỲ tin nhắn nào (các policy DELETE trong Postgres RLS được gộp bằng OR,
-- nên quyền tự xoá tin của người dùng thường vẫn giữ nguyên).

drop policy if exists "chat_messages_delete_admins" on public.chat_messages;
create policy "chat_messages_delete_admins"
  on public.chat_messages for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('Phó Admin', 'Admin', 'Sáng lập viên')
    )
  );
