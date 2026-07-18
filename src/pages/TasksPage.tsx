import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../lib/auth';
import { listActiveTasks, listMyCompletions, claimTaskReward } from '../lib/tasks';
import type { Task, TaskCompletion } from '../lib/types';
import { ListChecks, Loader2, ExternalLink, Coins, CheckCircle2, Sparkles } from 'lucide-react';

export default function TasksPage() {
  const { profile, refreshProfile } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completions, setCompletions] = useState<TaskCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [clickedIds, setClickedIds] = useState<Set<string>>(new Set());
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const loadAll = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const [t, c] = await Promise.all([listActiveTasks(), listMyCompletions(profile.id)]);
      setTasks(t);
      setCompletions(c);
    } catch {
      // im lặng
    }
    setLoading(false);
  }, [profile]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const openTaskLink = (task: Task) => {
    window.open(task.link, '_blank', 'noopener,noreferrer');
    setClickedIds((prev) => new Set(prev).add(task.id));
  };

  const handleClaim = async (task: Task) => {
    if (claimingId) return;
    setClaimingId(task.id);
    setMsg('');
    try {
      await claimTaskReward(task.id);
      await refreshProfile();
      await loadAll();
      setMsg(`Đã nhận +${task.reward_coin} coin từ nhiệm vụ "${task.title}"!`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Không thể nhận thưởng');
    } finally {
      setClaimingId(null);
    }
  };

  if (!profile) return null;

  const completedTaskIds = new Set(completions.map((c) => c.task_id));

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl anime-btn-primary flex items-center justify-center anime-glow-pink">
          <ListChecks className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold anime-text-gradient">Nhiệm vụ</h1>
          <p className="text-slate-400 text-sm">Hoàn thành nhiệm vụ để nhận coin miễn phí</p>
        </div>
      </div>

      {msg && (
        <div className="mb-4 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 px-4 py-2.5 text-cyan-700 dark:text-cyan-300 text-sm flex items-center gap-2">
          {msg}
          <button onClick={() => setMsg('')} className="ml-auto text-cyan-400 hover:text-cyan-600">×</button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-pink-500" /></div>
      ) : tasks.length === 0 ? (
        <div className="anime-card rounded-2xl p-12 text-center">
          <Sparkles className="w-12 h-12 text-pink-300 mx-auto mb-4" />
          <p className="text-slate-400">Hiện chưa có nhiệm vụ nào.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const done = completedTaskIds.has(task.id);
            const clicked = clickedIds.has(task.id);
            const claiming = claimingId === task.id;
            return (
              <div key={task.id} className={`anime-card rounded-2xl p-5 ${done ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-[180px]">
                    <p className="font-semibold text-slate-800 dark:text-white">{task.title}</p>
                    {task.description && <p className="text-sm text-slate-500 dark:text-fuchsia-200/60 mt-1">{task.description}</p>}
                    <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-2">
                      <Coins className="w-3.5 h-3.5" /> Thưởng {task.reward_coin.toLocaleString('vi-VN')} coin
                    </p>
                  </div>

                  {done ? (
                    <span className="shrink-0 flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 font-semibold">
                      <CheckCircle2 className="w-4 h-4" /> Đã nhận
                    </span>
                  ) : (
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => openTaskLink(task)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl anime-card text-pink-500 hover:text-pink-600 text-xs font-semibold">
                        <ExternalLink className="w-3.5 h-3.5" /> Đi tới nhiệm vụ
                      </button>
                      <button onClick={() => handleClaim(task)} disabled={!clicked || claiming}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl anime-btn-primary text-xs font-semibold disabled:opacity-40">
                        {claiming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Coins className="w-3.5 h-3.5" />}
                        Nhận {task.reward_coin} coin
                      </button>
                    </div>
                  )}
                </div>
                {!done && !clicked && (
                  <p className="text-[11px] text-slate-400 mt-2">Bấm "Đi tới nhiệm vụ" trước để mở khoá nút nhận thưởng.</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
