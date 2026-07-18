import { supabase } from './supabase';
import type { CoinPackage, TopupOrder, RolePrice, Profile } from './types';

function asError(error: unknown, fallback: string): Error {
  if (error instanceof Error) return error;
  const anyErr = error as any;
  const msg = anyErr?.message || anyErr?.error_description || anyErr?.hint || anyErr?.details || fallback;
  return new Error(String(msg));
}

// Tạo mã nội dung chuyển khoản duy nhất từ id đơn hàng, dùng để đối chiếu
// khi admin xác nhận đã nhận tiền.
export function orderMemo(orderId: string): string {
  return 'NAP' + orderId.replace(/-/g, '').slice(0, 8).toUpperCase();
}

export function buildVietQrUrl(opts: {
  bankBin: string;
  accountNo: string;
  accountName: string;
  amount: number;
  memo: string;
}): string {
  const { bankBin, accountNo, accountName, amount, memo } = opts;
  const params = new URLSearchParams({
    amount: String(amount),
    addInfo: memo,
    accountName,
  });
  return `https://img.vietqr.io/image/${bankBin}-${accountNo}-compact2.png?${params.toString()}`;
}

// ---------- Coin packages ----------
export async function listCoinPackages(activeOnly = true): Promise<CoinPackage[]> {
  let query = supabase.from('coin_packages').select('*').order('sort_order', { ascending: true });
  if (activeOnly) query = query.eq('active', true);
  const { data, error } = await query;
  if (error) throw asError(error, 'Không thể tải danh sách gói nạp');
  return (data as CoinPackage[]) ?? [];
}

export async function createCoinPackage(pkg: { name: string; amount_vnd: number; coins: number; sort_order?: number }): Promise<CoinPackage> {
  const { data, error } = await supabase.from('coin_packages').insert(pkg).select('*').single();
  if (error) throw asError(error, 'Không thể tạo gói nạp');
  return data as CoinPackage;
}

export async function updateCoinPackage(id: string, patch: Partial<Pick<CoinPackage, 'name' | 'amount_vnd' | 'coins' | 'active' | 'sort_order'>>): Promise<CoinPackage> {
  const { data, error } = await supabase.from('coin_packages').update(patch).eq('id', id).select('*').single();
  if (error) throw asError(error, 'Không thể cập nhật gói nạp');
  return data as CoinPackage;
}

export async function deleteCoinPackage(id: string): Promise<void> {
  const { error } = await supabase.from('coin_packages').delete().eq('id', id);
  if (error) throw asError(error, 'Không thể xoá gói nạp');
}

// ---------- Top-up orders ----------
export async function createTopupOrder(pkg: CoinPackage, userId: string): Promise<TopupOrder> {
  const { data, error } = await supabase
    .from('topup_orders')
    .insert({
      user_id: userId,
      package_id: pkg.id,
      amount_vnd: pkg.amount_vnd,
      coins: pkg.coins,
      status: 'pending',
    })
    .select('*')
    .single();
  if (error) throw asError(error, 'Không thể tạo đơn nạp tiền');
  return data as TopupOrder;
}

export async function listMyOrders(userId: string): Promise<TopupOrder[]> {
  const { data, error } = await supabase
    .from('topup_orders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw asError(error, 'Không thể tải lịch sử nạp tiền');
  return (data as TopupOrder[]) ?? [];
}

export async function listAllOrders(): Promise<TopupOrder[]> {
  const { data, error } = await supabase
    .from('topup_orders')
    .select('*, profiles:user_id(*)')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw asError(error, 'Không thể tải danh sách giao dịch');
  return (data as TopupOrder[]) ?? [];
}

export async function adminCompleteOrder(orderId: string): Promise<TopupOrder> {
  const { data, error } = await supabase.rpc('admin_complete_topup', { p_order_id: orderId });
  if (error) throw asError(error, 'Không thể xác nhận giao dịch');
  return data as TopupOrder;
}

export async function adminCancelOrder(orderId: string): Promise<TopupOrder> {
  const { data, error } = await supabase.rpc('admin_cancel_topup', { p_order_id: orderId });
  if (error) throw asError(error, 'Không thể huỷ giao dịch');
  return data as TopupOrder;
}

// ---------- Role prices (đổi cấp bậc bằng coin) ----------
export async function listRolePrices(): Promise<RolePrice[]> {
  const { data, error } = await supabase.from('role_prices').select('*').order('coin_cost', { ascending: true });
  if (error) throw asError(error, 'Không thể tải bảng giá cấp bậc');
  return (data as RolePrice[]) ?? [];
}

export async function upsertRolePrice(role: string, coinCost: number, enabled: boolean): Promise<RolePrice> {
  const { data, error } = await supabase
    .from('role_prices')
    .upsert({ role, coin_cost: coinCost, enabled, updated_at: new Date().toISOString() })
    .select('*')
    .single();
  if (error) throw asError(error, 'Không thể lưu giá cấp bậc');
  return data as RolePrice;
}

export async function deleteRolePrice(role: string): Promise<void> {
  const { error } = await supabase.from('role_prices').delete().eq('role', role);
  if (error) throw asError(error, 'Không thể xoá giá cấp bậc');
}

export async function redeemRoleUpgrade(targetRole: string): Promise<Profile> {
  const { data, error } = await supabase.rpc('redeem_role_upgrade', { target_role: targetRole });
  if (error) throw asError(error, 'Không thể đổi cấp bậc');
  return data as Profile;
}
