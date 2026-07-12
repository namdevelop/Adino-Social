import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { canManageUsers } from '../lib/roles';
import { listTracks, uploadTrack, deleteTrack } from '../lib/tracks';
import type { Track } from '../lib/types';
import {
  Play, Pause, SkipBack, SkipForward, Music2, ChevronDown, Volume2, VolumeX,
  Plus, Trash2, Loader2, ListMusic, X, UploadCloud, AlertCircle,
} from 'lucide-react';

const BAR_COUNT = 26;

export default function MusicWidget() {
  const { profile } = useAuth();
  const canManage = !!profile && canManageUsers(profile.role);

  const [tracks, setTracks] = useState<Track[]>([]);
  const [tracksLoaded, setTracksLoaded] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [bars, setBars] = useState<number[]>(() => Array(BAR_COUNT).fill(4));
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadArtist, setUploadArtist] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const currentIndex = tracks.findIndex((t) => t.id === currentId);
  const track = currentIndex >= 0 ? tracks[currentIndex] : tracks[0] ?? null;

  // Tải playlist chung + lắng nghe realtime để mọi người thấy cùng danh sách
  useEffect(() => {
    let active = true;
    listTracks()
      .then((data) => {
        if (!active) return;
        setTracks(data);
        setTracksLoaded(true);
        if (!currentId && data.length > 0) setCurrentId(data[0].id);
      })
      .catch(() => setTracksLoaded(true));

    const channel = supabase
      .channel('tracks-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tracks' }, (payload) => {
        const t = payload.new as Track;
        setTracks((prev) => (prev.some((p) => p.id === t.id) ? prev : [...prev, t]));
        setCurrentId((prevId) => prevId ?? t.id);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tracks' }, (payload) => {
        const removedId = (payload.old as Track).id;
        setTracks((prev) => prev.filter((p) => p.id !== removedId));
        setCurrentId((prevId) => (prevId === removedId ? null : prevId));
      })
      .subscribe();

    return () => { active = false; supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Nếu bài đang phát bị xoá, tự chuyển sang bài đầu tiên còn lại (hoặc dừng nếu hết bài)
  useEffect(() => {
    if (!tracksLoaded) return;
    if (!currentId && tracks.length > 0) {
      setCurrentId(tracks[0].id);
    } else if (currentId && !tracks.some((t) => t.id === currentId)) {
      setIsPlaying(false);
      setCurrentId(tracks[0]?.id ?? null);
    }
  }, [tracks, currentId, tracksLoaded]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onLoaded = () => setDuration(audio.duration || 0);
    const onEnded = () => nextTrack();
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('ended', onEnded);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId]);

  const ensureAudioGraph = () => {
    const audio = audioRef.current;
    if (!audio || sourceRef.current) return;
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      const source = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      sourceRef.current = source;
    } catch {
      // fallback: hiệu ứng giả lập nếu không dựng được Web Audio graph
    }
  };

  const drawLoop = () => {
    const analyser = analyserRef.current;
    if (analyser) {
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      const step = Math.max(1, Math.floor(data.length / BAR_COUNT));
      const next: number[] = [];
      for (let i = 0; i < BAR_COUNT; i++) next.push(4 + ((data[i * step] ?? 0) / 255) * 28);
      setBars(next);
    } else {
      setBars((prev) => prev.map(() => 4 + Math.random() * 26));
    }
    rafRef.current = requestAnimationFrame(drawLoop);
  };

  useEffect(() => {
    if (isPlaying) {
      rafRef.current = requestAnimationFrame(drawLoop);
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setBars((prev) => prev.map(() => 4));
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio || !track) return;
    ensureAudioGraph();
    if (audioCtxRef.current?.state === 'suspended') await audioCtxRef.current.resume();
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
    }
  };

  const playTrack = (id: string) => {
    setCurrentId(id);
    setCurrentTime(0);
    requestAnimationFrame(() => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = 0;
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    });
  };

  const step = (dir: 1 | -1) => {
    if (tracks.length === 0) return;
    const idx = currentIndex >= 0 ? currentIndex : 0;
    const nextIdx = (idx + dir + tracks.length) % tracks.length;
    const nextT = tracks[nextIdx];
    setCurrentId(nextT.id);
    setCurrentTime(0);
    requestAnimationFrame(() => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = 0;
      if (isPlaying) audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    });
  };

  const nextTrack = useCallback(() => step(1), [tracks, currentIndex, isPlaying]);
  const prevTrack = () => step(-1);

  const onSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const val = Number(e.target.value);
    audio.currentTime = val;
    setCurrentTime(val);
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !audio.muted;
    setIsMuted(audio.muted);
  };

  const fmt = (s: number) => {
    if (!isFinite(s) || s < 0) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  const handleUpload = async () => {
    if (!uploadFile || !profile || uploading) return;
    setUploading(true);
    setUploadError('');
    try {
      await uploadTrack(uploadFile, uploadTitle, uploadArtist, profile.id);
      setUploadTitle('');
      setUploadArtist('');
      setUploadFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setShowUpload(false);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Tải lên thất bại');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (t: Track) => {
    try {
      await deleteTrack(t);
    } catch {
      // đã có realtime dọn danh sách khi thành công; im lặng bỏ qua lỗi nhỏ ở đây
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[60] select-none">
      {track && <audio ref={audioRef} src={track.file_url} crossOrigin="anonymous" preload="metadata" />}

      {collapsed ? (
        <button
          onClick={() => setCollapsed(false)}
          className="w-14 h-14 rounded-full anime-card flex items-center justify-center anime-glow-pink hover:scale-105 transition-transform"
          title="Mở trình phát nhạc"
        >
          <div className={`w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 via-fuchsia-500 to-cyan-400 flex items-center justify-center ${isPlaying ? 'vinyl-spin' : ''}`}>
            <Music2 className="w-4 h-4 text-white" />
          </div>
        </button>
      ) : (
        <div className="w-80 anime-card rounded-2xl p-4 shadow-2xl animate-in fade-in">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Music2 className="w-3.5 h-3.5" /> Nhạc cộng đồng
            </span>
            <div className="flex items-center gap-1">
              {canManage && (
                <button onClick={() => { setShowUpload((v) => !v); setShowPlaylist(false); }} className="text-slate-400 hover:text-pink-500 transition-colors p-1" title="Thêm nhạc">
                  <Plus className="w-4 h-4" />
                </button>
              )}
              <button onClick={() => { setShowPlaylist((v) => !v); setShowUpload(false); }} className="text-slate-400 hover:text-pink-500 transition-colors p-1" title="Danh sách phát">
                <ListMusic className="w-4 h-4" />
              </button>
              <button onClick={() => setCollapsed(true)} className="text-slate-400 hover:text-pink-500 transition-colors p-1" title="Thu nhỏ">
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {showUpload && canManage ? (
            <div className="space-y-2.5 animate-in fade-in mb-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-fuchsia-200/60">Thêm bài hát mới</span>
                <button onClick={() => setShowUpload(false)} className="text-slate-400 hover:text-rose-400"><X className="w-3.5 h-3.5" /></button>
              </div>
              <input
                type="file" accept="audio/*" ref={fileInputRef}
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                className="w-full text-xs text-slate-500 dark:text-fuchsia-200/60 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-pink-100 file:text-pink-700 dark:file:bg-pink-500/20 dark:file:text-pink-300 cursor-pointer"
              />
              <input value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} placeholder="Tên bài hát (tuỳ chọn)"
                className="w-full px-3 py-2 rounded-lg bg-white/60 dark:bg-white/5 border border-pink-200 dark:border-fuchsia-500/20 text-xs text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:border-pink-500" />
              <input value={uploadArtist} onChange={(e) => setUploadArtist(e.target.value)} placeholder="Ca sĩ / nguồn (tuỳ chọn)"
                className="w-full px-3 py-2 rounded-lg bg-white/60 dark:bg-white/5 border border-pink-200 dark:border-fuchsia-500/20 text-xs text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:border-pink-500" />
              {uploadError && (
                <div className="flex items-center gap-1.5 text-[11px] text-rose-500 dark:text-rose-400">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {uploadError}
                </div>
              )}
              <button onClick={handleUpload} disabled={!uploadFile || uploading}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg anime-btn-primary text-xs font-semibold disabled:opacity-50">
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                {uploading ? 'Đang tải lên...' : 'Tải lên cho cả cộng đồng'}
              </button>
            </div>
          ) : showPlaylist ? (
            <div className="max-h-56 overflow-y-auto space-y-1 mb-1">
              {tracks.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">Chưa có bài hát nào trong playlist.</p>
              ) : tracks.map((t) => (
                <div key={t.id}
                  className={`group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${t.id === currentId ? 'bg-pink-100/70 dark:bg-white/10' : 'hover:bg-pink-50 dark:hover:bg-white/5'}`}
                  onClick={() => playTrack(t.id)}>
                  <div className={`w-6 h-6 rounded-full shrink-0 bg-gradient-to-br from-pink-500 via-fuchsia-500 to-cyan-400 flex items-center justify-center ${t.id === currentId && isPlaying ? 'vinyl-spin' : ''}`}>
                    <Music2 className="w-3 h-3 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-800 dark:text-white truncate">{t.title}</p>
                    {t.artist && <p className="text-[10px] text-slate-400 truncate">{t.artist}</p>}
                  </div>
                  {canManage && (
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(t); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-rose-400 p-1 shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : null}

          {!showUpload && !showPlaylist && (
            <>
              {!track ? (
                <div className="py-6 text-center">
                  <Music2 className="w-8 h-8 text-pink-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">
                    {canManage ? 'Chưa có bài hát nào — bấm nút + để thêm.' : 'Chưa có bài hát nào trong playlist.'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <div className={`w-14 h-14 rounded-full shrink-0 bg-gradient-to-br from-pink-500 via-fuchsia-500 to-cyan-400 flex items-center justify-center ring-2 ring-pink-300/50 dark:ring-fuchsia-500/40 ${isPlaying ? 'vinyl-spin' : ''}`}>
                      <div className="w-4 h-4 rounded-full bg-white/90 dark:bg-slate-900/80" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{track.title}</p>
                      <p className="text-xs text-slate-400 truncate">{track.artist || 'Không rõ'}</p>
                    </div>
                  </div>

                  <div className="mt-3">
                    <input
                      type="range" min={0} max={duration || 0} step={0.1} value={Math.min(currentTime, duration || 0)}
                      onChange={onSeek}
                      className="w-full h-1.5 rounded-full appearance-none bg-pink-100 dark:bg-white/10 accent-pink-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                      <span>{fmt(currentTime)}</span>
                      <span>{fmt(duration)}</span>
                    </div>
                  </div>

                  <div className="flex items-end justify-center gap-[3px] h-8 my-2">
                    {bars.map((h, i) => (
                      <div key={i} className="w-1 rounded-full bg-gradient-to-t from-pink-500 via-fuchsia-500 to-cyan-400 transition-all duration-100" style={{ height: `${h}px` }} />
                    ))}
                  </div>

                  <div className="flex items-center justify-center gap-4">
                    <button onClick={prevTrack} className="text-slate-500 dark:text-fuchsia-200/60 hover:text-pink-500 transition-colors" title="Bài trước">
                      <SkipBack className="w-5 h-5" />
                    </button>
                    <button onClick={togglePlay} className="w-10 h-10 rounded-full anime-btn-primary flex items-center justify-center" title={isPlaying ? 'Tạm dừng' : 'Phát'}>
                      {isPlaying ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white ml-0.5" />}
                    </button>
                    <button onClick={nextTrack} className="text-slate-500 dark:text-fuchsia-200/60 hover:text-pink-500 transition-colors" title="Bài tiếp theo">
                      <SkipForward className="w-5 h-5" />
                    </button>
                    <button onClick={toggleMute} className="text-slate-400 hover:text-pink-500 transition-colors ml-1" title={isMuted ? 'Bật tiếng' : 'Tắt tiếng'}>
                      {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
