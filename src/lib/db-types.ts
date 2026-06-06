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
  report_whatsapp: string | null;
}

export interface DbCategory {
  id: string;
  restaurant_id: string;
  name: LS;
  icon: string | null;
  image_url: string | null;
  order_index: number;
  parent_id?: string | null;
}

export interface DbModifier {
  id: string;
  restaurant_id: string;
  category_id: string | null;
  product_id: string | null;
  name: string;
  price: number;
  order_index: number;
  is_active: boolean;
  created_at: string;
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
  allergens: string[] | null;
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
  customer_city: string | null;
  delivery_address: string | null;
  created_at: string;
  payment_method: string | null;
  payment_details: Record<string, number> | null;
  paid_amount: number | null;
  prepayment_method: string | null;
  closed_at: string | null;
  opened_by: string | null;
  tips_amount: number | null;
}

export interface DbWaiterShiftRevenue {
  id: string;
  shift_id: string;
  waiter_id: string;
  cash_amount: number;
  card_amount: number;
  total_amount: number;
  orders_count: number;
  created_at: string;
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
  description: string | null;
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
  assigned_waiter_id: string | null;
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

export interface DbShift {
  id: string;
  restaurant_id: string;
  opened_at: string;
  opened_by: string | null;
  closed_at: string | null;
  status: "open" | "closed";
  total_revenue: number | null;
  orders_count: number | null;
  revenue_by_type: Record<string, number> | null;
  revenue_by_payment: Record<string, number> | null;
  prepayments_total: number | null;
  created_at: string;
}

export interface DbShiftCheckin {
  id: string;
  shift_id: string;
  staff_user_id: string;
  restaurant_id: string;
  checked_in_at: string;
  checked_out_at: string | null;
  created_at: string;
}

export interface DbInvoice {
  id: string;
  restaurant_id: string;
  invoice_number: string | null;
  supplier_name: string;
  total_amount: number;
  created_at: string;
  created_by: string | null;
}

export interface DbInvoiceItem {
  id: string;
  invoice_id: string;
  item_name: string;
  quantity: number;
  unit: string;
  price_per_unit: number;
  total_item_price: number;
}

export interface DbCrmClient {
  id: string;
  restaurant_id: string;
  phone: string | null;
  name: string | null;
  push_subscription: Record<string, unknown> | null;
  created_at: string;
  last_visit: string;
}

export interface DbIngredient {
  id: string;
  restaurant_id: string;
  name: string;
  unit: "kg" | "liter" | "pcs";
  current_stock: number;
  purchase_price: number;
  created_at: string;
}

export interface DbRecipeItem {
  id: string;
  product_id: string;
  ingredient_id: string;
  weight_gross: number;
  weight_net: number;
  created_at: string;
}

export interface DbStockMovement {
  id: string;
  restaurant_id: string;
  ingredient_id: string;
  amount: number;
  type: "sale" | "waste" | "supply";
  order_id: string | null;
  notes: string | null;
  created_at: string;
  ingredients?: { name: string; unit: string } | null;
}
