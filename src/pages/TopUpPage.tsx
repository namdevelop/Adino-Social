import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { ROLE_COLORS, ROLE_RANK } from '../lib/roles';
import {
  listCoinPackages, createTopupOrder, listMyOrders, orderMemo, buildVietQrUrl,
  listRolePrices, redeemRoleUpgrade,
} from '../lib/topup';
import type { CoinPackage, TopupOrder, RolePrice } from '../lib/types';
import {
  Coins, Loader2, Copy, Check, Clock, CheckCircle2, XCircle, Sparkles,
  Wallet, ArrowUpCircle, AlertCircle, QrCode,
} from 'lucide-react';

export default function TopUpPage() {
  const { profile, refreshProfile } = useAuth();
  const [packages, setPackages] = useState<CoinPackage[]>([]);
  const [orders, setOrders] = useState<TopupOrder[]>([]);
  const [rolePrices, setRolePrices] = useState<RolePrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeOrder, setActiveOrder] = useState<TopupOrder | null>(null);
  const [creatingPkgId, setCreatingPkgId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [bank, setBank] = useState<{ bin: string | null; accountNo: string | null; accountName: string | null }>({ bin: null, accountNo: null, accountName: null });
  const [redeemingRole, setRedeemingRole] = useState<string | null>(null);
  const [redeemMsg, setRedeemMsg] = useState('');
  const [orderError, setOrderError] = useState('');

  const loadAll = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const [pkgs, myOrders, prices, settingsRes] = await Promise.all([
        listCoinPackages(true),
        listMyOrders(profile.id),
        listRolePrices(),
        supabase.from('app_settings').select('bank_bin, bank_account_no, bank_account_name').eq('id', 1).maybeSingle(),
      ]);
      setPackages(pkgs);
      setOrders(myOrders);
      setRolePrices(prices);
      if (settingsRes.data) {
        setBank({
          bin: settingsRes.data.bank_bin,
          accountNo: settingsRes.data.bank_account_no,
          accountName: settingsRes.data.bank_account_name,
        });
      }
      const pending = myOrders.find((o) => o.status === 'pending');
      if (pending) setActiveOrder(pending);
    } catch {
      // im lặng, phần UI rỗng vẫn hiển thị được
    }
    setLoading(false);
  }, [profile]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Lắng nghe realtime đơn của chính mình -> khi admin xác nhận, cập nhật ngay
  useEffect(() => {
    if (!profile) return;
    const channel = supabase
      .channel(`my-topup-orders-${profile.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'topup_orders', filter: `user_id=eq.${profile.id}` }, (payload) => {
        const updated = payload.new as TopupOrder;
        setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
        setActiveOrder((prev) => (prev?.id === updated.id ? (updated.status === 'pending' ? updated : null) : prev));
        if (updated.status === 'completed') refreshProfile();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile, refreshProfile]);

  const startOrder = async (pkg: CoinPackage) => {
    if (!profile || creatingPkgId) return;
    setCreatingPkgId(pkg.id);
    setOrderError('');
    try {
      const order = await createTopupOrder(pkg, profile.id);
      setOrders((prev) => [order, ...prev]);
      setActiveOrder(order);
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : 'Không thể tạo đơn nạp tiền');
    } finally {
      setCreatingPkgId(null);
    }
  };

  const copyMemo = (memo: string) => {
    navigator.clipboard.writeText(memo).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const doRedeem = async (role: string) => {
    if (redeemingRole) return;
    setRedeemingRole(role);
    setRedeemMsg('');
    try {
      await redeemRoleUpgrade(role);
      await refreshProfile();
      setRedeemMsg(`Đã đổi thành công sang cấp bậc "${role}"!`);
    } catch (err) {
      setRedeemMsg(err instanceof Error ? err.message : 'Không thể đổi cấp bậc');
    } finally {
      setRedeemingRole(null);
    }
  };

  if (!profile) return null;

  const bankReady = bank.bin && bank.accountNo && bank.accountName;
  const memo = activeOrder ? orderMemo(activeOrder.id) : '';
  const qrUrl = activeOrder && bankReady
    ? buildVietQrUrl({ bankBin: bank.bin!, accountNo: bank.accountNo!, accountName: bank.accountName!, amount: activeOrder.amount_vnd, memo })
    : null;

  const eligiblePrices = rolePrices.filter((rp) => ROLE_RANK[rp.role] > ROLE_RANK[profile.role] && rp.enabled);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl anime-btn-primary flex items-center justify-center anime-glow-pink">
          <Coins className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold anime-text-gradient">Nạp tiền & Coin</h1>
          <p className="text-slate-400 text-sm">Ủng hộ cộng đồng & đổi cấp bậc bằng coin</p>
        </div>
      </div>

      <div className="anime-card rounded-2xl p-5 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-xs text-slate-400">Số dư của bạn</p>
            <p className="text-xl font-bold text-slate-800 dark:text-white">{profile.coins.toLocaleString('vi-VN')} coin</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-pink-500" /></div>
      ) : (
        <>
          {!bankReady && (
            <div className="mb-6 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 px-4 py-3 text-amber-700 dark:text-amber-300 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              Quản trị viên chưa cấu hình tài khoản ngân hàng nhận tiền. Vào Bảng quản trị → Nạp tiền để thiết lập.
            </div>
          )}

          {orderError && (
            <div className="mb-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 px-4 py-2.5 text-rose-600 dark:text-rose-400 text-sm">{orderError}</div>
          )}

          {activeOrder ? (
            <div className="anime-card rounded-2xl p-6 mb-6 text-center">
              <div className="flex items-center justify-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-amber-500 animate-pulse" />
                <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">Đang chờ xác nhận thanh toán</span>
              </div>

              {qrUrl && (
                <img src={qrUrl} alt="VietQR" className="w-56 h-56 mx-auto rounded-xl border border-pink-200 dark:border-fuchsia-500/20 mb-4" />
              )}

              <div className="space-y-2 text-sm text-left max-w-xs mx-auto">
                <div className="flex justify-between"><span className="text-slate-400">Số tiền</span><span className="font-semibold text-slate-800 dark:text-white">{activeOrder.amount_vnd.toLocaleString('vi-VN')}đ</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Nhận được</span><span className="font-semibold text-emerald-500">+{activeOrder.coins.toLocaleString('vi-VN')} coin</span></div>
                {bankReady && (
                  <>
                    <div className="flex justify-between"><span className="text-slate-400">Ngân hàng</span><span className="font-medium text-slate-800 dark:text-white">{bank.accountName}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Số TK</span><span className="font-medium text-slate-800 dark:text-white">{bank.accountNo}</span></div>
                  </>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Nội dung CK</span>
                  <button onClick={() => copyMemo(memo)} className="flex items-center gap-1.5 font-mono font-semibold text-pink-500 hover:text-pink-600">
                    {memo} {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-400 mt-4">
                Quét mã QR hoặc chuyển khoản đúng <span className="font-semibold">số tiền</span> và <span className="font-semibold">nội dung</span> ở trên. Admin sẽ xác nhận và cộng coin ngay khi nhận được tiền.
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4 mb-8">
              {packages.length === 0 ? (
                <div className="anime-card rounded-2xl p-8 text-center col-span-2 text-slate-400">Chưa có gói nạp nào được thiết lập.</div>
              ) : packages.map((pkg) => (
                <div key={pkg.id} className="anime-card rounded-2xl p-5 flex flex-col">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-pink-500" />
                    <span className="font-bold text-slate-800 dark:text-white">{pkg.name}</span>
                  </div>
                  <p className="text-2xl font-bold anime-text-gradient mb-1">{pkg.amount_vnd.toLocaleString('vi-VN')}đ</p>
                  <p className="text-sm text-emerald-500 font-medium mb-4">+{pkg.coins.toLocaleString('vi-VN')} coin</p>
                  <button onClick={() => startOrder(pkg)} disabled={!bankReady || creatingPkgId === pkg.id}
                    className="mt-auto flex items-center justify-center gap-2 py-2.5 rounded-xl anime-btn-primary text-sm font-semibold disabled:opacity-50">
                    {creatingPkgId === pkg.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                    Nạp ngay
                  </button>
                </div>
              ))}
            </div>
          )}

          {eligiblePrices.length > 0 && (
            <div className="anime-card rounded-2xl p-5 mb-6">
              <h3 className="font-bold anime-text-gradient mb-1 flex items-center gap-2"><ArrowUpCircle className="w-4 h-4" /> Đổi cấp bậc bằng Coin</h3>
              <p className="text-xs text-slate-400 mb-4">Dùng coin để nâng cấp bậc ngay lập tức, không cần chờ admin duyệt.</p>

              {redeemMsg && (
                <div className="mb-3 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 px-4 py-2.5 text-cyan-700 dark:text-cyan-300 text-sm">{redeemMsg}</div>
              )}

              <div className="space-y-2">
                {eligiblePrices.map((rp) => {
                  const colors = ROLE_COLORS[rp.role];
                  const canAfford = profile.coins >= rp.coin_cost;
                  return (
                    <div key={rp.role} className="flex items-center justify-between px-4 py-3 rounded-xl bg-pink-50/60 dark:bg-white/5 border border-pink-200/50 dark:border-fuchsia-500/15">
                      <span className={`text-sm px-2.5 py-1 rounded-full ${colors.badge}`}>{rp.role}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-slate-700 dark:text-white">{rp.coin_cost.toLocaleString('vi-VN')} coin</span>
                        <button onClick={() => doRedeem(rp.role)} disabled={!canAfford || redeemingRole === rp.role}
                          className="px-3.5 py-1.5 rounded-lg anime-btn-primary text-xs font-semibold disabled:opacity-40">
                          {redeemingRole === rp.role ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : canAfford ? 'Đổi ngay' : 'Không đủ coin'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <h2 className="font-bold anime-text-gradient mb-3">Lịch sử giao dịch</h2>
          {orders.length === 0 ? (
            <div className="anime-card rounded-2xl p-8 text-center text-slate-400">Chưa có giao dịch nào.</div>
          ) : (
            <div className="space-y-2">
              {orders.map((o) => (
                <div key={o.id} className="anime-card rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-white">{o.amount_vnd.toLocaleString('vi-VN')}đ → +{o.coins.toLocaleString('vi-VN')} coin</p>
                    <p className="text-xs text-slate-400">{new Date(o.created_at).toLocaleString('vi-VN')}</p>
                  </div>
                  {o.status === 'pending' && <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 flex items-center gap-1"><Clock className="w-3 h-3" /> Chờ xác nhận</span>}
                  {o.status === 'completed' && <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Thành công</span>}
                  {o.status === 'cancelled' && <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400 flex items-center gap-1"><XCircle className="w-3 h-3" /> Đã huỷ</span>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
