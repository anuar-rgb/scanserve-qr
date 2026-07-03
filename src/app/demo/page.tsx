import { MenuTemplate, type HeroBanner, type HeroSlide, type MenuCategory, type RestaurantInfo } from "@/components/MenuTemplate";

export const metadata = {
  title: "ScanServe Demo — Интерактивное демо меню",
  description: "Попробуйте QR-меню ScanServe. Листайте категории, добавляйте в корзину, смотрите как работает платформа.",
};

const DEMO_RESTAURANT: RestaurantInfo = {
  name: "ScanServe Demo",
  address: { en: "Demo mode", ru: "Демо режим", kz: "Демо режимі" },
  currency: "₸",
  phone: "",
  kaspiPhone: "",
  whatsappPhone: "",
  instagramUrl: "",
  description: {
    en: "Interactive demo of the ScanServe platform. Browse categories, add dishes to cart and experience the full guest menu.",
    ru: "Интерактивное демо платформы ScanServe. Листайте категории, добавляйте блюда в корзину и оцените полный функционал гостевого меню.",
    kz: "ScanServe платформасының интерактивті демосы. Санаттарды шолып, себетке қосып, толық функционалды сезініңіз.",
  },
  cardTransferOptions: [],
  workingHours: "10:00 – 23:00",
};

const HERO: HeroBanner = {
  imageUrl: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80",
  title: "ScanServe Demo",
  subtitle: { en: "Interactive menu — try everything", ru: "Интерактивное меню — попробуйте всё", kz: "Интерактивті мәзір — бәрін сынап көріңіз" },
};

const HERO_SLIDES: HeroSlide[] = [
  {
    id: "ds1", type: "image",
    url: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80",
    title: "Свежо и вкусно",
    description: "Листайте наше меню",
    tags: [{ text: "DEMO", color: "purple" }],
  },
  {
    id: "ds2", type: "image",
    url: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80",
    title: "Премиальный опыт",
    description: "QR-меню для вашего ресторана",
    tags: [{ text: "ScanServe", color: "blue" }],
  },
  {
    id: "ds3", type: "image",
    url: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=80",
    title: "Заказывайте легко",
    description: "Без приложения — просто сканируйте",
    tags: [{ text: "NO APP", color: "green" }],
  },
];

const CATEGORIES: MenuCategory[] = [
  {
    id: "dc1",
    icon: "🍲",
    name: { en: "Hot dishes", ru: "Горячие блюда", kz: "Ыстық тағамдар" },
    imageUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=300&h=300&fit=crop&q=80",
    dishes: [
      {
        id: "d1", emoji: "🥩",
        name: { en: "Beef steak", ru: "Стейк из говядины", kz: "Сиыр еті стейкі" },
        desc: { en: "Juicy ribeye with herbs and garlic butter", ru: "Сочный рибай с травами и чесночным маслом", kz: "Шөпті және сарымсақ майымен шырынды рибай" },
        price: 6800, imageUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=600&h=400&fit=crop&q=80",
        isPopular: true,
      },
      {
        id: "d2", emoji: "🍖",
        name: { en: "Lamb ribs", ru: "Рёбра ягнёнка", kz: "Қозы қабырғасы" },
        desc: { en: "Slow-roasted ribs with smoky sauce", ru: "Рёбра медленной обжарки с дымным соусом", kz: "Баяу қуырылған қабырға шөмен соусымен" },
        price: 4900, imageUrl: "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=600&h=400&fit=crop&q=80",
        isNew: true,
      },
      {
        id: "d3", emoji: "🍜",
        name: { en: "Tom Yum soup", ru: "Суп Том Ям", kz: "Том Ям сорпасы" },
        desc: { en: "Classic Thai soup with shrimps and coconut milk", ru: "Классический тайский суп с креветками и кокосовым молоком", kz: "Креветкалы және кокос сүтімен классикалық тай сорпасы" },
        price: 3200, imageUrl: "https://images.unsplash.com/photo-1547592180-85f173990554?w=600&h=400&fit=crop&q=80",
        isSpicy: true, badge: "HOT", isPopular: true,
      },
      {
        id: "d4", emoji: "🍗",
        name: { en: "Chicken in cream", ru: "Курица в сливках", kz: "Кремдегі тауық" },
        desc: { en: "Tender chicken breast with mushrooms in cream sauce", ru: "Нежная куриная грудка с грибами в сливочном соусе", kz: "Саңырауқұлақты кремді соустағы жұмсақ тауық төсі" },
        price: 2800, imageUrl: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&h=400&fit=crop&q=80",
      },
    ],
  },
  {
    id: "dc2",
    icon: "🥗",
    name: { en: "Salads", ru: "Салаты", kz: "Салаттар" },
    imageUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=300&h=300&fit=crop&q=80",
    dishes: [
      {
        id: "d5", emoji: "🥗",
        name: { en: "Caesar salad", ru: "Цезарь с курицей", kz: "Цезарь салаты" },
        desc: { en: "Romaine, parmesan, croutons, Caesar dressing", ru: "Романо, пармезан, крутоны, соус Цезарь", kz: "Романо, пармезан, қытырлақ нан, Цезарь соусы" },
        price: 2400, imageUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&h=400&fit=crop&q=80",
        isPopular: true,
      },
      {
        id: "d6", emoji: "🍅",
        name: { en: "Greek salad", ru: "Греческий салат", kz: "Грек салаты" },
        desc: { en: "Tomato, cucumber, feta, olives, olive oil", ru: "Томат, огурец, фета, оливки, оливковое масло", kz: "Қызанақ, қияр, фета, зәйтүн, зәйтүн майы" },
        price: 2100, imageUrl: "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=600&h=400&fit=crop&q=80",
      },
      {
        id: "d7", emoji: "🐟",
        name: { en: "Tuna salad", ru: "Салат с тунцом", kz: "Тунец салаты" },
        desc: { en: "Fresh tuna, avocado, cherry tomatoes", ru: "Свежий тунец, авокадо, черри", kz: "Жаңа тунец, авокадо, черри қызанақ" },
        price: 3100, imageUrl: "https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=600&h=400&fit=crop&q=80",
        isNew: true, badge: "NEW",
      },
    ],
  },
  {
    id: "dc3",
    icon: "🍕",
    name: { en: "Pizza", ru: "Пицца", kz: "Пицца" },
    imageUrl: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=300&h=300&fit=crop&q=80",
    dishes: [
      {
        id: "d8", emoji: "🍕",
        name: { en: "Margherita", ru: "Маргарита", kz: "Маргарита" },
        desc: { en: "Tomato sauce, mozzarella, fresh basil", ru: "Томатный соус, моцарелла, свежий базилик", kz: "Қызанақ соусы, моцарелла, жаңа базилик" },
        price: 2600, imageUrl: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&h=400&fit=crop&q=80",
        isPopular: true,
      },
      {
        id: "d9", emoji: "🌶️",
        name: { en: "Pepperoni", ru: "Пепперони", kz: "Пепперони" },
        desc: { en: "Spicy pepperoni, mozzarella, tomato", ru: "Острое пепперони, моцарелла, томат", kz: "Ащы пепперони, моцарелла, қызанақ" },
        price: 3100, imageUrl: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600&h=400&fit=crop&q=80",
        isSpicy: true, isPopular: true,
      },
      {
        id: "d10", emoji: "🍗",
        name: { en: "BBQ Chicken", ru: "Барбекю с курицей", kz: "Барбекю тауық" },
        desc: { en: "BBQ sauce, chicken, red onion, bell pepper", ru: "Соус барбекю, курица, красный лук, перец", kz: "Барбекю соусы, тауық, қызыл пияз, бұрыш" },
        price: 3400, imageUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&h=400&fit=crop&q=80",
        isNew: true,
      },
    ],
  },
  {
    id: "dc4",
    icon: "🍰",
    name: { en: "Desserts", ru: "Десерты", kz: "Тәттілер" },
    imageUrl: "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=300&h=300&fit=crop&q=80",
    dishes: [
      {
        id: "d11", emoji: "🍰",
        name: { en: "Cheesecake", ru: "Чизкейк", kz: "Чизкейк" },
        desc: { en: "Classic NY cheesecake with berry coulis", ru: "Классический NY чизкейк с ягодным кули", kz: "Классикалық NY чизкейк жидек кулисімен" },
        price: 1600, imageUrl: "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=600&h=400&fit=crop&q=80",
        isPopular: true,
      },
      {
        id: "d12", emoji: "☕",
        name: { en: "Tiramisu", ru: "Тирамису", kz: "Тирамису" },
        desc: { en: "Italian classic with mascarpone and espresso", ru: "Итальянская классика с маскарпоне и эспрессо", kz: "Маскарпоне мен эспрессомен итальяндық классика" },
        price: 1800, imageUrl: "https://images.unsplash.com/photo-1568051243851-f9b136146e97?w=600&h=400&fit=crop&q=80",
      },
    ],
  },
  {
    id: "dc5",
    icon: "🍹",
    name: { en: "Drinks", ru: "Напитки", kz: "Сусындар" },
    imageUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=300&h=300&fit=crop&q=80",
    dishes: [
      {
        id: "d13", emoji: "🍋",
        name: { en: "Fresh lemonade", ru: "Свежий лимонад", kz: "Жаңа лимонад" },
        desc: { en: "Lemon, mint, sugar, sparkling water", ru: "Лимон, мята, сахар, газированная вода", kz: "Лимон, жалбыз, қант, газды су" },
        price: 900, imageUrl: "https://images.unsplash.com/photo-1609951651556-5334e2706168?w=600&h=400&fit=crop&q=80",
        isPopular: true,
      },
      {
        id: "d14", emoji: "☕",
        name: { en: "Cappuccino", ru: "Капучино", kz: "Капучино" },
        desc: { en: "Double espresso with steamed milk foam", ru: "Двойной эспрессо с молочной пенкой", kz: "Сүт көбігімен қос эспрессо" },
        price: 1100, imageUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&h=400&fit=crop&q=80",
        isPopular: true,
      },
      {
        id: "d15", emoji: "🥭",
        name: { en: "Mango smoothie", ru: "Манго смузи", kz: "Манго смузи" },
        desc: { en: "Fresh mango, banana, coconut milk", ru: "Свежее манго, банан, кокосовое молоко", kz: "Жаңа манго, банан, кокос сүті" },
        price: 1300, imageUrl: "https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=600&h=400&fit=crop&q=80",
        isNew: true, badge: "NEW",
      },
    ],
  },
];

export default function DemoPage() {
  return (
    <MenuTemplate
      restaurant={DEMO_RESTAURANT}
      categories={CATEGORIES}
      lang="ru"
      heroBanner={HERO}
      heroSlides={HERO_SLIDES}
      banners={[]}
      showcaseItems={[
        { id: "sc1", emoji: "🎯", title: { en: "Full demo", ru: "Полный демо", kz: "Толық демо" } },
        { id: "sc2", emoji: "🛒", title: { en: "Add to cart", ru: "Корзина работает", kz: "Себет жұмыс істейді" } },
        { id: "sc3", emoji: "📱", title: { en: "Mobile-first", ru: "Для телефона", kz: "Телефонға" } },
        { id: "sc4", emoji: "🌙", title: { en: "Dark mode", ru: "Тёмная тема", kz: "Күңгірт тақырып" } },
        { id: "sc5", emoji: "🌍", title: { en: "3 languages", ru: "3 языка", kz: "3 тіл" } },
      ]}
      restaurantTables={[]}
      restaurantId="demo"
      ads={[]}
      happyHours={[]}
    />
  );
}
