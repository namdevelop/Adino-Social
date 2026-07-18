import { supabase } from './supabase';
import type { ShopListing, ShopOrder } from './types';

function asError(error: unknown, fallback: string): Error {
  if (error instanceof Error) return error;
  const anyErr = error as any;
  const msg = anyErr?.message || anyErr?.error_description || anyErr?.hint || anyErr?.details || fallback;
  return new Error(String(msg));
}

// ---------- Listings ----------
export async function listShopListings(): Promise<ShopListing[]> {
  const { data, error } = await supabase
    .from('shop_listings')
    .select('*, profiles:seller_id(*)')
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  if (error) throw asError(error, 'Không thể tải danh sách tin đăng');
  return (data as ShopListing[]) ?? [];
}

export async function listAllShopListings(): Promise<ShopListing[]> {
  const { data, error } = await supabase
    .from('shop_listings')
    .select('*, profiles:seller_id(*)')
    .order('created_at', { ascending: false });
  if (error) throw asError(error, 'Không thể tải danh sách tin đăng');
  return (data as ShopListing[]) ?? [];
}

export async function listMyListings(userId: string): Promise<ShopListing[]> {
  const { data, error } = await supabase
    .from('shop_listings')
    .select('*')
    .eq('seller_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw asError(error, 'Không thể tải tin đăng của bạn');
  return (data as ShopListing[]) ?? [];
}

export async function createShopListing(opts: {
  title: string;
  description: string;
  priceCoin: number;
  imageUrl: string;
  productLink: string;
}): Promise<ShopListing> {
  const { data, error } = await supabase.rpc('create_shop_listing', {
    p_title: opts.title,
    p_description: opts.description,
    p_price_coin: opts.priceCoin,
    p_image_url: opts.imageUrl,
    p_product_link: opts.productLink,
  });
  if (error) throw asError(error, 'Không thể đăng bán');
  return data as ShopListing;
}

export async function deleteListing(id: string): Promise<void> {
  const { error } = await supabase.from('shop_listings').delete().eq('id', id);
  if (error) throw asError(error, 'Không thể xoá tin đăng');
}

// ---------- Admin duyệt TIN ĐĂNG (trước khi tin lên sàn) ----------
export async function adminApproveListing(listingId: string): Promise<ShopListing> {
  const { data, error } = await supabase.rpc('admin_approve_listing', { p_listing_id: listingId });
  if (error) throw asError(error, 'Không thể duyệt tin đăng');
  return data as ShopListing;
}

export async function adminRejectListing(listingId: string): Promise<ShopListing> {
  const { data, error } = await supabase.rpc('admin_reject_listing', { p_listing_id: listingId });
  if (error) throw asError(error, 'Không thể từ chối tin đăng');
  return data as ShopListing;
}

// ---------- Mua hàng — mua xong nhận link ngay, không cần duyệt đơn ----------
export async function purchaseListing(listingId: string): Promise<ShopOrder> {
  const { data, error } = await supabase.rpc('purchase_listing', { p_listing_id: listingId });
  if (error) throw asError(error, 'Không thể mua sản phẩm');
  return data as ShopOrder;
}

export async function listMyPurchases(buyerId: string): Promise<ShopOrder[]> {
  const { data, error } = await supabase
    .from('shop_orders')
    .select('*, shop_listings(*)')
    .eq('buyer_id', buyerId)
    .order('created_at', { ascending: false });
  if (error) throw asError(error, 'Không thể tải đơn mua của bạn');
  return (data as ShopOrder[]) ?? [];
}

export async function listAllOrdersForAdmin(): Promise<ShopOrder[]> {
  const { data, error } = await supabase
    .from('shop_orders')
    .select('*, shop_listings(*), buyer:buyer_id(*), seller:seller_id(*)')
    .order('created_at', { ascending: false });
  if (error) throw asError(error, 'Không thể tải lịch sử giao dịch');
  return (data as ShopOrder[]) ?? [];
}
