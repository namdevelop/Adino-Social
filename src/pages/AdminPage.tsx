import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import {
  ROLE_COLORS, ROLE_RANK, ALL_ROLES, canManageUsers,
  canMuteUsers, isUserMuted, muteRemainingMinutes, MUTE_DURATION_MS, canBanUsers, canManageTopup,
} from '../lib/roles';
import { listAnnouncements, createAnnouncement, deleteAnnouncement } from '../lib/announcements';
import { setMaintenanceMode, updateBankSettings } from '../lib/settings';
import {
  listCoinPackages, createCoinPackage, updateCoinPackage, deleteCoinPackage,
  listAllOrders, adminCompleteOrder, adminCancelOrder,
  listRolePrices, upsertRolePrice, deleteRolePrice, orderMemo,
} from '../lib/topup';
import {
  listAllShopListings, deleteListing as deleteShopListing,
  adminApproveListing, adminRejectListing, listAllOrdersForAdmin,
} from '../lib/shop';
import {
  listAllTasksAdmin, createTask, updateTask, deleteTask,
} from '../lib/tasks';
import type { Profile, Post, Announcement, CoinPackage, TopupOrder, RolePrice, ShopListing, ShopOrder, Task } from '../lib/types';
import Avatar from '../components/Avatar';
import { Shield, Users, FileText, MessageSquare, Heart, Trash2, Search, Loader2, AlertCircle, BarChart3, VolumeX, Volume2, MessagesSquare, Megaphone, ShieldOff, ShieldCheck, Wrench, Coins, Plus, Check, X as XIcon, Clock, CheckCircle2, XCircle, Landmark, Store, Lock, ShoppingCart, ListChecks, ExternalLink } from 'lucide-react';

type Tab = 'dashboard' | 'users' | 'posts' | 'chat' | 'announcements' | 'maintenance' | 'topup' | 'shop' | 'tasks';

export default function AdminPage() {
  const { profile, maintenance } = useAuth();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [members, setMembers] = useState<Profile[]>([]);
  const [posts, setPosts] = useState<(Post & { like_count: number; comment_count: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState({ users: 0, posts: 0, comments: 0, likes: 0, messages: 0 });
  const [mutingId, setMutingId] = useState<string | null>(null);
  const [banningId, setBanningId] = useState<string | null>(null);
  const [usersActionMsg, setUsersActionMsg] = useState('');
  const [postsActionMsg, setPostsActionMsg] = useState('');
  const [deleteBefore, setDeleteBefore] = useState('');
  const [deletingMessages, setDeletingMessages] = useState<'all' | 'before' | null>(null);
  const [chatActionMsg, setChatActionMsg] = useState('');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [annError, setAnnError] = useState('');
  const [deletingAnnId, setDeletingAnnId] = useState<string | null>(null);
  const [maintEnabled, setMaintEnabled] = useState(false);
  const [maintMessage, setMaintMessage] = useState('');
  const [savingMaint, setSavingMaint] = useState(false);
  const [maintActionMsg, setMaintActionMsg] = useState('');
  const [coinPackages, setCoinPackages] = useState<CoinPackage[]>([]);
  const [orders, setOrders] = useState<TopupOrder[]>([]);
  const [rolePrices, setRolePrices] = useState<RolePrice[]>([]);
  const [topupTab, setTopupTab] = useState<'orders' | 'packages' | 'prices' | 'bank'>('orders');
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);
  const [topupMsg, setTopupMsg] = useState('');
  const [newPkgName, setNewPkgName] = useState('');
  const [newPkgAmount, setNewPkgAmount] = useState('');
  const [newPkgCoins, setNewPkgCoins] = useState('');
  const [savingPkg, setSavingPkg] = useState(false);
  const [newPriceRole, setNewPriceRole] = useState('');
  const [newPriceCost, setNewPriceCost] = useState('');
  const [savingPrice, setSavingPrice] = useState(false);
  const [bankBin, setBankBin] = useState('');
  const [bankAccountNo, setBankAccountNo] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');
  const [savingBank, setSavingBank] = useState(false);
  const [shopListings, setShopListings] = useState<ShopListing[]>([]);
  const [shopActionMsg, setShopActionMsg] = useState('');
  const [removingListingId, setRemovingListingId] = useState<string | null>(null);
  const [shopSubTab, setShopSubTab] = useState<'pending' | 'listings' | 'history'>('pending');
  const [shopOrders, setShopOrders] = useState<ShopOrder[]>([]);
  const [reviewingListingId, setReviewingListingId] = useState<string | null>(null);
  const [taskList, setTaskList] = useState<Task[]>([]);
  const [taskActionMsg, setTaskActionMsg] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskLink, setNewTaskLink] = useState('');
  const [newTaskReward, setNewTaskReward] = useState('10');
  const [savingTask, setSavingTask] = useState(false);

  const canAccess = profile && canManageUsers(profile.role);
  const canMute = profile && canMuteUsers(profile.role);
  const canBan = profile && canBanUsers(profile.role);
  const canTopup = profile && canManageTopup(profile.role);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [mRes, pRes, cRes, lRes, chatRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: true }),
      supabase.from('posts').select('*').order('created_at', { ascending: false }),
      supabase.from('comments').select('*', { count: 'exact', head: true }),
      supabase.from('likes').select('*', { count: 'exact', head: true }),
      supabase.from('chat_messages').select('*', { count: 'exact', head: true }),
    ]);
    setMembers((mRes.data as Profile[]) ?? []);
    const postsData = (pRes.data as Post[]) ?? [];
    setPosts(postsData.map((p) => ({ ...p, like_count: 0, comment_count: 0 })));
    setStats({ users: mRes.data?.length ?? 0, posts: postsData.length, comments: cRes.count ?? 0, likes: lRes.count ?? 0, messages: chatRes.count ?? 0 });
    setLoading(false);
  }, []);

  useEffect(() => {
    if (maintenance) {
      setMaintEnabled(maintenance.maintenance_mode);
      setMaintMessage(maintenance.maintenance_message ?? '');
      setBankBin(maintenance.bank_bin ?? '');
      setBankAccountNo(maintenance.bank_account_no ?? '');
      setBankAccountName(maintenance.bank_account_name ?? '');
    }
  }, [maintenance]);

  const loadTopupData = useCallback(async () => {
    if (!canTopup) return;
    try {
      const [pkgs, allOrders, prices] = await Promise.all([
        listCoinPackages(false),
        listAllOrders(),
        listRolePrices(),
      ]);
      setCoinPackages(pkgs);
      setOrders(allOrders);
      setRolePrices(prices);
    } catch {
      // im lặng, tab sẽ hiện danh sách rỗng
    }
  }, [canTopup]);

  const loadShopData = useCallback(async () => {
    try {
      const [all, allOrders] = await Promise.all([listAllShopListings(), listAllOrdersForAdmin()]);
      setShopListings(all);
      setShopOrders(allOrders);
    } catch {
      // im lặng
    }
  }, []);

  const loadTaskData = useCallback(async () => {
    try {
      const t = await listAllTasksAdmin();
      setTaskList(t);
    } catch {
      // im lặng
    }
  }, []);

  // TẢI DỮ LIỆU LƯỜI (lazy): chỉ gọi API cho đúng tab đang mở, lần đầu tiên
  // ghé qua tab đó — không tải sẵn dữ liệu của cả 9 tab cùng lúc lúc vào trang,
  // giúp Bảng quản trị mở nhanh hơn nhiều.
  const [loadedTabs, setLoadedTabs] = useState<Set<Tab>>(new Set());
  const markLoaded = (t: Tab) => setLoadedTabs((prev) => new Set(prev).add(t));

  useEffect(() => {
    const needsCore = tab === 'dashboard' || tab === 'users' || tab === 'posts';
    if (needsCore && !loadedTabs.has('dashboard')) {
      loadData();
      markLoaded('dashboard');
    } else if (tab === 'announcements' && !loadedTabs.has('announcements')) {
      listAnnouncements().then(setAnnouncements).catch(() => {});
      markLoaded('announcements');
    } else if (tab === 'topup' && canTopup && !loadedTabs.has('topup')) {
      loadTopupData();
      markLoaded('topup');
    } else if (tab === 'shop' && !loadedTabs.has('shop')) {
      loadShopData();
      markLoaded('shop');
    } else if (tab === 'tasks' && !loadedTabs.has('tasks')) {
      loadTaskData();
      markLoaded('tasks');
    }
  }, [tab, loadedTabs, canTopup, loadData, loadTopupData, loadShopData, loadTaskData]);

  // Realtime: chỉ mở kênh lắng nghe SAU KHI đã ghé qua tab đó ít nhất 1 lần
  // (đỡ mở hàng loạt kết nối realtime ngay khi vừa vào trang).
  useEffect(() => {
    if (!canTopup || !loadedTabs.has('topup')) return;
    const channel = supabase
      .channel('admin-topup-orders-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'topup_orders' }, () => loadTopupData())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'topup_orders' }, () => loadTopupData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadTopupData, canTopup, loadedTabs]);

  useEffect(() => {
    if (!loadedTabs.has('shop')) return;
    const channel = supabase
      .channel('admin-shop-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_listings' }, () => loadShopData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shop_orders' }, () => loadShopData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadShopData, loadedTabs]);

  useEffect(() => {
    if (!loadedTabs.has('tasks')) return;
    const channel = supabase
      .channel('admin-tasks-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => loadTaskData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadTaskData, loadedTabs]);

  // Cập nhật lại giao diện mỗi 30s để đồng hồ đếm ngược "còn X phút" luôn đúng
  // và tự động ẩn trạng thái mute khi hết hạn (không cần thao tác gì thêm).
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  if (!canAccess) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-rose-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Không có quyền truy cập</h2>
        <p className="text-slate-400">Trang quản trị chỉ dành cho Admin và Phó Admin.</p>
      </div>
    );
  }

  const updateRole = async (userId: string, newRole: string) => {
    const prevMembers = members;
    setMembers(members.map((m) => (m.id === userId ? { ...m, role: newRole } : m)));
    setUsersActionMsg('');
    const { data, error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId).select('id');
    if (error || !data || data.length === 0) {
      setMembers(prevMembers); // hoàn tác giao diện vì update thực tế thất bại
      setUsersActionMsg(
        error
          ? `Không thể đổi cấp bậc: ${error.message}`
          : 'Không thể đổi cấp bậc: bạn chưa có quyền cập nhật hồ sơ người khác. Hãy chạy file SQL "2026_fix_profiles_admin_update.sql".'
      );
    }
  };

  const muteUser = async (userId: string) => {
    if (!canMute) return;
    setMutingId(userId);
    setUsersActionMsg('');
    const mutedUntil = new Date(Date.now() + MUTE_DURATION_MS).toISOString();
    const { data, error } = await supabase.from('profiles').update({ muted_until: mutedUntil }).eq('id', userId).select('id');
    if (!error && data && data.length > 0) {
      setMembers((prev) => prev.map((m) => (m.id === userId ? { ...m, muted_until: mutedUntil } : m)));
    } else {
      setUsersActionMsg(
        error
          ? `Không thể cấm chat: ${error.message}`
          : 'Không thể cấm chat: bạn chưa có quyền cập nhật hồ sơ người khác. Hãy chạy file SQL "2026_fix_profiles_admin_update.sql".'
      );
    }
    setMutingId(null);
  };

  const unmuteUser = async (userId: string) => {
    if (!canMute) return;
    setMutingId(userId);
    setUsersActionMsg('');
    const { data, error } = await supabase.from('profiles').update({ muted_until: null }).eq('id', userId).select('id');
    if (!error && data && data.length > 0) {
      setMembers((prev) => prev.map((m) => (m.id === userId ? { ...m, muted_until: null } : m)));
    } else {
      setUsersActionMsg(
        error
          ? `Không thể bỏ cấm: ${error.message}`
          : 'Không thể bỏ cấm: bạn chưa có quyền cập nhật hồ sơ người khác. Hãy chạy file SQL "2026_fix_profiles_admin_update.sql".'
      );
    }
    setMutingId(null);
  };

  const banUser = async (member: Profile) => {
    if (!canBan || !profile) return;
    if (member.id === profile.id) return;
    if (ROLE_RANK[member.role] >= ROLE_RANK[profile.role]) {
      setUsersActionMsg('Bạn không thể cấm người có cấp bậc bằng hoặc cao hơn mình.');
      return;
    }
    if (!confirm(`Bạn có chắc chắn muốn CẤM VĨNH VIỄN tài khoản "${member.username}"? Họ sẽ bị đăng xuất ngay lập tức và không thể đăng nhập lại.`)) return;
    setBanningId(member.id);
    setUsersActionMsg('');
    const { data, error } = await supabase.from('profiles').update({ is_banned: true }).eq('id', member.id).select('id');
    if (!error && data && data.length > 0) {
      setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, is_banned: true } : m)));
    } else {
      setUsersActionMsg(
        error
          ? `Không thể cấm tài khoản: ${error.message}`
          : 'Không thể cấm tài khoản: bạn chưa có quyền cập nhật hồ sơ người khác. Hãy chạy file SQL "2026_fix_profiles_admin_update.sql" và "2026_add_permanent_ban.sql".'
      );
    }
    setBanningId(null);
  };

  const unbanUser = async (member: Profile) => {
    if (!canBan) return;
    setBanningId(member.id);
    setUsersActionMsg('');
    const { data, error } = await supabase.from('profiles').update({ is_banned: false }).eq('id', member.id).select('id');
    if (!error && data && data.length > 0) {
      setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, is_banned: false } : m)));
    } else {
      setUsersActionMsg(
        error
          ? `Không thể bỏ cấm: ${error.message}`
          : 'Không thể bỏ cấm: bạn chưa có quyền cập nhật hồ sơ người khác.'
      );
    }
    setBanningId(null);
  };

  const saveMaintenance = async () => {
    if (!profile || savingMaint) return;
    setSavingMaint(true);
    setMaintActionMsg('');
    try {
      await setMaintenanceMode(maintEnabled, maintMessage, profile.id);
      setMaintActionMsg(maintEnabled ? 'Đã BẬT chế độ bảo trì.' : 'Đã TẮT chế độ bảo trì.');
    } catch (err) {
      setMaintActionMsg(err instanceof Error ? err.message : 'Không thể lưu cài đặt bảo trì.');
    } finally {
      setSavingMaint(false);
    }
  };

  const confirmOrder = async (orderId: string) => {
    setProcessingOrderId(orderId);
    setTopupMsg('');
    try {
      await adminCompleteOrder(orderId);
      setTopupMsg('Đã xác nhận và cộng coin cho người dùng.');
      await loadTopupData();
    } catch (err) {
      setTopupMsg(err instanceof Error ? err.message : 'Không thể xác nhận đơn.');
    } finally {
      setProcessingOrderId(null);
    }
  };

  const cancelOrder = async (orderId: string) => {
    if (!confirm('Huỷ đơn nạp tiền này? Người dùng sẽ không nhận được coin.')) return;
    setProcessingOrderId(orderId);
    setTopupMsg('');
    try {
      await adminCancelOrder(orderId);
      setTopupMsg('Đã huỷ đơn.');
      await loadTopupData();
    } catch (err) {
      setTopupMsg(err instanceof Error ? err.message : 'Không thể huỷ đơn.');
    } finally {
      setProcessingOrderId(null);
    }
  };

  const addPackage = async () => {
    const amount = parseInt(newPkgAmount, 10);
    const coins = parseInt(newPkgCoins, 10);
    if (!newPkgName.trim() || !amount || !coins || savingPkg) return;
    setSavingPkg(true);
    setTopupMsg('');
    try {
      const pkg = await createCoinPackage({ name: newPkgName.trim(), amount_vnd: amount, coins, sort_order: coinPackages.length });
      setCoinPackages((prev) => [...prev, pkg]);
      setNewPkgName(''); setNewPkgAmount(''); setNewPkgCoins('');
    } catch (err) {
      setTopupMsg(err instanceof Error ? err.message : 'Không thể tạo gói nạp.');
    } finally {
      setSavingPkg(false);
    }
  };

  const togglePackageActive = async (pkg: CoinPackage) => {
    try {
      const updated = await updateCoinPackage(pkg.id, { active: !pkg.active });
      setCoinPackages((prev) => prev.map((p) => (p.id === pkg.id ? updated : p)));
    } catch (err) {
      setTopupMsg(err instanceof Error ? err.message : 'Không thể cập nhật gói nạp.');
    }
  };

  const removePackage = async (id: string) => {
    if (!confirm('Xoá gói nạp này?')) return;
    try {
      await deleteCoinPackage(id);
      setCoinPackages((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      setTopupMsg(err instanceof Error ? err.message : 'Không thể xoá gói nạp.');
    }
  };

  const addOrUpdatePrice = async () => {
    const cost = parseInt(newPriceCost, 10);
    if (!newPriceRole || !cost || savingPrice) return;
    setSavingPrice(true);
    setTopupMsg('');
    try {
      const price = await upsertRolePrice(newPriceRole, cost, true);
      setRolePrices((prev) => {
        const exists = prev.some((rp) => rp.role === price.role);
        return exists ? prev.map((rp) => (rp.role === price.role ? price : rp)) : [...prev, price];
      });
      setNewPriceRole(''); setNewPriceCost('');
    } catch (err) {
      setTopupMsg(err instanceof Error ? err.message : 'Không thể lưu giá cấp bậc.');
    } finally {
      setSavingPrice(false);
    }
  };

  const togglePriceEnabled = async (rp: RolePrice) => {
    try {
      const updated = await upsertRolePrice(rp.role, rp.coin_cost, !rp.enabled);
      setRolePrices((prev) => prev.map((p) => (p.role === rp.role ? updated : p)));
    } catch (err) {
      setTopupMsg(err instanceof Error ? err.message : 'Không thể cập nhật.');
    }
  };

  const removePrice = async (role: string) => {
    if (!confirm(`Ngừng bán cấp bậc "${role}" bằng coin?`)) return;
    try {
      await deleteRolePrice(role);
      setRolePrices((prev) => prev.filter((rp) => rp.role !== role));
    } catch (err) {
      setTopupMsg(err instanceof Error ? err.message : 'Không thể xoá.');
    }
  };

  const saveBank = async () => {
    if (!profile || savingBank) return;
    setSavingBank(true);
    setTopupMsg('');
    try {
      await updateBankSettings(bankBin, bankAccountNo, bankAccountName, profile.id);
      setTopupMsg('Đã lưu thông tin ngân hàng.');
    } catch (err) {
      setTopupMsg(err instanceof Error ? err.message : 'Không thể lưu thông tin ngân hàng.');
    } finally {
      setSavingBank(false);
    }
  };

  const removeListing = async (id: string) => {
    if (!confirm('Xoá tin đăng này khỏi Khu bán hàng?')) return;
    setRemovingListingId(id);
    setShopActionMsg('');
    try {
      await deleteShopListing(id);
      setShopListings((prev) => prev.filter((l) => l.id !== id));
      setShopActionMsg('Đã xoá tin đăng.');
    } catch (err) {
      setShopActionMsg(err instanceof Error ? err.message : 'Không thể xoá tin đăng.');
    } finally {
      setRemovingListingId(null);
    }
  };

  const approveListingItem = async (listingId: string) => {
    setReviewingListingId(listingId);
    setShopActionMsg('');
    try {
      await adminApproveListing(listingId);
      setShopActionMsg('Đã duyệt tin đăng — tin đã hiện công khai cho người mua.');
      await loadShopData();
    } catch (err) {
      setShopActionMsg(err instanceof Error ? err.message : 'Không thể duyệt tin đăng.');
    } finally {
      setReviewingListingId(null);
    }
  };

  const rejectListingItem = async (listingId: string) => {
    if (!confirm('Từ chối tin đăng này? Phí đăng 10 coin đã trả sẽ không được hoàn lại.')) return;
    setReviewingListingId(listingId);
    setShopActionMsg('');
    try {
      await adminRejectListing(listingId);
      setShopActionMsg('Đã từ chối tin đăng.');
      await loadShopData();
    } catch (err) {
      setShopActionMsg(err instanceof Error ? err.message : 'Không thể từ chối tin đăng.');
    } finally {
      setReviewingListingId(null);
    }
  };

  const addTask = async () => {
    const reward = parseInt(newTaskReward, 10);
    if (!newTaskTitle.trim() || !newTaskLink.trim() || !reward || savingTask) return;
    setSavingTask(true);
    setTaskActionMsg('');
    try {
      const t = await createTask({ title: newTaskTitle, description: newTaskDesc, link: newTaskLink, rewardCoin: reward });
      setTaskList((prev) => [t, ...prev]);
      setNewTaskTitle(''); setNewTaskDesc(''); setNewTaskLink(''); setNewTaskReward('10');
    } catch (err) {
      setTaskActionMsg(err instanceof Error ? err.message : 'Không thể tạo nhiệm vụ.');
    } finally {
      setSavingTask(false);
    }
  };

  const toggleTaskActive = async (task: Task) => {
    try {
      const updated = await updateTask(task.id, { active: !task.active });
      setTaskList((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
    } catch (err) {
      setTaskActionMsg(err instanceof Error ? err.message : 'Không thể cập nhật nhiệm vụ.');
    }
  };

  const removeTask = async (id: string) => {
    if (!confirm('Xoá nhiệm vụ này?')) return;
    try {
      await deleteTask(id);
      setTaskList((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      setTaskActionMsg(err instanceof Error ? err.message : 'Không thể xoá nhiệm vụ.');
    }
  };

  const deletePost = async (id: string) => {
    const prevPosts = posts;
    const prevStats = stats;
    setPostsActionMsg('');
    setPosts(posts.filter((p) => p.id !== id));
    setStats((s) => ({ ...s, posts: s.posts - 1 }));
    const { data, error } = await supabase.from('posts').delete().eq('id', id).select('id');
    if (error || !data || data.length === 0) {
      setPosts(prevPosts); // hoàn tác giao diện vì xoá thực tế thất bại
      setStats(prevStats);
      setPostsActionMsg(
        error
          ? `Không thể xoá bài đăng: ${error.message}`
          : 'Không thể xoá bài đăng: bạn chưa có quyền xoá bài của người khác. Hãy chạy file SQL "2026_fix_posts_admin_delete.sql".'
      );
    }
  };

  const postAnnouncement = async () => {
    if (!annTitle.trim() || !annContent.trim() || !profile || posting) return;
    setPosting(true);
    setAnnError('');
    try {
      const a = await createAnnouncement(annTitle, annContent, profile.id);
      setAnnouncements((prev) => (prev.some((p) => p.id === a.id) ? prev : [a, ...prev]));
      setAnnTitle('');
      setAnnContent('');
    } catch (err: any) {
      const msg = err?.message || err?.error_description || err?.hint || err?.details;
      setAnnError(msg ? String(msg) : `Không thể đăng thông báo (lỗi không xác định: ${JSON.stringify(err)})`);
      // In lỗi gốc ra console để dễ debug khi cần
      console.error('postAnnouncement error:', err);
    } finally {
      setPosting(false);
    }
  };

  const removeAnnouncement = async (id: string) => {
    setDeletingAnnId(id);
    try {
      await deleteAnnouncement(id);
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    } catch {
      // bỏ qua lỗi nhỏ, danh sách sẽ tự khớp lại qua realtime
    } finally {
      setDeletingAnnId(null);
    }
  };

  const deleteAllMessages = async () => {
    if (!canMute || deletingMessages) return;
    if (!confirm('Bạn có chắc chắn muốn xoá TOÀN BỘ tin nhắn chat (phòng chung + tin nhắn riêng)? Hành động này không thể hoàn tác.')) return;
    setDeletingMessages('all');
    setChatActionMsg('');
    const { error } = await supabase.from('chat_messages').delete().gte('created_at', '1970-01-01T00:00:00.000Z');
    if (error) {
      setChatActionMsg(`Lỗi: ${error.message}`);
    } else {
      setStats((s) => ({ ...s, messages: 0 }));
      setChatActionMsg('Đã xoá toàn bộ tin nhắn.');
    }
    setDeletingMessages(null);
  };

  const deleteMessagesBefore = async () => {
    if (!canMute || !deleteBefore || deletingMessages) return;
    const cutoff = new Date(deleteBefore);
    if (isNaN(cutoff.getTime())) return;
    if (!confirm(`Xoá tất cả tin nhắn được gửi trước ${cutoff.toLocaleString('vi-VN')}?`)) return;
    setDeletingMessages('before');
    setChatActionMsg('');
    const { error, count } = await supabase
      .from('chat_messages')
      .delete({ count: 'exact' })
      .lt('created_at', cutoff.toISOString());
    if (error) {
      setChatActionMsg(`Lỗi: ${error.message}`);
    } else {
      setStats((s) => ({ ...s, messages: Math.max(0, s.messages - (count ?? 0)) }));
      setChatActionMsg(`Đã xoá ${count ?? 0} tin nhắn trước mốc thời gian đã chọn.`);
    }
    setDeletingMessages(null);
  };

  const filteredMembers = members.filter((m) => m.username.toLowerCase().includes(search.toLowerCase()));
  const sortedMembers = [...filteredMembers].sort((a, b) => ROLE_RANK[b.role] - ROLE_RANK[a.role]);

  const allTabs: { id: Tab; label: string; icon: typeof Shield }[] = [
    { id: 'dashboard', label: 'Tổng quan', icon: BarChart3 },
    { id: 'users', label: 'Thành viên', icon: Users },
    { id: 'posts', label: 'Kiểm duyệt', icon: FileText },
    { id: 'chat', label: 'Tin nhắn', icon: MessagesSquare },
    { id: 'shop', label: 'Cửa hàng', icon: Store },
    { id: 'tasks', label: 'Nhiệm vụ', icon: ListChecks },
    { id: 'announcements', label: 'Thông báo', icon: Megaphone },
    { id: 'maintenance', label: 'Bảo trì', icon: Wrench },
    { id: 'topup', label: 'Nạp tiền', icon: Coins },
  ];
  // Mục "Nạp tiền" chỉ hiện với Sáng lập viên
  const tabs = allTabs.filter((t) => t.id !== 'topup' || canTopup);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center anime-glow-pink">
          <Shield className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold anime-text-gradient">Bảng quản trị</h1>
          <p className="text-slate-400 text-sm">Quản lý cộng đồng Adino Social</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${tab === t.id ? 'anime-btn-primary text-white' : 'anime-card text-slate-500 dark:text-fuchsia-200/60 hover:text-pink-500'}`}>
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-pink-500" /></div>
      ) : tab === 'dashboard' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard icon={Users} label="Thành viên" value={stats.users} />
            <StatCard icon={FileText} label="Bài đăng" value={stats.posts} />
            <StatCard icon={MessageSquare} label="Bình luận" value={stats.comments} />
            <StatCard icon={Heart} label="Lượt thích" value={stats.likes} />
            <StatCard icon={MessagesSquare} label="Tin nhắn chat" value={stats.messages} />
          </div>
          <div className="anime-card rounded-2xl p-5">
            <h3 className="font-bold anime-text-gradient mb-4">Phân bố cấp bậc</h3>
            <div className="space-y-3">
              {ALL_ROLES.map((role) => {
                const count = members.filter((m) => m.role === role).length;
                const pct = stats.users > 0 ? (count / stats.users) * 100 : 0;
                const colors = ROLE_COLORS[role];
                return (
                  <div key={role}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-sm font-medium ${colors.text}`}>{role}</span>
                      <span className="text-sm text-slate-400">{count}</span>
                    </div>
                    <div className="h-2 bg-pink-100 dark:bg-white/5 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${colors.dot}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : tab === 'users' ? (
        <div className="space-y-4">
          {usersActionMsg && (
            <div className="rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 px-4 py-2.5 text-rose-600 dark:text-rose-400 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {usersActionMsg}
              <button onClick={() => setUsersActionMsg('')} className="ml-auto text-rose-400 hover:text-rose-600">×</button>
            </div>
          )}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-pink-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm thành viên..."
              className="w-full pl-12 pr-4 py-3 rounded-xl anime-card text-slate-800 dark:text-white placeholder-slate-400 focus:border-pink-500 outline-none transition-all" />
          </div>
          <div className="anime-card rounded-2xl overflow-hidden overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-pink-200/50 dark:border-fuchsia-500/20 text-left text-xs text-slate-400 uppercase tracking-wider">
                  <th className="px-5 py-3 font-semibold">Thành viên</th>
                  <th className="px-5 py-3 font-semibold">Cấp bậc</th>
                  <th className="px-5 py-3 font-semibold">Ngày tham gia</th>
                  <th className="px-5 py-3 font-semibold text-right">Cấm chat</th>
                  <th className="px-5 py-3 font-semibold text-right">Tài khoản</th>
                  <th className="px-5 py-3 font-semibold text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {sortedMembers.map((m) => {
                  const colors = ROLE_COLORS[m.role];
                  const isSelf = m.id === profile?.id;
                  const muted = isUserMuted(m.muted_until);
                  const busy = mutingId === m.id;
                  const banBusy = banningId === m.id;
                  const canBanThis = canBan && !isSelf && ROLE_RANK[m.role] < ROLE_RANK[profile?.role ?? ''];
                  return (
                    <tr key={m.id} className={`border-b border-pink-100/50 dark:border-fuchsia-500/10 last:border-0 hover:bg-pink-50/50 dark:hover:bg-white/5 ${m.is_banned ? 'opacity-50' : ''}`}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar profile={m} size={36} showBadge />
                          <div>
                            <p className="text-sm font-medium text-slate-800 dark:text-white flex items-center gap-1.5">
                              {m.username}{isSelf && <span className="text-xs text-pink-500">(Bạn)</span>}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3"><span className={`text-xs px-2.5 py-1 rounded-full ${colors.badge}`}>{m.role}</span></td>
                      <td className="px-5 py-3 text-sm text-slate-400">{new Date(m.created_at).toLocaleDateString('vi-VN')}</td>
                      <td className="px-5 py-3 text-right">
                        {muted ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-xs text-rose-500 dark:text-rose-400 flex items-center gap-1 whitespace-nowrap">
                              <VolumeX className="w-3.5 h-3.5" /> Còn {muteRemainingMinutes(m.muted_until)} phút
                            </span>
                            {canMute && !isSelf && (
                              <button onClick={() => unmuteUser(m.id)} disabled={busy}
                                className="text-xs px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 hover:opacity-80 transition-opacity disabled:opacity-40 whitespace-nowrap">
                                {busy ? '...' : 'Bỏ cấm'}
                              </button>
                            )}
                          </div>
                        ) : canMute && !isSelf ? (
                          <button onClick={() => muteUser(m.id)} disabled={busy}
                            className="ml-auto flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 hover:opacity-80 transition-opacity disabled:opacity-40 whitespace-nowrap">
                            <VolumeX className="w-3.5 h-3.5" /> {busy ? 'Đang xử lý...' : 'Cấm chat 60p'}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-300 dark:text-slate-600 flex items-center justify-end gap-1">
                            <Volume2 className="w-3.5 h-3.5" /> —
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {m.is_banned ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-xs text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1 whitespace-nowrap">
                              <ShieldOff className="w-3.5 h-3.5" /> Đã bị cấm
                            </span>
                            {canBan && !isSelf && (
                              <button onClick={() => unbanUser(m)} disabled={banBusy}
                                className="text-xs px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 hover:opacity-80 transition-opacity disabled:opacity-40 whitespace-nowrap">
                                {banBusy ? '...' : 'Bỏ cấm'}
                              </button>
                            )}
                          </div>
                        ) : canBanThis ? (
                          <button onClick={() => banUser(m)} disabled={banBusy}
                            className="ml-auto flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition-colors disabled:opacity-40 whitespace-nowrap font-medium">
                            <ShieldOff className="w-3.5 h-3.5" /> {banBusy ? 'Đang xử lý...' : 'Cấm vĩnh viễn'}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-300 dark:text-slate-600 flex items-center justify-end gap-1">
                            <ShieldCheck className="w-3.5 h-3.5" /> —
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <select value={m.role} disabled={isSelf} onChange={(e) => updateRole(m.id, e.target.value)}
                          className="bg-pink-50 dark:bg-white/5 border border-pink-200 dark:border-fuchsia-500/20 text-slate-800 dark:text-white text-sm rounded-lg px-3 py-1.5 outline-none focus:border-pink-500 disabled:opacity-40 cursor-pointer">
                          {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : tab === 'posts' ? (
        <div className="space-y-4">
          {postsActionMsg && (
            <div className="rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 px-4 py-2.5 text-rose-600 dark:text-rose-400 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {postsActionMsg}
              <button onClick={() => setPostsActionMsg('')} className="ml-auto text-rose-400 hover:text-rose-600">×</button>
            </div>
          )}
          {posts.length === 0 ? (
            <div className="anime-card rounded-2xl p-12 text-center">
              <FileText className="w-12 h-12 text-pink-300 mx-auto mb-4" />
              <p className="text-slate-400">Chưa có bài đăng nào</p>
            </div>
          ) : posts.map((p) => (
            <div key={p.id} className="anime-card rounded-2xl p-4 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-slate-700 dark:text-fuchsia-100/80 text-sm whitespace-pre-wrap">{p.content}</p>
                {p.image_url && <img src={p.image_url} alt="" className="mt-2 w-full max-h-48 object-cover rounded-xl" />}
                <p className="text-xs text-slate-400 mt-2">{new Date(p.created_at).toLocaleString('vi-VN')}</p>
              </div>
              <button onClick={() => deletePost(p.id)} className="text-slate-400 hover:text-rose-400 transition-colors p-2 shrink-0">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      ) : tab === 'chat' ? (
        <div className="space-y-4">
          <div className="anime-card rounded-2xl p-5">
            <h3 className="font-bold anime-text-gradient mb-1">Quản lý tin nhắn chat</h3>
            <p className="text-sm text-slate-400 mb-5">
              Hiện có <span className="font-semibold text-slate-600 dark:text-fuchsia-200">{stats.messages}</span> tin nhắn trong hệ thống (bao gồm phòng chung và tin nhắn riêng).
            </p>

            {chatActionMsg && (
              <div className="mb-4 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 px-4 py-2.5 text-cyan-700 dark:text-cyan-300 text-sm flex items-center gap-2">
                {chatActionMsg}
                <button onClick={() => setChatActionMsg('')} className="ml-auto text-cyan-400 hover:text-cyan-600">×</button>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20">
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-white">Xoá toàn bộ tin nhắn</p>
                  <p className="text-xs text-slate-400 mt-0.5">Xoá vĩnh viễn tất cả tin nhắn trong hệ thống — không thể hoàn tác.</p>
                </div>
                <button onClick={deleteAllMessages} disabled={!canMute || deletingMessages !== null}
                  className="shrink-0 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold disabled:opacity-50 transition-colors">
                  {deletingMessages === 'all' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Xoá tất cả
                </button>
              </div>

              <div className="p-4 rounded-xl bg-pink-50/60 dark:bg-white/5 border border-pink-200 dark:border-fuchsia-500/15">
                <p className="text-sm font-semibold text-slate-700 dark:text-white">Xoá tin nhắn trước một mốc thời gian</p>
                <p className="text-xs text-slate-400 mt-0.5 mb-3">Xoá vĩnh viễn tất cả tin nhắn được gửi trước thời điểm bạn chọn bên dưới.</p>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="datetime-local"
                    value={deleteBefore}
                    onChange={(e) => setDeleteBefore(e.target.value)}
                    className="px-3 py-2.5 rounded-xl bg-white/70 dark:bg-white/5 border border-pink-200 dark:border-fuchsia-500/20 text-sm text-slate-800 dark:text-white outline-none focus:border-pink-500 transition-all"
                  />
                  <button onClick={deleteMessagesBefore} disabled={!canMute || !deleteBefore || deletingMessages !== null}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl anime-btn-primary text-sm font-semibold disabled:opacity-50">
                    {deletingMessages === 'before' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Xoá tin nhắn cũ
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : tab === 'announcements' ? (
        <div className="space-y-4">
          <div className="anime-card rounded-2xl p-5">
            <h3 className="font-bold anime-text-gradient mb-1">Đăng thông báo</h3>
            <p className="text-sm text-slate-400 mb-4">Thông báo sẽ hiện ngay lập tức cho tất cả thành viên qua biểu tượng chuông ở góc phải màn hình.</p>

            {annError && (
              <div className="mb-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 px-4 py-2.5 text-rose-600 dark:text-rose-400 text-sm">
                {annError}
              </div>
            )}

            <div className="space-y-3">
              <input value={annTitle} onChange={(e) => setAnnTitle(e.target.value)} placeholder="Tiêu đề thông báo"
                className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-pink-200 dark:border-fuchsia-500/20 text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:border-pink-500 transition-all" />
              <textarea value={annContent} onChange={(e) => setAnnContent(e.target.value)} rows={3} placeholder="Nội dung thông báo..."
                className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-pink-200 dark:border-fuchsia-500/20 text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:border-pink-500 resize-none transition-all" />
              <button onClick={postAnnouncement} disabled={!annTitle.trim() || !annContent.trim() || posting}
                className="px-5 py-2.5 rounded-xl anime-btn-primary text-sm font-semibold disabled:opacity-50 flex items-center gap-2">
                {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />}
                Đăng thông báo
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {announcements.length === 0 ? (
              <div className="anime-card rounded-2xl p-12 text-center">
                <Megaphone className="w-12 h-12 text-pink-300 mx-auto mb-4" />
                <p className="text-slate-400">Chưa có thông báo nào</p>
              </div>
            ) : announcements.map((a) => (
              <div key={a.id} className="anime-card rounded-2xl p-4 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 dark:text-white">{a.title}</p>
                  <p className="text-sm text-slate-600 dark:text-fuchsia-100/70 mt-1 whitespace-pre-wrap">{a.content}</p>
                  <p className="text-xs text-slate-400 mt-2">{new Date(a.created_at).toLocaleString('vi-VN')}</p>
                </div>
                <button onClick={() => removeAnnouncement(a.id)} disabled={deletingAnnId === a.id}
                  className="text-slate-400 hover:text-rose-400 transition-colors p-2 shrink-0 disabled:opacity-40">
                  {deletingAnnId === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : tab === 'maintenance' ? (
        <div className="space-y-4">
          <div className="anime-card rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-1">
              <h3 className="font-bold anime-text-gradient">Chế độ bảo trì</h3>
              {maintEnabled && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 font-semibold">Đang BẬT</span>
              )}
            </div>
            <p className="text-sm text-slate-400 mb-5">
              Khi bật, chỉ tài khoản cấp <span className="font-medium text-slate-600 dark:text-fuchsia-200">Phó Admin trở lên</span> mới dùng được app — người dùng khác sẽ thấy màn hình "Đang bảo trì" ngay lập tức.
            </p>

            {maintActionMsg && (
              <div className="mb-4 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 px-4 py-2.5 text-cyan-700 dark:text-cyan-300 text-sm flex items-center gap-2">
                {maintActionMsg}
                <button onClick={() => setMaintActionMsg('')} className="ml-auto text-cyan-400 hover:text-cyan-600">×</button>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex items-center justify-between px-4 py-3.5 rounded-xl bg-pink-50/60 dark:bg-white/5 border border-pink-200 dark:border-fuchsia-500/15">
                <div className="flex items-center gap-2.5">
                  <Wrench className="w-4 h-4 text-slate-500 dark:text-fuchsia-200/60" />
                  <span className="text-sm font-medium text-slate-700 dark:text-white">Bật chế độ bảo trì</span>
                </div>
                <button onClick={() => setMaintEnabled((v) => !v)}
                  className={`relative w-11 rounded-full transition-colors ${maintEnabled ? 'bg-amber-500' : 'bg-pink-200 dark:bg-white/10'}`} style={{ height: 24 }}>
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-300 ${maintEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-fuchsia-200/60 mb-1.5 block">Thông báo hiển thị cho người dùng (tuỳ chọn)</label>
                <textarea value={maintMessage} onChange={(e) => setMaintMessage(e.target.value)} rows={3}
                  placeholder="Ví dụ: Chúng mình đang nâng cấp hệ thống, sẽ quay lại sau 30 phút nữa..."
                  className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-pink-200 dark:border-fuchsia-500/20 text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:border-pink-500 resize-none transition-all text-sm" />
              </div>

              <button onClick={saveMaintenance} disabled={savingMaint}
                className="px-5 py-2.5 rounded-xl anime-btn-primary text-sm font-semibold disabled:opacity-50 flex items-center gap-2">
                {savingMaint ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
                Lưu cài đặt
              </button>
            </div>
          </div>
        </div>
      ) : tab === 'shop' ? (
        <div className="space-y-4">
          {shopActionMsg && (
            <div className="rounded-xl bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 px-4 py-2.5 text-cyan-700 dark:text-cyan-300 text-sm flex items-center gap-2">
              {shopActionMsg}
              <button onClick={() => setShopActionMsg('')} className="ml-auto text-cyan-400 hover:text-cyan-600">×</button>
            </div>
          )}

          <div className="flex gap-2 overflow-x-auto pb-1">
            <button onClick={() => setShopSubTab('pending')}
              className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-1.5 whitespace-nowrap transition-all ${shopSubTab === 'pending' ? 'anime-btn-primary text-white' : 'anime-card text-slate-500 dark:text-fuchsia-200/60'}`}>
              <Clock className="w-3.5 h-3.5" /> Chờ duyệt
              {shopListings.some((l) => l.status === 'pending') && <span className="w-2 h-2 rounded-full bg-amber-500" />}
            </button>
            <button onClick={() => setShopSubTab('listings')}
              className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-1.5 whitespace-nowrap transition-all ${shopSubTab === 'listings' ? 'anime-btn-primary text-white' : 'anime-card text-slate-500 dark:text-fuchsia-200/60'}`}>
              <Store className="w-3.5 h-3.5" /> Tất cả tin đăng
            </button>
            <button onClick={() => setShopSubTab('history')}
              className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-1.5 whitespace-nowrap transition-all ${shopSubTab === 'history' ? 'anime-btn-primary text-white' : 'anime-card text-slate-500 dark:text-fuchsia-200/60'}`}>
              <ShoppingCart className="w-3.5 h-3.5" /> Lịch sử giao dịch
            </button>
          </div>

          {shopSubTab === 'pending' ? (
            (() => {
              const pendingListings = shopListings.filter((l) => l.status === 'pending');
              return pendingListings.length === 0 ? (
                <div className="anime-card rounded-2xl p-12 text-center">
                  <CheckCircle2 className="w-12 h-12 text-emerald-300 mx-auto mb-4" />
                  <p className="text-slate-400">Không có tin đăng nào đang chờ duyệt 🎉</p>
                </div>
              ) : pendingListings.map((item) => {
                const busy = reviewingListingId === item.id;
                return (
                  <div key={item.id} className="anime-card rounded-2xl p-4 space-y-3">
                    <div className="flex items-start gap-3 flex-wrap">
                      {item.image_url && <img src={item.image_url} alt="" className="w-16 h-16 rounded-xl object-cover shrink-0" />}
                      <div className="flex items-center gap-2 min-w-[140px]">
                        <Avatar profile={item.profiles ?? null} size={32} />
                        <div>
                          <p className="text-xs text-slate-400">Người đăng</p>
                          <p className="text-sm font-medium text-slate-800 dark:text-white">{item.profiles?.username ?? 'Unknown'}</p>
                        </div>
                      </div>
                      <div className="flex-1 min-w-[160px]">
                        <p className="text-sm font-semibold text-slate-800 dark:text-white">{item.title}</p>
                        {item.description && <p className="text-xs text-slate-500 dark:text-fuchsia-200/60 line-clamp-2 mt-0.5">{item.description}</p>}
                        <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-1"><Coins className="w-3 h-3" /> {item.price_coin.toLocaleString('vi-VN')} coin</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => approveListingItem(item.id)} disabled={busy}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold disabled:opacity-50">
                        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Duyệt (hiện công khai)
                      </button>
                      <button onClick={() => rejectListingItem(item.id)} disabled={busy}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-white/10 hover:opacity-80 text-slate-600 dark:text-slate-300 text-xs font-semibold disabled:opacity-50">
                        <XIcon className="w-3.5 h-3.5" /> Từ chối
                      </button>
                    </div>
                  </div>
                );
              });
            })()
          ) : shopSubTab === 'listings' ? (
            shopListings.length === 0 ? (
              <div className="anime-card rounded-2xl p-12 text-center">
                <Store className="w-12 h-12 text-pink-300 mx-auto mb-4" />
                <p className="text-slate-400">Chưa có tin đăng nào</p>
              </div>
            ) : shopListings.map((item) => {
              const busy = removingListingId === item.id;
              return (
                <div key={item.id} className={`anime-card rounded-2xl p-4 flex items-center gap-3 flex-wrap ${item.status === 'sold' || item.status === 'removed' || item.status === 'rejected' ? 'opacity-60' : ''}`}>
                  {item.image_url && <img src={item.image_url} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0" />}
                  <div className="flex items-center gap-2 min-w-[140px]">
                    <Avatar profile={item.profiles ?? null} size={32} />
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-white">{item.profiles?.username ?? 'Unknown'}</p>
                      <p className="text-xs text-slate-400">{new Date(item.created_at).toLocaleString('vi-VN')}</p>
                    </div>
                  </div>
                  <div className="flex-1 min-w-[160px]">
                    <p className="text-sm font-semibold text-slate-800 dark:text-white line-clamp-1">{item.title}</p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1"><Coins className="w-3 h-3" /> {item.price_coin.toLocaleString('vi-VN')} coin</p>
                  </div>
                  {item.status === 'pending' && <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">Chờ duyệt</span>}
                  {item.status === 'active' && <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">Đang bán</span>}
                  {item.status === 'sold' && <span className="text-xs px-2.5 py-1 rounded-full bg-slate-200 dark:bg-white/10 text-slate-500">Đã bán</span>}
                  {item.status === 'rejected' && <span className="text-xs px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">Bị từ chối</span>}
                  {item.status === 'removed' && <span className="text-xs px-2.5 py-1 rounded-full bg-slate-200 dark:bg-white/10 text-slate-500">Đã ẩn</span>}
                  <button onClick={() => removeListing(item.id)} disabled={busy}
                    className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 hover:opacity-80 text-xs font-semibold disabled:opacity-50">
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Xoá
                  </button>
                </div>
              );
            })
          ) : shopOrders.length === 0 ? (
            <div className="anime-card rounded-2xl p-12 text-center">
              <ShoppingCart className="w-12 h-12 text-pink-300 mx-auto mb-4" />
              <p className="text-slate-400">Chưa có giao dịch nào</p>
            </div>
          ) : shopOrders.map((o) => (
            <div key={o.id} className="anime-card rounded-2xl p-4 flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 min-w-[140px]">
                <Avatar profile={o.buyer ?? null} size={28} />
                <div>
                  <p className="text-xs text-slate-400">Người mua</p>
                  <p className="text-sm font-medium text-slate-800 dark:text-white">{o.buyer?.username ?? 'Unknown'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 min-w-[140px]">
                <Avatar profile={o.seller ?? null} size={28} />
                <div>
                  <p className="text-xs text-slate-400">Người bán</p>
                  <p className="text-sm font-medium text-slate-800 dark:text-white">{o.seller?.username ?? 'Unknown'}</p>
                </div>
              </div>
              <div className="flex-1 min-w-[140px]">
                <p className="text-xs text-slate-400">Sản phẩm</p>
                <p className="text-sm font-semibold text-slate-800 dark:text-white line-clamp-1">{o.shop_listings?.title ?? 'Sản phẩm'}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1"><Coins className="w-3.5 h-3.5" /> {o.price_coin.toLocaleString('vi-VN')}</p>
                <p className="text-xs text-slate-400">{new Date(o.created_at).toLocaleString('vi-VN')}</p>
              </div>
            </div>
          ))}
        </div>
      ) : tab === 'tasks' ? (
        <div className="space-y-4">
          <div className="anime-card rounded-2xl p-5">
            <h3 className="font-bold anime-text-gradient mb-1">Thêm nhiệm vụ mới</h3>
            <p className="text-xs text-slate-400 mb-4">Người dùng bấm vào link nhiệm vụ rồi bấm nhận thưởng để nhận coin (nhận 1 lần duy nhất mỗi nhiệm vụ).</p>

            {taskActionMsg && (
              <div className="mb-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 px-4 py-2.5 text-rose-600 dark:text-rose-400 text-sm">{taskActionMsg}</div>
            )}

            <div className="space-y-3">
              <input value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder="Tên nhiệm vụ (vd: Theo dõi Fanpage)"
                className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-pink-200 dark:border-fuchsia-500/20 text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:border-pink-500 text-sm" />
              <textarea value={newTaskDesc} onChange={(e) => setNewTaskDesc(e.target.value)} rows={2} placeholder="Mô tả (tuỳ chọn)"
                className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-pink-200 dark:border-fuchsia-500/20 text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:border-pink-500 resize-none text-sm" />
              <div className="grid sm:grid-cols-2 gap-3">
                <input value={newTaskLink} onChange={(e) => setNewTaskLink(e.target.value)} placeholder="Link nhiệm vụ (https://...)"
                  className="px-4 py-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-pink-200 dark:border-fuchsia-500/20 text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:border-pink-500 text-sm" />
                <input value={newTaskReward} onChange={(e) => setNewTaskReward(e.target.value)} type="number" placeholder="Thưởng (coin)"
                  className="px-4 py-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-pink-200 dark:border-fuchsia-500/20 text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:border-pink-500 text-sm" />
              </div>
              <button onClick={addTask} disabled={!newTaskTitle.trim() || !newTaskLink.trim() || savingTask}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl anime-btn-primary text-sm font-semibold disabled:opacity-50">
                {savingTask ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Thêm nhiệm vụ
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {taskList.length === 0 ? (
              <div className="anime-card rounded-2xl p-12 text-center">
                <ListChecks className="w-12 h-12 text-pink-300 mx-auto mb-4" />
                <p className="text-slate-400">Chưa có nhiệm vụ nào</p>
              </div>
            ) : taskList.map((task) => (
              <div key={task.id} className={`anime-card rounded-2xl p-4 flex items-center gap-3 flex-wrap ${!task.active ? 'opacity-50' : ''}`}>
                <div className="flex-1 min-w-[180px]">
                  <p className="font-medium text-slate-800 dark:text-white">{task.title}</p>
                  <a href={task.link} target="_blank" rel="noopener noreferrer" className="text-xs text-pink-500 hover:underline flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" /> {task.link}
                  </a>
                  <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-1"><Coins className="w-3 h-3" /> {task.reward_coin.toLocaleString('vi-VN')} coin</p>
                </div>
                <button onClick={() => toggleTaskActive(task)}
                  className="text-xs px-2.5 py-1 rounded-lg bg-pink-100 dark:bg-white/10 text-pink-600 dark:text-fuchsia-300 hover:opacity-80">
                  {task.active ? 'Đang bật' : 'Đã tắt'}
                </button>
                <button onClick={() => removeTask(task.id)} className="text-slate-400 hover:text-rose-400 p-1.5">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : tab === 'topup' && !canTopup ? (
        <div className="max-w-md mx-auto text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-slate-400" />
          </div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Chỉ Sáng lập viên mới truy cập được</h2>
          <p className="text-slate-400 text-sm">Mục Nạp tiền được giới hạn quyền truy cập cho tài khoản cấp Sáng lập viên.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {topupMsg && (
            <div className="rounded-xl bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 px-4 py-2.5 text-cyan-700 dark:text-cyan-300 text-sm flex items-center gap-2">
              {topupMsg}
              <button onClick={() => setTopupMsg('')} className="ml-auto text-cyan-400 hover:text-cyan-600">×</button>
            </div>
          )}

          <div className="flex gap-2 overflow-x-auto pb-1">
            {([
              { id: 'orders', label: 'Đơn nạp tiền' },
              { id: 'packages', label: 'Gói nạp' },
              { id: 'prices', label: 'Giá cấp bậc' },
              { id: 'bank', label: 'Ngân hàng' },
            ] as const).map((t) => (
              <button key={t.id} onClick={() => setTopupTab(t.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${topupTab === t.id ? 'anime-btn-primary text-white' : 'anime-card text-slate-500 dark:text-fuchsia-200/60 hover:text-pink-500'}`}>
                {t.label}
              </button>
            ))}
          </div>

          {topupTab === 'orders' && (
            <div className="space-y-3">
              {orders.length === 0 ? (
                <div className="anime-card rounded-2xl p-12 text-center">
                  <Coins className="w-12 h-12 text-pink-300 mx-auto mb-4" />
                  <p className="text-slate-400">Chưa có đơn nạp tiền nào</p>
                </div>
              ) : orders.map((o) => {
                const busy = processingOrderId === o.id;
                return (
                  <div key={o.id} className="anime-card rounded-2xl p-4 flex items-center gap-3 flex-wrap">
                    <Avatar profile={o.profiles ?? null} size={36} />
                    <div className="flex-1 min-w-[160px]">
                      <p className="text-sm font-medium text-slate-800 dark:text-white">{o.profiles?.username ?? 'Unknown'}</p>
                      <p className="text-xs text-slate-400">{new Date(o.created_at).toLocaleString('vi-VN')}</p>
                    </div>
                    <div className="text-sm text-right">
                      <p className="font-semibold text-slate-800 dark:text-white">{o.amount_vnd.toLocaleString('vi-VN')}đ</p>
                      <p className="text-emerald-500 text-xs">+{o.coins.toLocaleString('vi-VN')} coin</p>
                    </div>
                    <span className="text-xs font-mono px-2 py-1 rounded-lg bg-pink-100 dark:bg-white/10 text-pink-600 dark:text-fuchsia-300">{orderMemo(o.id)}</span>
                    {o.status === 'pending' ? (
                      <div className="flex items-center gap-2 ml-auto">
                        <button onClick={() => confirmOrder(o.id)} disabled={busy}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold disabled:opacity-50">
                          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Xác nhận
                        </button>
                        <button onClick={() => cancelOrder(o.id)} disabled={busy}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-white/10 hover:opacity-80 text-slate-600 dark:text-slate-300 text-xs font-semibold disabled:opacity-50">
                          <XIcon className="w-3.5 h-3.5" /> Huỷ
                        </button>
                      </div>
                    ) : o.status === 'completed' ? (
                      <span className="ml-auto text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Hoàn tất</span>
                    ) : (
                      <span className="ml-auto text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400 flex items-center gap-1"><XCircle className="w-3 h-3" /> Đã huỷ</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {topupTab === 'packages' && (
            <div className="space-y-4">
              <div className="anime-card rounded-2xl p-5">
                <h3 className="font-bold anime-text-gradient mb-4">Thêm gói nạp mới</h3>
                <div className="grid sm:grid-cols-3 gap-3 mb-3">
                  <input value={newPkgName} onChange={(e) => setNewPkgName(e.target.value)} placeholder="Tên gói"
                    className="px-4 py-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-pink-200 dark:border-fuchsia-500/20 text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:border-pink-500 text-sm" />
                  <input value={newPkgAmount} onChange={(e) => setNewPkgAmount(e.target.value)} type="number" placeholder="Số tiền (VNĐ)"
                    className="px-4 py-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-pink-200 dark:border-fuchsia-500/20 text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:border-pink-500 text-sm" />
                  <input value={newPkgCoins} onChange={(e) => setNewPkgCoins(e.target.value)} type="number" placeholder="Số coin nhận được"
                    className="px-4 py-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-pink-200 dark:border-fuchsia-500/20 text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:border-pink-500 text-sm" />
                </div>
                <button onClick={addPackage} disabled={savingPkg}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl anime-btn-primary text-sm font-semibold disabled:opacity-50">
                  {savingPkg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Thêm gói
                </button>
              </div>

              <div className="space-y-2">
                {coinPackages.map((pkg) => (
                  <div key={pkg.id} className={`anime-card rounded-2xl p-4 flex items-center gap-3 ${!pkg.active ? 'opacity-50' : ''}`}>
                    <div className="flex-1">
                      <p className="font-medium text-slate-800 dark:text-white">{pkg.name}</p>
                      <p className="text-xs text-slate-400">{pkg.amount_vnd.toLocaleString('vi-VN')}đ → +{pkg.coins.toLocaleString('vi-VN')} coin</p>
                    </div>
                    <button onClick={() => togglePackageActive(pkg)}
                      className="text-xs px-2.5 py-1 rounded-lg bg-pink-100 dark:bg-white/10 text-pink-600 dark:text-fuchsia-300 hover:opacity-80">
                      {pkg.active ? 'Đang bán' : 'Đã ẩn'}
                    </button>
                    <button onClick={() => removePackage(pkg.id)} className="text-slate-400 hover:text-rose-400 p-1.5">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {topupTab === 'prices' && (
            <div className="space-y-4">
              <div className="anime-card rounded-2xl p-5">
                <h3 className="font-bold anime-text-gradient mb-1">Thêm / sửa giá cấp bậc</h3>
                <p className="text-xs text-slate-400 mb-4">Không giới hạn cấp bậc theo cấu hình bạn đã chọn — hãy cân nhắc kỹ trước khi mở bán các cấp có quyền quản trị.</p>
                <div className="grid sm:grid-cols-3 gap-3 mb-3">
                  <select value={newPriceRole} onChange={(e) => setNewPriceRole(e.target.value)}
                    className="px-4 py-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-pink-200 dark:border-fuchsia-500/20 text-slate-800 dark:text-white outline-none focus:border-pink-500 text-sm">
                    <option value="">-- Chọn cấp bậc --</option>
                    {ALL_ROLES.filter((r) => r !== 'Nô lệ').map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <input value={newPriceCost} onChange={(e) => setNewPriceCost(e.target.value)} type="number" placeholder="Giá (coin)"
                    className="px-4 py-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-pink-200 dark:border-fuchsia-500/20 text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:border-pink-500 text-sm" />
                  <button onClick={addOrUpdatePrice} disabled={savingPrice || !newPriceRole}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl anime-btn-primary text-sm font-semibold disabled:opacity-50">
                    {savingPrice ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Lưu
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {rolePrices.map((rp) => {
                  const colors = ROLE_COLORS[rp.role];
                  return (
                    <div key={rp.role} className={`anime-card rounded-2xl p-4 flex items-center gap-3 ${!rp.enabled ? 'opacity-50' : ''}`}>
                      <span className={`text-sm px-2.5 py-1 rounded-full ${colors.badge}`}>{rp.role}</span>
                      <span className="text-sm font-semibold text-slate-700 dark:text-white flex-1">{rp.coin_cost.toLocaleString('vi-VN')} coin</span>
                      <button onClick={() => togglePriceEnabled(rp)}
                        className="text-xs px-2.5 py-1 rounded-lg bg-pink-100 dark:bg-white/10 text-pink-600 dark:text-fuchsia-300 hover:opacity-80">
                        {rp.enabled ? 'Đang mở bán' : 'Đã tắt'}
                      </button>
                      <button onClick={() => removePrice(rp.role)} className="text-slate-400 hover:text-rose-400 p-1.5">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {topupTab === 'bank' && (
            <div className="anime-card rounded-2xl p-5">
              <h3 className="font-bold anime-text-gradient mb-1 flex items-center gap-2"><Landmark className="w-4 h-4" /> Tài khoản ngân hàng nhận tiền</h3>
              <p className="text-xs text-slate-400 mb-4">Dùng để tạo mã QR VietQR cho người dùng chuyển khoản.</p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-500 dark:text-fuchsia-200/60 mb-1 block">Mã BIN ngân hàng (VietQR)</label>
                  <input value={bankBin} onChange={(e) => setBankBin(e.target.value)} placeholder="Ví dụ: 970436 (Vietcombank)"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-pink-200 dark:border-fuchsia-500/20 text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:border-pink-500 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 dark:text-fuchsia-200/60 mb-1 block">Số tài khoản</label>
                  <input value={bankAccountNo} onChange={(e) => setBankAccountNo(e.target.value)} placeholder="0123456789"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-pink-200 dark:border-fuchsia-500/20 text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:border-pink-500 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 dark:text-fuchsia-200/60 mb-1 block">Tên chủ tài khoản (không dấu)</label>
                  <input value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value.toUpperCase())} placeholder="NGUYEN VAN A"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-pink-200 dark:border-fuchsia-500/20 text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:border-pink-500 text-sm" />
                </div>
                <button onClick={saveBank} disabled={savingBank}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl anime-btn-primary text-sm font-semibold disabled:opacity-50">
                  {savingBank ? <Loader2 className="w-4 h-4 animate-spin" /> : <Landmark className="w-4 h-4" />} Lưu thông tin
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <div className="anime-card rounded-2xl p-5">
      <Icon className="w-6 h-6 text-pink-500 mb-3" />
      <p className="text-3xl font-bold text-slate-800 dark:text-white">{value}</p>
      <p className="text-sm text-slate-400 mt-1">{label}</p>
    </div>
  );
}
