import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { canSell } from '../lib/roles';
import { listShopListings, listMyListings, createShopListing, deleteListing, purchaseListing, listMyPurchases } from '../lib/shop';
import type { ShopListing, ShopOrder } from '../lib/types';
import Avatar from '../components/Avatar';
import {
  Store, Loader2, Plus, X, Coins, Tag, Lock, Trash2, Sparkles,
  ShoppingCart, Clock, LinkIcon, Copy, Check, CheckCircle2,
} from 'lucide-react';

export default function ShopPage() {
  const { profile, refreshProfile } = useAuth();
  const [listings, setListings] = useState<ShopListing[]>([]);
  const [myListings, setMyListings] = useState<ShopListing[]>([]);
  const [myPurchases, setMyPurchases] = useState<ShopOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'all' | 'mine' | 'purchases'>('all');
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [productLink, setProductLink] = useState('');
  const [posting, setPosting] = useState(false);
  const [formError, setFormError] = useState('');
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [buyError, setBuyError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [justBought, setJustBought] = useState<ShopOrder | null>(null);

  const canPost = !!profile && canSell(profile.role);

  const loadAll = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const [all, mine, purchases] = await Promise.all([
        listShopListings(), listMyListings(profile.id), listMyPurchases(profile.id),
      ]);
      setListings(all);
      setMyListings(mine);
      setMyPurchases(purchases);
    } catch {
      // im lặng
    }
    setLoading(false);
  }, [profile]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    const channel = supabase
      .channel('shop-listings-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_listings' }, () => loadAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadAll]);

  const submitListing = async () => {
    const priceNum = parseInt(price, 10);
    if (!title.trim() || !priceNum || !productLink.trim() || posting) return;
    setPosting(true);
    setFormError('');
    try {
      await createShopListing({ title, description, priceCoin: priceNum, imageUrl, productLink });
      await refreshProfile();
      setTitle(''); setDescription(''); setPrice(''); setImageUrl(''); setProductLink(''); setShowForm(false);
      setView('mine');
      await loadAll();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Không thể đăng bán');
    } finally {
      setPosting(false);
    }
  };

  const handleBuy = async (listing: ShopListing) => {
    if (!profile || buyingId) return;
    if (profile.coins < listing.price_coin) {
      setBuyError('Bạn không đủ coin để mua sản phẩm này.');
      return;
    }
    if (!confirm(`Mua "${listing.title}" với giá ${listing.price_coin.toLocaleString('vi-VN')} coin?`)) return;
    setBuyingId(listing.id);
    setBuyError('');
    try {
      const order = await purchaseListing(listing.id);
      await refreshProfile();
      await loadAll();
      setJustBought(order);
    } catch (err) {
      setBuyError(err instanceof Error ? err.message : 'Không thể mua sản phẩm');
    } finally {
      setBuyingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Xoá tin đăng này?')) return;
    try { await deleteListing(id); await loadAll(); } catch { /* im lặng */ }
  };

  const copyLink = (id: string, link: string) => {
    navigator.clipboard.writeText(link).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  };

  if (!profile) return null;

  const shownListings = view === 'all' ? listings : myListings;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl anime-btn-primary flex items-center justify-center anime-glow-pink">
            <Store className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold anime-text-gradient">Khu bán hàng</h1>
            <p className="text-slate-400 text-sm">Đăng bán & mua bằng coin trong cộng đồng</p>
          </div>
        </div>

        {canPost ? (
          <button onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl anime-btn-primary text-sm font-semibold">
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? 'Đóng' : 'Đăng bán (10 coin)'}
          </button>
        ) : (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-400 text-xs">
            <Lock className="w-3.5 h-3.5" /> Cần từ Kiểm duyệt viên trở lên để đăng bán
          </div>
        )}
      </div>

      {justBought && (
        <div className="anime-card rounded-2xl p-5 mb-6 border-2 border-emerald-300 dark:border-emerald-500/40 animate-in fade-in">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Mua thành công!
            </span>
            <button onClick={() => setJustBought(null)} className="text-slate-400 hover:text-rose-400"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
            <LinkIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <a href={justBought.product_link ?? '#'} target="_blank" rel="noopener noreferrer" className="text-sm text-emerald-700 dark:text-emerald-300 underline truncate flex-1">
              {justBought.product_link}
            </a>
            <button onClick={() => copyLink(justBought.id, justBought.product_link!)} className="text-emerald-600 dark:text-emerald-400 hover:opacity-70 shrink-0">
              {copiedId === justBought.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {showForm && canPost && (
        <div className="anime-card rounded-2xl p-5 mb-6 space-y-3 animate-in fade-in">
          <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 mb-1">
            <Coins className="w-3.5 h-3.5" /> Mỗi lần đăng tin mất <span className="font-semibold">10 coin</span>. Bạn hiện có {profile.coins.toLocaleString('vi-VN')} coin.
          </div>
          <p className="text-xs text-slate-400">Tin đăng cần <span className="font-medium">admin duyệt</span> trước khi hiện công khai cho người mua.</p>
          {formError && (
            <div className="rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 px-4 py-2.5 text-rose-600 dark:text-rose-400 text-sm">{formError}</div>
          )}
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tiêu đề tin đăng"
            className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-pink-200 dark:border-fuchsia-500/20 text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:border-pink-500 text-sm" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Mô tả sản phẩm..."
            className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-pink-200 dark:border-fuchsia-500/20 text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:border-pink-500 resize-none text-sm" />
          <div className="grid sm:grid-cols-2 gap-3">
            <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" placeholder="Giá bán (coin)"
              className="px-4 py-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-pink-200 dark:border-fuchsia-500/20 text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:border-pink-500 text-sm" />
            <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="URL hình ảnh (tuỳ chọn)"
              className="px-4 py-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-pink-200 dark:border-fuchsia-500/20 text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:border-pink-500 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-fuchsia-200/60 mb-1 flex items-center gap-1.5">
              <LinkIcon className="w-3.5 h-3.5" /> Link/nội dung sản phẩm (chỉ hiện cho người mua SAU KHI mua thành công)
            </label>
            <input value={productLink} onChange={(e) => setProductLink(e.target.value)} placeholder="https://... hoặc mã/tài khoản cần giao"
              className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-pink-200 dark:border-fuchsia-500/20 text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:border-pink-500 text-sm" />
          </div>
          <button onClick={submitListing} disabled={!title.trim() || !price || !productLink.trim() || posting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl anime-btn-primary text-sm font-semibold disabled:opacity-50">
            {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Tag className="w-4 h-4" />} Đăng bán
          </button>
        </div>
      )}

      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        <button onClick={() => setView('all')}
          className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${view === 'all' ? 'anime-btn-primary text-white' : 'anime-card text-slate-500 dark:text-fuchsia-200/60'}`}>
          Tất cả tin đăng
        </button>
        <button onClick={() => setView('mine')}
          className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${view === 'mine' ? 'anime-btn-primary text-white' : 'anime-card text-slate-500 dark:text-fuchsia-200/60'}`}>
          Tin của tôi
        </button>
        <button onClick={() => setView('purchases')}
          className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${view === 'purchases' ? 'anime-btn-primary text-white' : 'anime-card text-slate-500 dark:text-fuchsia-200/60'}`}>
          <ShoppingCart className="w-3.5 h-3.5" /> Đã mua
        </button>
      </div>

      {buyError && (
        <div className="mb-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 px-4 py-2.5 text-rose-600 dark:text-rose-400 text-sm flex items-center gap-2">
          {buyError}
          <button onClick={() => setBuyError('')} className="ml-auto text-rose-400 hover:text-rose-600">×</button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-pink-500" /></div>
      ) : view === 'purchases' ? (
        myPurchases.length === 0 ? (
          <div className="anime-card rounded-2xl p-12 text-center">
            <ShoppingCart className="w-12 h-12 text-pink-300 mx-auto mb-4" />
            <p className="text-slate-400">Bạn chưa mua sản phẩm nào.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {myPurchases.map((o) => (
              <div key={o.id} className="anime-card rounded-2xl p-4">
                <p className="font-semibold text-slate-800 dark:text-white">{o.shop_listings?.title ?? 'Sản phẩm'}</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 mb-2"><Coins className="w-3 h-3" /> {o.price_coin.toLocaleString('vi-VN')} coin • {new Date(o.created_at).toLocaleString('vi-VN')}</p>
                {o.product_link && (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                    <LinkIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <a href={o.product_link} target="_blank" rel="noopener noreferrer" className="text-sm text-emerald-700 dark:text-emerald-300 underline truncate flex-1">{o.product_link}</a>
                    <button onClick={() => copyLink(o.id, o.product_link!)} className="text-emerald-600 dark:text-emerald-400 hover:opacity-70 shrink-0">
                      {copiedId === o.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      ) : shownListings.length === 0 ? (
        <div className="anime-card rounded-2xl p-12 text-center">
          <Sparkles className="w-12 h-12 text-pink-300 mx-auto mb-4" />
          <p className="text-slate-400">{view === 'all' ? 'Chưa có tin đăng nào.' : 'Bạn chưa đăng tin nào.'}</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {shownListings.map((item) => {
            const isMine = item.seller_id === profile.id;
            const buying = buyingId === item.id;
            return (
              <div key={item.id} className={`anime-card rounded-2xl overflow-hidden flex flex-col ${item.status === 'sold' || item.status === 'removed' || item.status === 'rejected' ? 'opacity-60' : ''}`}>
                {item.image_url && <img src={item.image_url} alt="" className="w-full h-40 object-cover" />}
                <div className="p-4 flex flex-col flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-semibold text-slate-800 dark:text-white flex-1 line-clamp-1">{item.title}</h3>
                    {item.status === 'pending' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> Chờ duyệt</span>}
                    {item.status === 'sold' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-white/10 text-slate-500">Đã bán</span>}
                    {item.status === 'rejected' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">Bị từ chối</span>}
                  </div>
                  {item.description && <p className="text-xs text-slate-500 dark:text-fuchsia-200/60 line-clamp-2 mb-2">{item.description}</p>}
                  <p className="text-lg font-bold anime-text-gradient mb-3 flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-amber-500" /> {item.price_coin.toLocaleString('vi-VN')} coin
                  </p>

                  <div className="mt-auto flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Avatar profile={item.profiles ?? null} size={24} />
                      <span className="text-xs text-slate-500 dark:text-fuchsia-200/60 truncate">{item.profiles?.username ?? 'Unknown'}</span>
                    </div>
                    {isMine ? (
                      (item.status === 'pending' || item.status === 'active') && (
                        <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 shrink-0" title="Xoá">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )
                    ) : item.status === 'active' ? (
                      <button onClick={() => handleBuy(item)} disabled={buying}
                        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg anime-btn-primary text-xs font-semibold disabled:opacity-50">
                        {buying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShoppingCart className="w-3.5 h-3.5" />} Mua ngay
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
