export interface LS { en: string; ru: string; kz: string; }

export interface DbRestaurant {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  logo: string | null;
  wa_number: string | null;
  primary_color: string | null;
  instagram_url: string | null;
  phone: string | null;
  address: string | null;
  working_hours: string | null;
}

export interface DbCategory {
  id: string;
  restaurant_id: string;
  name: LS;
  icon: string | null;
  image_url: string | null;
  order_index: number;
}

export interface DbProduct {
  id: string;
  category_id: string;
  restaurant_id: string;
  name: LS;
  description: LS | null;
  price: number;
  image_url: string | null;
  emoji: string | null;
  badge: string | null;
  is_new: boolean;
  is_popular: boolean;
  is_spicy: boolean;
  is_available: boolean;
  is_archived: boolean;
  is_promo: boolean;
  is_recommended: boolean;
  order_index: number;
  discount_label: string | null;
  ingredients: string | null;
  badge_color: string | null;
}

export interface DbBanner {
  id: string;
  restaurant_id: string;
  image_url: string | null;
  title: LS;
  subtitle: LS | null;
  link_url: string | null;
  is_active: boolean;
  order_index: number;
  created_at: string;
}

export interface DbOrder {
  id: string;
  restaurant_id: string;
  table_number: string | null;
  items_json: unknown;
  total_price: number;
  status: string;
  type: string;
  order_type: "asap" | "preorder" | null;
  preorder_date: string | null;
  preorder_time: string | null;
  customer_comments: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  created_at: string;
  payment_method: string | null;
  payment_details: Record<string, number> | null;
  closed_at: string | null;
}

export interface DbReview {
  id: string;
  restaurant_id: string;
  order_id: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
}

export type TagColor = string;
export type SlideTag = { text: string; color: TagColor };

export interface DbHeroSlide {
  id: string;
  restaurant_id: string;
  type: "image" | "video";
  url: string;
  title: string | null;
  description: string | null;
  tags: SlideTag[] | null;
  order_index: number;
  is_active: boolean;
  created_at: string;
}

export interface DbInfoShowcase {
  id: string;
  restaurant_id: string;
  title: LS;
  emoji: string;
  order_index: number;
  is_active: boolean;
  created_at: string;
}

export interface DbRestaurantTable {
  id: string;
  restaurant_id: string;
  label: string;
  seats: number;
  is_active: boolean;
  created_at: string;
}

export interface DbPaymentBank {
  id: string;
  restaurant_id: string;
  bank_name: string;
  phone: string;
  recipient_name: string | null;
  is_active: boolean;
  order_index: number;
  created_at: string;
}
