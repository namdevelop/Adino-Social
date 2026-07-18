import { supabase } from './supabase';
import type { AppSettings } from './types';

function asError(error: unknown, fallback: string): Error {
  if (error instanceof Error) return error;
  const anyErr = error as any;
  const msg = anyErr?.message || anyErr?.error_description || anyErr?.hint || anyErr?.details || fallback;
  return new Error(String(msg));
}

export async function getAppSettings(): Promise<AppSettings | null> {
  const { data, error } = await supabase.from('app_settings').select('*').eq('id', 1).maybeSingle();
  if (error) throw asError(error, 'Không thể tải cài đặt hệ thống');
  return data as AppSettings | null;
}

export async function setMaintenanceMode(enabled: boolean, message: string, userId: string): Promise<AppSettings> {
  const { data, error } = await supabase
    .from('app_settings')
    .update({
      maintenance_mode: enabled,
      maintenance_message: message.trim() || null,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1)
    .select('*')
    .single();
  if (error) throw asError(error, 'Không thể cập nhật chế độ bảo trì');
  return data as AppSettings;
}

export async function updateBankSettings(
  bankBin: string,
  accountNo: string,
  accountName: string,
  userId: string
): Promise<AppSettings> {
  const { data, error } = await supabase
    .from('app_settings')
    .update({
      bank_bin: bankBin.trim() || null,
      bank_account_no: accountNo.trim() || null,
      bank_account_name: accountName.trim() || null,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1)
    .select('*')
    .single();
  if (error) throw asError(error, 'Không thể cập nhật thông tin ngân hàng');
  return data as AppSettings;
}
