import { supabase } from './supabase';
import type { Task, TaskCompletion } from './types';

function asError(error: unknown, fallback: string): Error {
  if (error instanceof Error) return error;
  const anyErr = error as any;
  const msg = anyErr?.message || anyErr?.error_description || anyErr?.hint || anyErr?.details || fallback;
  return new Error(String(msg));
}

export async function listActiveTasks(): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: false });
  if (error) throw asError(error, 'Không thể tải danh sách nhiệm vụ');
  return (data as Task[]) ?? [];
}

export async function listAllTasksAdmin(): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw asError(error, 'Không thể tải danh sách nhiệm vụ');
  return (data as Task[]) ?? [];
}

export async function listMyCompletions(userId: string): Promise<TaskCompletion[]> {
  const { data, error } = await supabase
    .from('task_completions')
    .select('*')
    .eq('user_id', userId);
  if (error) throw asError(error, 'Không thể tải nhiệm vụ đã hoàn thành');
  return (data as TaskCompletion[]) ?? [];
}

export async function claimTaskReward(taskId: string) {
  const { data, error } = await supabase.rpc('claim_task_reward', { p_task_id: taskId });
  if (error) throw asError(error, 'Không thể nhận thưởng nhiệm vụ');
  return data;
}

export async function createTask(opts: { title: string; description: string; link: string; rewardCoin: number }): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .insert({ title: opts.title, description: opts.description || null, link: opts.link, reward_coin: opts.rewardCoin })
    .select('*')
    .single();
  if (error) throw asError(error, 'Không thể tạo nhiệm vụ');
  return data as Task;
}

export async function updateTask(id: string, patch: Partial<Pick<Task, 'title' | 'description' | 'link' | 'reward_coin' | 'active'>>): Promise<Task> {
  const { data, error } = await supabase.from('tasks').update(patch).eq('id', id).select('*').single();
  if (error) throw asError(error, 'Không thể cập nhật nhiệm vụ');
  return data as Task;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) throw asError(error, 'Không thể xoá nhiệm vụ');
}
