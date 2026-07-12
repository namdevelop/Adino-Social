import { supabase } from './supabase';
import type { Announcement } from './types';

function asError(error: unknown, fallback: string): Error {
  if (error instanceof Error) return error;
  const anyErr = error as any;
  const msg = anyErr?.message || anyErr?.error_description || anyErr?.hint || anyErr?.details || fallback;
  return new Error(String(msg));
}

export async function listAnnouncements(limit = 50): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw asError(error, 'Không thể tải danh sách thông báo');
  return (data as Announcement[]) ?? [];
}

export async function createAnnouncement(title: string, content: string, userId: string): Promise<Announcement> {
  const { data, error } = await supabase
    .from('announcements')
    .insert({ title: title.trim(), content: content.trim(), created_by: userId })
    .select('*')
    .single();
  if (error) throw asError(error, 'Không thể đăng thông báo');
  return data as Announcement;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const { error } = await supabase.from('announcements').delete().eq('id', id);
  if (error) throw asError(error, 'Không thể xoá thông báo');
}
