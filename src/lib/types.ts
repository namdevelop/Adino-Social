export interface Profile {
  id: string;
  username: string;
  role: string;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  muted_until: string | null;
  is_banned: boolean;
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
