import { supabase } from './supabase';
import type { Track } from './types';

const BUCKET = 'music';
const MAX_FILE_SIZE_MB = 20;

export async function listTracks(): Promise<Track[]> {
  const { data, error } = await supabase.from('tracks').select('*').order('created_at', { ascending: true });
  if (error) throw error;
  return (data as Track[]) ?? [];
}

export async function uploadTrack(file: File, title: string, artist: string, userId: string): Promise<Track> {
  if (!file.type.startsWith('audio/')) {
    throw new Error('Vui lòng chọn file nhạc (mp3, wav, ogg...)');
  }
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    throw new Error(`File quá lớn (tối đa ${MAX_FILE_SIZE_MB}MB)`);
  }

  const ext = file.name.split('.').pop() || 'mp3';
  const path = `tracks/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'audio/mpeg',
  });
  if (uploadError) throw uploadError;

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);

  const { data, error } = await supabase
    .from('tracks')
    .insert({
      title: title.trim() || file.name.replace(/\.[^/.]+$/, ''),
      artist: artist.trim() || null,
      file_url: pub.publicUrl,
      storage_path: path,
      created_by: userId,
    })
    .select('*')
    .single();

  if (error) {
    // Nếu tạo bản ghi thất bại, dọn lại file đã upload để tránh rác trong storage
    await supabase.storage.from(BUCKET).remove([path]);
    throw error;
  }

  return data as Track;
}

export async function deleteTrack(track: Track): Promise<void> {
  await supabase.storage.from(BUCKET).remove([track.storage_path]);
  const { error } = await supabase.from('tracks').delete().eq('id', track.id);
  if (error) throw error;
}
