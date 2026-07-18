export interface Profile {
  id: string;
  username: string;
  role: string;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  muted_until: string | null;
  is_banned: boolean;
  coins: number;
}

export interface Post {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  profiles?: Profile | null;
  like_count?: number;
  comment_count?: number;
  liked_by_me?: boolean;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: Profile | null;
}

export interface ChatMessage {
  id: string;
  sender_id: string;
  recipient_id: string | null;
  room_type: 'global' | 'direct';
  content: string;
  created_at: string;
}

export interface Track {
  id: string;
  title: string;
  artist: string | null;
  file_url: string;
  storage_path: string;
  created_by: string | null;
  created_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  created_by: string | null;
  created_at: string;
}

export interface AppSettings {
  id: number;
  maintenance_mode: boolean;
  maintenance_message: string | null;
  updated_by: string | null;
  updated_at: string;
  bank_bin: string | null;
  bank_account_no: string | null;
  bank_account_name: string | null;
}

export interface CoinPackage {
  id: string;
  name: string;
  amount_vnd: number;
  coins: number;
  active: boolean;
  sort_order: number;
  created_at: string;
}

export interface TopupOrder {
  id: string;
  user_id: string;
  package_id: string | null;
  amount_vnd: number;
  coins: number;
  status: 'pending' | 'completed' | 'cancelled';
  confirmed_by: string | null;
  created_at: string;
  completed_at: string | null;
  profiles?: Profile | null;
}

export interface RolePrice {
  role: string;
  coin_cost: number;
  enabled: boolean;
  updated_at: string;
}

export interface ShopListing {
  id: string;
  seller_id: string;
  title: string;
  description: string | null;
  price_coin: number;
  image_url: string | null;
  status: 'pending' | 'active' | 'sold' | 'removed' | 'rejected';
  created_at: string;
  profiles?: Profile | null;
}

export interface ShopOrder {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  price_coin: number;
  status: 'pending' | 'approved' | 'rejected';
  product_link: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  shop_listings?: ShopListing | null;
  buyer?: Profile | null;
  seller?: Profile | null;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  link: string;
  reward_coin: number;
  active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface TaskCompletion {
  id: string;
  task_id: string;
  user_id: string;
  completed_at: string;
}
