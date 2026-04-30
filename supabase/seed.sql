-- =============================================================================
-- ScanServe — Real Menu Seed  (supabase/seed.sql)
-- Run in: Supabase Dashboard → SQL Editor → New query
-- Replaces ALL existing demo data with the actual restaurant menu.
-- 30 categories · 302 products · prices in tenge (integer)
-- =============================================================================

DO $$
DECLARE
  rid         UUID;
  c_zavtraki  UUID;  c_kashi     UUID;  c_salaty    UUID;  c_supy      UUID;
  c_fastfood  UUID;  c_narezki   UUID;  c_pasta     UUID;  c_sousy     UUID;
  c_garniry   UUID;  c_hleb      UUID;  c_vostok    UUID;  c_pizza     UUID;
  c_ryba      UUID;  c_kazah     UUID;  c_goryachie UUID;  c_gril      UUID;
  c_banket    UUID;  c_shashlyk  UUID;  c_sadj      UUID;  c_rolly     UUID;
  c_sety      UUID;  c_tempura   UUID;  c_chay      UUID;  c_limon1    UUID;
  c_limon05   UUID;  c_napitki   UUID;  c_deserty   UUID;  c_kofe      UUID;
  c_kokteyly  UUID;  c_siropy    UUID;
BEGIN
  SELECT id INTO rid FROM restaurants LIMIT 1;
  IF rid IS NULL THEN
    RAISE EXCEPTION 'No restaurant found. Check the restaurants table.';
  END IF;

  -- ── 1. Clear existing data ────────────────────────────────────────────────
  DELETE FROM products   WHERE restaurant_id = rid;
  DELETE FROM categories WHERE restaurant_id = rid;

  -- ── 2. Categories (30) ────────────────────────────────────────────────────

  INSERT INTO categories (restaurant_id, name, icon, order_index)
  VALUES (rid, '{"en":"Завтраки","ru":"Завтраки","kz":"Завтраки"}'::jsonb, '🍳', 1)
  RETURNING id INTO c_zavtraki;

  INSERT INTO categories (restaurant_id, name, icon, order_index)
  VALUES (rid, '{"en":"Каши","ru":"Каши","kz":"Каши"}'::jsonb, '🥣', 2)
  RETURNING id INTO c_kashi;

  INSERT INTO categories (restaurant_id, name, icon, order_index)
  VALUES (rid, '{"en":"Салаты","ru":"Салаты","kz":"Салаты"}'::jsonb, '🥗', 3)
  RETURNING id INTO c_salaty;

  INSERT INTO categories (restaurant_id, name, icon, order_index)
  VALUES (rid, '{"en":"Супы","ru":"Супы","kz":"Супы"}'::jsonb, '🍜', 4)
  RETURNING id INTO c_supy;

  INSERT INTO categories (restaurant_id, name, icon, order_index)
  VALUES (rid, '{"en":"Фаст-фуд","ru":"Фаст-фуд","kz":"Фаст-фуд"}'::jsonb, '🍔', 5)
  RETURNING id INTO c_fastfood;

  INSERT INTO categories (restaurant_id, name, icon, order_index)
  VALUES (rid, '{"en":"Нарезки","ru":"Нарезки","kz":"Нарезки"}'::jsonb, '🫕', 6)
  RETURNING id INTO c_narezki;

  INSERT INTO categories (restaurant_id, name, icon, order_index)
  VALUES (rid, '{"en":"Паста и лапша","ru":"Паста и лапша","kz":"Паста и лапша"}'::jsonb, '🍝', 7)
  RETURNING id INTO c_pasta;

  INSERT INTO categories (restaurant_id, name, icon, order_index)
  VALUES (rid, '{"en":"Соусы","ru":"Соусы","kz":"Соусы"}'::jsonb, '🫙', 8)
  RETURNING id INTO c_sousy;

  INSERT INTO categories (restaurant_id, name, icon, order_index)
  VALUES (rid, '{"en":"Гарниры","ru":"Гарниры","kz":"Гарниры"}'::jsonb, '🍚', 9)
  RETURNING id INTO c_garniry;

  INSERT INTO categories (restaurant_id, name, icon, order_index)
  VALUES (rid, '{"en":"Хлеб","ru":"Хлеб","kz":"Хлеб"}'::jsonb, '🥖', 10)
  RETURNING id INTO c_hleb;

  INSERT INTO categories (restaurant_id, name, icon, order_index)
  VALUES (rid, '{"en":"Восточная кухня","ru":"Восточная кухня","kz":"Восточная кухня"}'::jsonb, '🥘', 11)
  RETURNING id INTO c_vostok;

  INSERT INTO categories (restaurant_id, name, icon, order_index)
  VALUES (rid, '{"en":"Пицца и хачапури","ru":"Пицца и хачапури","kz":"Пицца и хачапури"}'::jsonb, '🍕', 12)
  RETURNING id INTO c_pizza;

  INSERT INTO categories (restaurant_id, name, icon, order_index)
  VALUES (rid, '{"en":"Рыбные блюда","ru":"Рыбные блюда","kz":"Рыбные блюда"}'::jsonb, '🐟', 13)
  RETURNING id INTO c_ryba;

  INSERT INTO categories (restaurant_id, name, icon, order_index)
  VALUES (rid, '{"en":"Казахская кухня","ru":"Казахская кухня","kz":"Казахская кухня"}'::jsonb, '🏺', 14)
  RETURNING id INTO c_kazah;

  INSERT INTO categories (restaurant_id, name, icon, order_index)
  VALUES (rid, '{"en":"Горячие блюда","ru":"Горячие блюда","kz":"Горячие блюда"}'::jsonb, '🍽️', 15)
  RETURNING id INTO c_goryachie;

  INSERT INTO categories (restaurant_id, name, icon, order_index)
  VALUES (rid, '{"en":"Гриль","ru":"Гриль","kz":"Гриль"}'::jsonb, '🥩', 16)
  RETURNING id INTO c_gril;

  INSERT INTO categories (restaurant_id, name, icon, order_index)
  VALUES (rid, '{"en":"Банкетные блюда","ru":"Банкетные блюда","kz":"Банкетные блюда"}'::jsonb, '👑', 17)
  RETURNING id INTO c_banket;

  INSERT INTO categories (restaurant_id, name, icon, order_index)
  VALUES (rid, '{"en":"Шашлыки","ru":"Шашлыки","kz":"Шашлыки"}'::jsonb, '🔥', 18)
  RETURNING id INTO c_shashlyk;

  INSERT INTO categories (restaurant_id, name, icon, order_index)
  VALUES (rid, '{"en":"Садж","ru":"Садж","kz":"Садж"}'::jsonb, '🍲', 19)
  RETURNING id INTO c_sadj;

  INSERT INTO categories (restaurant_id, name, icon, order_index)
  VALUES (rid, '{"en":"Роллы","ru":"Роллы","kz":"Роллы"}'::jsonb, '🍣', 20)
  RETURNING id INTO c_rolly;

  INSERT INTO categories (restaurant_id, name, icon, order_index)
  VALUES (rid, '{"en":"Сеты роллов","ru":"Сеты роллов","kz":"Сеты роллов"}'::jsonb, '🎌', 21)
  RETURNING id INTO c_sety;

  INSERT INTO categories (restaurant_id, name, icon, order_index)
  VALUES (rid, '{"en":"Темпура и запеченные","ru":"Темпура и запеченные","kz":"Темпура и запеченные"}'::jsonb, '🍤', 22)
  RETURNING id INTO c_tempura;

  INSERT INTO categories (restaurant_id, name, icon, order_index)
  VALUES (rid, '{"en":"Чай","ru":"Чай","kz":"Шай"}'::jsonb, '🍵', 23)
  RETURNING id INTO c_chay;

  INSERT INTO categories (restaurant_id, name, icon, order_index)
  VALUES (rid, '{"en":"Лимонад 1 л","ru":"Лимонад 1 л","kz":"Лимонад 1 л"}'::jsonb, '🍋', 24)
  RETURNING id INTO c_limon1;

  INSERT INTO categories (restaurant_id, name, icon, order_index)
  VALUES (rid, '{"en":"Лимонад 0,5 л","ru":"Лимонад 0,5 л","kz":"Лимонад 0,5 л"}'::jsonb, '🥤', 25)
  RETURNING id INTO c_limon05;

  INSERT INTO categories (restaurant_id, name, icon, order_index)
  VALUES (rid, '{"en":"Напитки","ru":"Напитки","kz":"Напитки"}'::jsonb, '🧃', 26)
  RETURNING id INTO c_napitki;

  INSERT INTO categories (restaurant_id, name, icon, order_index)
  VALUES (rid, '{"en":"Десерты","ru":"Десерты","kz":"Десерттер"}'::jsonb, '🍰', 27)
  RETURNING id INTO c_deserty;

  INSERT INTO categories (restaurant_id, name, icon, order_index)
  VALUES (rid, '{"en":"Кофе","ru":"Кофе","kz":"Кофе"}'::jsonb, '☕', 28)
  RETURNING id INTO c_kofe;

  INSERT INTO categories (restaurant_id, name, icon, order_index)
  VALUES (rid, '{"en":"Молочные коктейли","ru":"Молочные коктейли","kz":"Молочные коктейли"}'::jsonb, '🥛', 29)
  RETURNING id INTO c_kokteyly;

  INSERT INTO categories (restaurant_id, name, icon, order_index)
  VALUES (rid, '{"en":"Сиропы","ru":"Сиропы","kz":"Сиропы"}'::jsonb, '🍯', 30)
  RETURNING id INTO c_siropy;

  -- ── 3. Products ───────────────────────────────────────────────────────────

  -- Завтраки (7)
  INSERT INTO products (restaurant_id, category_id, name, price, is_available, is_archived, is_new, is_popular, is_spicy, order_index) VALUES
    (rid, c_zavtraki, '{"en":"казахский завтрак","ru":"казахский завтрак","kz":"казахский завтрак"}'::jsonb,              3870, true, false, false, false, false, 1),
    (rid, c_zavtraki, '{"en":"картофельные оладьи с семгой","ru":"картофельные оладьи с семгой","kz":"картофельные оладьи с семгой"}'::jsonb, 3570, true, false, false, false, false, 2),
    (rid, c_zavtraki, '{"en":"бельгийские вафли","ru":"бельгийские вафли","kz":"бельгийские вафли"}'::jsonb,              2870, true, false, false, false, false, 3),
    (rid, c_zavtraki, '{"en":"блины с творогом","ru":"блины с творогом","kz":"блины с творогом"}'::jsonb,                2370, true, false, false, false, false, 4),
    (rid, c_zavtraki, '{"en":"английский завтрак","ru":"английский завтрак","kz":"английский завтрак"}'::jsonb,          2970, true, false, false, false, false, 5),
    (rid, c_zavtraki, '{"en":"ассорти завтрак","ru":"ассорти завтрак","kz":"ассорти завтрак"}'::jsonb,                   3470, true, false, false, false, false, 6),
    (rid, c_zavtraki, '{"en":"скрэмбл с молочными сосисками","ru":"скрэмбл с молочными сосисками","kz":"скрэмбл с молочными сосисками"}'::jsonb, 2670, true, false, false, false, false, 7);

  -- Каши (2)
  INSERT INTO products (restaurant_id, category_id, name, price, is_available, is_archived, is_new, is_popular, is_spicy, order_index) VALUES
    (rid, c_kashi, '{"en":"рисовая каша","ru":"рисовая каша","kz":"рисовая каша"}'::jsonb,   1770, true, false, false, false, false, 1),
    (rid, c_kashi, '{"en":"каша злаковая","ru":"каша злаковая","kz":"каша злаковая"}'::jsonb, 1670, true, false, false, false, false, 2);

  -- Салаты (19)
  INSERT INTO products (restaurant_id, category_id, name, price, is_available, is_archived, is_new, is_popular, is_spicy, order_index) VALUES
    (rid, c_salaty, '{"en":"салат итальянский","ru":"салат итальянский","kz":"салат итальянский"}'::jsonb,                             3470, true, false, false, false, false, 1),
    (rid, c_salaty, '{"en":"ачу-чук","ru":"ачу-чук","kz":"ачу-чук"}'::jsonb,                                                          1370, true, false, false, false, false, 2),
    (rid, c_salaty, '{"en":"свежий салат","ru":"свежий салат","kz":"свежий салат"}'::jsonb,                                            2070, true, false, false, false, false, 3),
    (rid, c_salaty, '{"en":"греческий салат","ru":"греческий салат","kz":"греческий салат"}'::jsonb,                                   2570, true, false, false, false, false, 4),
    (rid, c_salaty, '{"en":"пекинский салат","ru":"пекинский салат","kz":"пекинский салат"}'::jsonb,                                   2670, true, false, false, false, false, 5),
    (rid, c_salaty, '{"en":"цезарь с курицей","ru":"цезарь с курицей","kz":"цезарь с курицей"}'::jsonb,                               2870, true, false, false, false, false, 6),
    (rid, c_salaty, '{"en":"нежный салат","ru":"нежный салат","kz":"нежный салат"}'::jsonb,                                           2570, true, false, false, false, false, 7),
    (rid, c_salaty, '{"en":"сырный рай","ru":"сырный рай","kz":"сырный рай"}'::jsonb,                                                 3370, true, false, false, false, false, 8),
    (rid, c_salaty, '{"en":"малибу","ru":"малибу","kz":"малибу"}'::jsonb,                                                             2570, true, false, false, false, false, 9),
    (rid, c_salaty, '{"en":"салат из утиной грудки","ru":"салат из утиной грудки","kz":"салат из утиной грудки"}'::jsonb,             3570, true, false, false, false, false, 10),
    (rid, c_salaty, '{"en":"ассорти салат","ru":"ассорти салат","kz":"ассорти салат"}'::jsonb,                                        3070, true, false, false, false, false, 11),
    (rid, c_salaty, '{"en":"теплый салат с семгой","ru":"теплый салат с семгой","kz":"теплый салат с семгой"}'::jsonb,                3570, true, false, false, false, false, 12),
    (rid, c_salaty, '{"en":"хрустящий баклажан","ru":"хрустящий баклажан","kz":"хрустящий баклажан"}'::jsonb,                         2970, true, false, false, false, false, 13),
    (rid, c_salaty, '{"en":"салат с креветками в кунжутном соусе","ru":"салат с креветками в кунжутном соусе","kz":"салат с креветками в кунжутном соусе"}'::jsonb, 3470, true, false, false, false, false, 14),
    (rid, c_salaty, '{"en":"салат от шефа","ru":"салат от шефа","kz":"салат от шефа"}'::jsonb,                                        3070, true, false, false, false, false, 15),
    (rid, c_salaty, '{"en":"фруктовый салат","ru":"фруктовый салат","kz":"фруктовый салат"}'::jsonb,                                   2670, true, false, false, false, false, 16),
    (rid, c_salaty, '{"en":"теплый салат с курицей","ru":"теплый салат с курицей","kz":"теплый салат с курицей"}'::jsonb,             3270, true, false, false, false, false, 17),
    (rid, c_salaty, '{"en":"салат из цветной капусты","ru":"салат из цветной капусты","kz":"салат из цветной капусты"}'::jsonb,       3270, true, false, false, false, false, 18),
    (rid, c_salaty, '{"en":"казахский салат","ru":"казахский салат","kz":"казахский салат"}'::jsonb,                                   3470, true, false, false, false, false, 19);

  -- Супы (13)
  INSERT INTO products (restaurant_id, category_id, name, price, is_available, is_archived, is_new, is_popular, is_spicy, order_index) VALUES
    (rid, c_supy, '{"en":"лагман по-домашнему","ru":"лагман по-домашнему","kz":"лагман по-домашнему"}'::jsonb,             2370, true, false, false, false, false, 1),
    (rid, c_supy, '{"en":"шурпа из баранины","ru":"шурпа из баранины","kz":"шурпа из баранины"}'::jsonb,                  2270, true, false, false, false, false, 2),
    (rid, c_supy, '{"en":"казахская шурпа","ru":"казахская шурпа","kz":"казахская шурпа"}'::jsonb,                         2770, true, false, false, false, false, 3),
    (rid, c_supy, '{"en":"пельмени с бульоном","ru":"пельмени с бульоном","kz":"пельмени с бульоном"}'::jsonb,            2070, true, false, false, false, false, 4),
    (rid, c_supy, '{"en":"суп лапша куриный","ru":"суп лапша куриный","kz":"суп лапша куриный"}'::jsonb,                  1870, true, false, false, false, false, 5),
    (rid, c_supy, '{"en":"том ям с курицей","ru":"том ям с курицей","kz":"том ям с курицей"}'::jsonb,                     2670, true, false, false, false, false, 6),
    (rid, c_supy, '{"en":"том ям с морепродуктами","ru":"том ям с морепродуктами","kz":"том ям с морепродуктами"}'::jsonb, 2970, true, false, false, false, false, 7),
    (rid, c_supy, '{"en":"рыбный суп","ru":"рыбный суп","kz":"рыбный суп"}'::jsonb,                                       2370, true, false, false, false, false, 8),
    (rid, c_supy, '{"en":"борщ","ru":"борщ","kz":"борщ"}'::jsonb,                                                         1870, true, false, false, false, false, 9),
    (rid, c_supy, '{"en":"рамен с говядиной","ru":"рамен с говядиной","kz":"рамен с говядиной"}'::jsonb,                  2370, true, false, false, false, false, 10),
    (rid, c_supy, '{"en":"рамен с курицей","ru":"рамен с курицей","kz":"рамен с курицей"}'::jsonb,                        2370, true, false, false, false, false, 11),
    (rid, c_supy, '{"en":"рамен сырный","ru":"рамен сырный","kz":"рамен сырный"}'::jsonb,                                 2470, true, false, false, false, false, 12),
    (rid, c_supy, '{"en":"крем-суп чечевичный","ru":"крем-суп чечевичный","kz":"крем-суп чечевичный"}'::jsonb,            1770, true, false, false, false, false, 13);

  -- Фаст-фуд (9)
  INSERT INTO products (restaurant_id, category_id, name, price, is_available, is_archived, is_new, is_popular, is_spicy, order_index) VALUES
    (rid, c_fastfood, '{"en":"сет ассорти фас фуд","ru":"сет ассорти фас фуд","kz":"сет ассорти фас фуд"}'::jsonb, 5970, true, false, false, false, false, 1),
    (rid, c_fastfood, '{"en":"сырные палочки","ru":"сырные палочки","kz":"сырные палочки"}'::jsonb,                  2070, true, false, false, false, false, 2),
    (rid, c_fastfood, '{"en":"наггетсы","ru":"наггетсы","kz":"наггетсы"}'::jsonb,                                    1970, true, false, false, false, false, 3),
    (rid, c_fastfood, '{"en":"чикен 20 шт","ru":"чикен 20 шт","kz":"чикен 20 шт"}'::jsonb,                          4870, true, false, false, false, false, 4),
    (rid, c_fastfood, '{"en":"чикен 15 шт","ru":"чикен 15 шт","kz":"чикен 15 шт"}'::jsonb,                          3870, true, false, false, false, false, 5),
    (rid, c_fastfood, '{"en":"чикен 10 шт","ru":"чикен 10 шт","kz":"чикен 10 шт"}'::jsonb,                          2870, true, false, false, false, false, 6),
    (rid, c_fastfood, '{"en":"бургер с фри","ru":"бургер с фри","kz":"бургер с фри"}'::jsonb,                        2270, true, false, false, false, false, 7),
    (rid, c_fastfood, '{"en":"клаб сэндвич","ru":"клаб сэндвич","kz":"клаб сэндвич"}'::jsonb,                       2070, true, false, false, false, false, 8),
    (rid, c_fastfood, '{"en":"чикен бургер","ru":"чикен бургер","kz":"чикен бургер"}'::jsonb,                        2070, true, false, false, false, false, 9);

  -- Нарезки (4)
  INSERT INTO products (restaurant_id, category_id, name, price, is_available, is_archived, is_new, is_popular, is_spicy, order_index) VALUES
    (rid, c_narezki, '{"en":"фруктовая нарезка","ru":"фруктовая нарезка","kz":"фруктовая нарезка"}'::jsonb, 6570, true, false, false, false, false, 1),
    (rid, c_narezki, '{"en":"ассорти куриное","ru":"ассорти куриное","kz":"ассорти куриное"}'::jsonb,        3970, true, false, false, false, false, 2),
    (rid, c_narezki, '{"en":"ассорти мясное","ru":"ассорти мясное","kz":"ассорти мясное"}'::jsonb,          6170, true, false, false, false, false, 3),
    (rid, c_narezki, '{"en":"ассорти рыбное","ru":"ассорти рыбное","kz":"ассорти рыбное"}'::jsonb,          7270, true, false, false, false, false, 4);

  -- Паста и лапша (5)
  INSERT INTO products (restaurant_id, category_id, name, price, is_available, is_archived, is_new, is_popular, is_spicy, order_index) VALUES
    (rid, c_pasta, '{"en":"фетучини альфредо","ru":"фетучини альфредо","kz":"фетучини альфредо"}'::jsonb,      2970, true, false, false, false, false, 1),
    (rid, c_pasta, '{"en":"фетучини с семгой","ru":"фетучини с семгой","kz":"фетучини с семгой"}'::jsonb,      3370, true, false, false, false, false, 2),
    (rid, c_pasta, '{"en":"фетучини с креветками","ru":"фетучини с креветками","kz":"фетучини с креветками"}'::jsonb, 3070, true, false, false, false, false, 3),
    (rid, c_pasta, '{"en":"удон с курицей","ru":"удон с курицей","kz":"удон с курицей"}'::jsonb,               2870, true, false, false, false, false, 4),
    (rid, c_pasta, '{"en":"спагетти болоньезе","ru":"спагетти болоньезе","kz":"спагетти болоньезе"}'::jsonb,  2970, true, false, false, false, false, 5);

  -- Соусы (7)
  INSERT INTO products (restaurant_id, category_id, name, price, is_available, is_archived, is_new, is_popular, is_spicy, order_index) VALUES
    (rid, c_sousy, '{"en":"кетчуп","ru":"кетчуп","kz":"кетчуп"}'::jsonb,                         370, true, false, false, false, false, 1),
    (rid, c_sousy, '{"en":"майонез","ru":"майонез","kz":"майонез"}'::jsonb,                       370, true, false, false, false, false, 2),
    (rid, c_sousy, '{"en":"тар-тар соус","ru":"тар-тар соус","kz":"тар-тар соус"}'::jsonb,       370, true, false, false, false, false, 3),
    (rid, c_sousy, '{"en":"кисло-сладкий соус","ru":"кисло-сладкий соус","kz":"кисло-сладкий соус"}'::jsonb, 370, true, false, false, false, false, 4),
    (rid, c_sousy, '{"en":"соус демиглас","ru":"соус демиглас","kz":"соус демиглас"}'::jsonb,     370, true, false, false, false, false, 5),
    (rid, c_sousy, '{"en":"сливочный соус","ru":"сливочный соус","kz":"сливочный соус"}'::jsonb,  370, true, false, false, false, false, 6),
    (rid, c_sousy, '{"en":"шашлычный соус","ru":"шашлычный соус","kz":"шашлычный соус"}'::jsonb,  370, true, false, false, false, false, 7);

  -- Гарниры (4)
  INSERT INTO products (restaurant_id, category_id, name, price, is_available, is_archived, is_new, is_popular, is_spicy, order_index) VALUES
    (rid, c_garniry, '{"en":"рис","ru":"рис","kz":"рис"}'::jsonb,                670, true, false, false, false, false, 1),
    (rid, c_garniry, '{"en":"фри","ru":"фри","kz":"фри"}'::jsonb,                870, true, false, false, false, false, 2),
    (rid, c_garniry, '{"en":"пюре","ru":"пюре","kz":"пюре"}'::jsonb,             670, true, false, false, false, false, 3),
    (rid, c_garniry, '{"en":"овощи гриль","ru":"овощи гриль","kz":"овощи гриль"}'::jsonb, 970, true, false, false, false, false, 4);

  -- Хлеб (4)
  INSERT INTO products (restaurant_id, category_id, name, price, is_available, is_archived, is_new, is_popular, is_spicy, order_index) VALUES
    (rid, c_hleb, '{"en":"лепешка","ru":"лепешка","kz":"лепешка"}'::jsonb,                      270, true, false, false, false, false, 1),
    (rid, c_hleb, '{"en":"бауырсак (1 корзина)","ru":"бауырсак (1 корзина)","kz":"бауырсак (1 себет)"}'::jsonb, 670, true, false, false, false, false, 2),
    (rid, c_hleb, '{"en":"чесночный хлеб","ru":"чесночный хлеб","kz":"чесночный хлеб"}'::jsonb,  870, true, false, false, false, false, 3),
    (rid, c_hleb, '{"en":"хлебная корзина","ru":"хлебная корзина","kz":"нан себеті"}'::jsonb,    1270, true, false, false, false, false, 4);

  -- Восточная кухня (13)
  INSERT INTO products (restaurant_id, category_id, name, price, is_available, is_archived, is_new, is_popular, is_spicy, order_index) VALUES
    (rid, c_vostok, '{"en":"мясо по-тайски","ru":"мясо по-тайски","kz":"мясо по-тайски"}'::jsonb,                               3170, true, false, false, false, false, 1),
    (rid, c_vostok, '{"en":"лагман «суйру»","ru":"лагман «суйру»","kz":"лагман «суйру»"}'::jsonb,                               2370, true, false, false, false, false, 2),
    (rid, c_vostok, '{"en":"лагман «гуйру»","ru":"лагман «гуйру»","kz":"лагман «гуйру»"}'::jsonb,                               2470, true, false, false, false, false, 3),
    (rid, c_vostok, '{"en":"лагман «могуру»","ru":"лагман «могуру»","kz":"лагман «могуру»"}'::jsonb,                             2570, true, false, false, false, false, 4),
    (rid, c_vostok, '{"en":"лагман «цомян» (жаренный лагман)","ru":"лагман «цомян» (жаренный лагман)","kz":"лагман «цомян» (жаренный лагман)"}'::jsonb, 2670, true, false, false, false, false, 5),
    (rid, c_vostok, '{"en":"лагман «дин-дин цомян»","ru":"лагман «дин-дин цомян»","kz":"лагман «дин-дин цомян»"}'::jsonb,       2570, true, false, false, false, false, 6),
    (rid, c_vostok, '{"en":"«лазджи»","ru":"«лазджи»","kz":"«лазджи»"}'::jsonb,                                                 2370, true, false, false, false, false, 7),
    (rid, c_vostok, '{"en":"«лазыру»","ru":"«лазыру»","kz":"«лазыру»"}'::jsonb,                                                 2370, true, false, false, false, false, 8),
    (rid, c_vostok, '{"en":"алматинский казан-кебаб","ru":"алматинский казан-кебаб","kz":"алматинский казан-кебаб"}'::jsonb,     3570, true, false, false, false, false, 9),
    (rid, c_vostok, '{"en":"фри с мясом","ru":"фри с мясом","kz":"фри с мясом"}'::jsonb,                                        2970, true, false, false, false, false, 10),
    (rid, c_vostok, '{"en":"фри с курицей","ru":"фри с курицей","kz":"фри с курицей"}'::jsonb,                                   2670, true, false, false, false, false, 11),
    (rid, c_vostok, '{"en":"«ганфан»","ru":"«ганфан»","kz":"«ганфан»"}'::jsonb,                                                 2670, true, false, false, false, false, 12),
    (rid, c_vostok, '{"en":"курица по-тайски","ru":"курица по-тайски","kz":"курица по-тайски"}'::jsonb,                          2670, true, false, false, false, false, 13);

  -- Пицца и хачапури (13)
  INSERT INTO products (restaurant_id, category_id, name, price, is_available, is_archived, is_new, is_popular, is_spicy, order_index) VALUES
    (rid, c_pizza, '{"en":"маргарита","ru":"маргарита","kz":"маргарита"}'::jsonb,                                       2370, true, false, false, false, false, 1),
    (rid, c_pizza, '{"en":"пепперони","ru":"пепперони","kz":"пепперони"}'::jsonb,                                       2470, true, false, false, false, false, 2),
    (rid, c_pizza, '{"en":"мексика","ru":"мексика","kz":"мексика"}'::jsonb,                                             2570, true, false, false, false, false, 3),
    (rid, c_pizza, '{"en":"казахстан","ru":"казахстан","kz":"қазақстан"}'::jsonb,                                       3070, true, false, false, false, false, 4),
    (rid, c_pizza, '{"en":"болоньезе","ru":"болоньезе","kz":"болоньезе"}'::jsonb,                                       2670, true, false, false, false, false, 5),
    (rid, c_pizza, '{"en":"пицца «четыре сыра»","ru":"пицца «четыре сыра»","kz":"пицца «төрт ірімшік»"}'::jsonb,       2670, true, false, false, false, false, 6),
    (rid, c_pizza, '{"en":"курица с грибами","ru":"курица с грибами","kz":"курица с грибами"}'::jsonb,                  2670, true, false, false, false, false, 7),
    (rid, c_pizza, '{"en":"пицца цезарь","ru":"пицца цезарь","kz":"пицца цезарь"}'::jsonb,                             2870, true, false, false, false, false, 8),
    (rid, c_pizza, '{"en":"пицца филадельфия","ru":"пицца филадельфия","kz":"пицца филадельфия"}'::jsonb,               3470, true, false, false, false, false, 9),
    (rid, c_pizza, '{"en":"хачапури по-мегрельски","ru":"хачапури по-мегрельски","kz":"хачапури по-мегрельски"}'::jsonb, 2970, true, false, false, false, false, 10),
    (rid, c_pizza, '{"en":"хачапури по-аджарски","ru":"хачапури по-аджарски","kz":"хачапури по-аджарски"}'::jsonb,     3170, true, false, false, false, false, 11),
    (rid, c_pizza, '{"en":"турецкая","ru":"турецкая","kz":"түрік"}'::jsonb,                                             2970, true, false, false, false, false, 12),
    (rid, c_pizza, '{"en":"ассорти","ru":"ассорти","kz":"ассорти"}'::jsonb,                                             2970, true, false, false, false, false, 13);

  -- Рыбные блюда (7)
  INSERT INTO products (restaurant_id, category_id, name, price, is_available, is_archived, is_new, is_popular, is_spicy, order_index) VALUES
    (rid, c_ryba, '{"en":"хрустящий судак","ru":"хрустящий судак","kz":"хрустящий судак"}'::jsonb,                         3670, true, false, false, false, false, 1),
    (rid, c_ryba, '{"en":"жареный сазан","ru":"жареный сазан","kz":"жареный сазан"}'::jsonb,                               3370, true, false, false, false, false, 2),
    (rid, c_ryba, '{"en":"сёмга с овощами","ru":"сёмга с овощами","kz":"сёмга с овощами"}'::jsonb,                         4170, true, false, false, false, false, 3),
    (rid, c_ryba, '{"en":"сазан кебаб","ru":"сазан кебаб","kz":"сазан кебаб"}'::jsonb,                                    3970, true, false, false, false, false, 4),
    (rid, c_ryba, '{"en":"судак на пару с брокколи","ru":"судак на пару с брокколи","kz":"судак на пару с брокколи"}'::jsonb, 3870, true, false, false, false, false, 5),
    (rid, c_ryba, '{"en":"судак с овощами в фольге","ru":"судак с овощами в фольге","kz":"судак с овощами в фольге"}'::jsonb, 3670, true, false, false, false, false, 6),
    (rid, c_ryba, '{"en":"судак в сливочном соусе","ru":"судак в сливочном соусе","kz":"судак в сливочном соусе"}'::jsonb,  3870, true, false, false, false, false, 7);

  -- Казахская кухня (7)
  INSERT INTO products (restaurant_id, category_id, name, price, is_available, is_archived, is_new, is_popular, is_spicy, order_index) VALUES
    (rid, c_kazah, '{"en":"манты на пару","ru":"манты на пару","kz":"буға пісірілген манты"}'::jsonb,    2470, true, false, false, false, false, 1),
    (rid, c_kazah, '{"en":"манты жареные","ru":"манты жареные","kz":"қуырылған манты"}'::jsonb,          2570, true, false, false, false, false, 2),
    (rid, c_kazah, '{"en":"бешбармак","ru":"бешбармак","kz":"бешбармақ"}'::jsonb,                        3370, true, false, false, true,  false, 3),
    (rid, c_kazah, '{"en":"куырдак ассорти","ru":"куырдак ассорти","kz":"қуырдақ ассорти"}'::jsonb,      3670, true, false, false, false, false, 4),
    (rid, c_kazah, '{"en":"плов","ru":"плов","kz":"палау"}'::jsonb,                                      2470, true, false, false, false, false, 5),
    (rid, c_kazah, '{"en":"плов ассорти","ru":"плов ассорти","kz":"палау ассорти"}'::jsonb,              3470, true, false, false, false, false, 6),
    (rid, c_kazah, '{"en":"сырне","ru":"сырне","kz":"сырне"}'::jsonb,                                    3870, true, false, false, false, false, 7);

  -- Горячие блюда (19)
  INSERT INTO products (restaurant_id, category_id, name, price, is_available, is_archived, is_new, is_popular, is_spicy, order_index) VALUES
    (rid, c_goryachie, '{"en":"курица в сливочном соусе","ru":"курица в сливочном соусе","kz":"курица в сливочном соусе"}'::jsonb,        2970, true, false, false, false, false, 1),
    (rid, c_goryachie, '{"en":"курица терияки","ru":"курица терияки","kz":"курица терияки"}'::jsonb,                                      2970, true, false, false, false, false, 2),
    (rid, c_goryachie, '{"en":"жареный рамен с курицей","ru":"жареный рамен с курицей","kz":"жареный рамен с курицей"}'::jsonb,           2970, true, false, false, false, false, 3),
    (rid, c_goryachie, '{"en":"крылышки в соусе терияки","ru":"крылышки в соусе терияки","kz":"крылышки в соусе терияки"}'::jsonb,        2570, true, false, false, false, false, 4),
    (rid, c_goryachie, '{"en":"баранина в сливочном соусе","ru":"баранина в сливочном соусе","kz":"баранина в сливочном соусе"}'::jsonb,   2970, true, false, false, false, false, 5),
    (rid, c_goryachie, '{"en":"баранина по-грузински","ru":"баранина по-грузински","kz":"баранина по-грузински"}'::jsonb,                 3570, true, false, false, false, false, 6),
    (rid, c_goryachie, '{"en":"котлета от шефа","ru":"котлета от шефа","kz":"шеф-аспаздың котлеті"}'::jsonb,                             3770, true, false, false, false, false, 7),
    (rid, c_goryachie, '{"en":"курица карри","ru":"курица карри","kz":"курица карри"}'::jsonb,                                            3270, true, false, false, false, false, 8),
    (rid, c_goryachie, '{"en":"куриный рулет в грибном соусе","ru":"куриный рулет в грибном соусе","kz":"куриный рулет в грибном соусе"}'::jsonb, 3370, true, false, false, false, false, 9),
    (rid, c_goryachie, '{"en":"картофель фри с грибным соусом","ru":"картофель фри с грибным соусом","kz":"картофель фри с грибным соусом"}'::jsonb, 2370, true, false, false, false, false, 10),
    (rid, c_goryachie, '{"en":"бефстроганов с гарниром","ru":"бефстроганов с гарниром","kz":"бефстроганов с гарниром"}'::jsonb,           3270, true, false, false, false, false, 11),
    (rid, c_goryachie, '{"en":"бифштекс с гарниром","ru":"бифштекс с гарниром","kz":"бифштекс с гарниром"}'::jsonb,                      2770, true, false, false, false, false, 12),
    (rid, c_goryachie, '{"en":"котлеты с гарниром","ru":"котлеты с гарниром","kz":"котлеты с гарниром"}'::jsonb,                         2670, true, false, false, false, false, 13),
    (rid, c_goryachie, '{"en":"шницель","ru":"шницель","kz":"шницель"}'::jsonb,                                                           2870, true, false, false, false, false, 14),
    (rid, c_goryachie, '{"en":"картофель жареный с мясом","ru":"картофель жареный с мясом","kz":"картофель жареный с мясом"}'::jsonb,     2870, true, false, false, false, false, 15),
    (rid, c_goryachie, '{"en":"пельмени в сливочном соусе","ru":"пельмени в сливочном соусе","kz":"пельмени в сливочном соусе"}'::jsonb,  2670, true, false, false, false, false, 16),
    (rid, c_goryachie, '{"en":"жареные пельмени","ru":"жареные пельмени","kz":"қуырылған пельмени"}'::jsonb,                              2370, true, false, false, false, false, 17),
    (rid, c_goryachie, '{"en":"курица по-деревенски","ru":"курица по-деревенски","kz":"курица по-деревенски"}'::jsonb,                    2770, true, false, false, false, false, 18),
    (rid, c_goryachie, '{"en":"телятина по-деревенски","ru":"телятина по-деревенски","kz":"телятина по-деревенски"}'::jsonb,              3070, true, false, false, false, false, 19);

  -- Гриль (9)
  INSERT INTO products (restaurant_id, category_id, name, price, is_available, is_archived, is_new, is_popular, is_spicy, order_index) VALUES
    (rid, c_gril, '{"en":"стейк куриный","ru":"стейк куриный","kz":"стейк куриный"}'::jsonb,          4370, true, false, false, false, false, 1),
    (rid, c_gril, '{"en":"стейк R-Bay","ru":"стейк R-Bay","kz":"стейк R-Bay"}'::jsonb,                6970, true, false, false, false, false, 2),
    (rid, c_gril, '{"en":"стейк T-Bon","ru":"стейк T-Bon","kz":"стейк T-Bon"}'::jsonb,                6670, true, false, false, false, false, 3),
    (rid, c_gril, '{"en":"стейк из семги","ru":"стейк из семги","kz":"семгадан стейк"}'::jsonb,       5870, true, false, false, false, false, 4),
    (rid, c_gril, '{"en":"стейк из телятины","ru":"стейк из телятины","kz":"бұзау етінен стейк"}'::jsonb, 4370, true, false, false, false, false, 5),
    (rid, c_gril, '{"en":"колбаски куриные","ru":"колбаски куриные","kz":"тауық шұжықтары"}'::jsonb,   3470, true, false, false, false, false, 6),
    (rid, c_gril, '{"en":"колбаски говяжьи","ru":"колбаски говяжьи","kz":"сиыр шұжықтары"}'::jsonb,   3570, true, false, false, false, false, 7),
    (rid, c_gril, '{"en":"утка на гриле","ru":"утка на гриле","kz":"грильдегі үйрек"}'::jsonb,        4170, true, false, false, false, false, 8),
    (rid, c_gril, '{"en":"стейк от шефа","ru":"стейк от шефа","kz":"шеф-аспаздың стейкі"}'::jsonb,   7170, true, false, false, false, false, 9);

  -- Банкетные блюда (19)
  INSERT INTO products (restaurant_id, category_id, name, price, is_available, is_archived, is_new, is_popular, is_spicy, order_index) VALUES
    (rid, c_banket, '{"en":"бас табақ «койдын басы» жілік майымен","ru":"бас табақ «койдын басы» жілік майымен","kz":"бас табақ «қойдың басы» жілік майымен"}'::jsonb, 9870,  true, false, false, false, false, 1),
    (rid, c_banket, '{"en":"қойдың басы қуырдақпен","ru":"қойдың басы қуырдақпен","kz":"қойдың басы қуырдақпен"}'::jsonb,                                             16770, true, false, false, false, false, 2),
    (rid, c_banket, '{"en":"қуырдақ компанияға","ru":"қуырдақ компанияға","kz":"қуырдақ компанияға"}'::jsonb,                                                          18670, true, false, false, false, false, 3),
    (rid, c_banket, '{"en":"дапанджи куриный (6 персон)","ru":"дапанджи куриный (6 персон)","kz":"дапанджи куриный (6 адамға)"}'::jsonb,                               17470, true, false, false, false, false, 4),
    (rid, c_banket, '{"en":"дапанру из баранины/из говядины (6 персон)","ru":"дапанру из баранины/из говядины (6 персон)","kz":"дапанру из баранины/из говядины (6 адамға)"}'::jsonb, 18870, true, false, false, false, false, 5),
    (rid, c_banket, '{"en":"микс сет (4-5 персон)","ru":"микс сет (4-5 персон)","kz":"микс сет (4-5 адамға)"}'::jsonb,                                                18070, true, false, false, false, false, 6),
    (rid, c_banket, '{"en":"плов (6 персон)","ru":"плов (6 персон)","kz":"палау (6 адамға)"}'::jsonb,                                                                  13770, true, false, false, false, false, 7),
    (rid, c_banket, '{"en":"шах плов","ru":"шах плов","kz":"шах палау"}'::jsonb,                                                                                       14470, true, false, false, false, false, 8),
    (rid, c_banket, '{"en":"ассорти плов компанияға","ru":"ассорти плов компанияға","kz":"ассорти палау компанияға"}'::jsonb,                                           16570, true, false, false, false, false, 9),
    (rid, c_banket, '{"en":"бешбармак (6 персон)","ru":"бешбармак (6 персон)","kz":"бешбармақ (6 адамға)"}'::jsonb,                                                    16970, true, false, false, false, false, 10),
    (rid, c_banket, '{"en":"фишбармак (рыбный бешбармак)","ru":"фишбармак (рыбный бешбармак)","kz":"фишбармак (балықты бешбармақ)"}'::jsonb,                           25970, true, false, false, false, false, 11),
    (rid, c_banket, '{"en":"манты (6 персон)","ru":"манты (6 персон)","kz":"манты (6 адамға)"}'::jsonb,                                                                14970, true, false, false, false, false, 12),
    (rid, c_banket, '{"en":"ciphe","ru":"ciphe","kz":"ciphe"}'::jsonb,                                                                                                 18970, true, false, false, false, false, 13),
    (rid, c_banket, '{"en":"микс восток","ru":"микс восток","kz":"шығыс миксі"}'::jsonb,                                                                               18270, true, false, false, false, false, 14),
    (rid, c_banket, '{"en":"фирменный ассорти","ru":"фирменный ассорти","kz":"фирмалық ассорти"}'::jsonb,                                                              37770, true, false, false, false, false, 15),
    (rid, c_banket, '{"en":"шашлычный микс (13-14 персон)","ru":"шашлычный микс (13-14 персон)","kz":"шашлық миксі (13-14 адамға)"}'::jsonb,                          34370, true, false, false, false, false, 16),
    (rid, c_banket, '{"en":"ханский ассорти (5-6 персон)","ru":"ханский ассорти (5-6 персон)","kz":"хандық ассорти (5-6 адамға)"}'::jsonb,                             29970, true, false, false, false, false, 17),
    (rid, c_banket, '{"en":"микс гриль","ru":"микс гриль","kz":"гриль миксі"}'::jsonb,                                                                                 24970, true, false, false, false, false, 18),
    (rid, c_banket, '{"en":"мясное плато (4-5 персон)","ru":"мясное плато (4-5 персон)","kz":"ет плато (4-5 адамға)"}'::jsonb,                                         24370, true, false, false, false, false, 19);

  -- Шашлыки (13)
  INSERT INTO products (restaurant_id, category_id, name, price, is_available, is_archived, is_new, is_popular, is_spicy, order_index) VALUES
    (rid, c_shashlyk, '{"en":"крылышки","ru":"крылышки","kz":"қанаттар"}'::jsonb,                                                2370,  true, false, false, false, false, 1),
    (rid, c_shashlyk, '{"en":"ассорти шашлыков 4-5 персон","ru":"ассорти шашлыков 4-5 персон","kz":"шашлық ассорти 4-5 адамға"}'::jsonb, 13570, true, false, false, false, false, 2),
    (rid, c_shashlyk, '{"en":"окорочка без костей","ru":"окорочка без костей","kz":"сүйексіз санжілік"}'::jsonb,                  2970,  true, false, false, false, false, 3),
    (rid, c_shashlyk, '{"en":"ассорти шашлыков 7-8 персон","ru":"ассорти шашлыков 7-8 персон","kz":"шашлық ассорти 7-8 адамға"}'::jsonb, 23870, true, false, false, false, false, 4),
    (rid, c_shashlyk, '{"en":"шашлычный микс 13-14 персон","ru":"шашлычный микс 13-14 персон","kz":"шашлық миксі 13-14 адамға"}'::jsonb, 34370, true, false, false, false, false, 5),
    (rid, c_shashlyk, '{"en":"овощной","ru":"овощной","kz":"көкөністі"}'::jsonb,                                                 1870,  true, false, false, false, false, 6),
    (rid, c_shashlyk, '{"en":"баранина без костей","ru":"баранина без костей","kz":"сүйексіз қой еті"}'::jsonb,                   3470,  true, false, false, false, false, 7),
    (rid, c_shashlyk, '{"en":"кефаль","ru":"кефаль","kz":"кефаль"}'::jsonb,                                                      2670,  true, false, false, false, false, 8),
    (rid, c_shashlyk, '{"en":"люля","ru":"люля","kz":"люля"}'::jsonb,                                                            2570,  true, false, false, false, false, 9),
    (rid, c_shashlyk, '{"en":"люля кебаб с внутренним жиром","ru":"люля кебаб с внутренним жиром","kz":"ішкі майлы люля кебаб"}'::jsonb, 2970, true, false, false, false, false, 10),
    (rid, c_shashlyk, '{"en":"люля кебаб в лаваше","ru":"люля кебаб в лаваше","kz":"лаваштағы люля кебаб"}'::jsonb,              2970,  true, false, false, false, false, 11),
    (rid, c_shashlyk, '{"en":"сырный люля кебаб","ru":"сырный люля кебаб","kz":"ірімшікті люля кебаб"}'::jsonb,                  3570,  true, false, false, false, false, 12),
    (rid, c_shashlyk, '{"en":"блюда от шефа","ru":"блюда от шефа","kz":"шеф-аспаздың тағамдары"}'::jsonb,                        3870,  true, false, false, false, false, 13);

  -- Садж (4)
  INSERT INTO products (restaurant_id, category_id, name, price, is_available, is_archived, is_new, is_popular, is_spicy, order_index) VALUES
    (rid, c_sadj, '{"en":"садж куриный","ru":"садж куриный","kz":"тауықты садж"}'::jsonb,                    8870,  true, false, false, false, false, 1),
    (rid, c_sadj, '{"en":"садж баранина","ru":"садж баранина","kz":"қой еті садж"}'::jsonb,                  9470,  true, false, false, false, false, 2),
    (rid, c_sadj, '{"en":"садж семга","ru":"садж семга","kz":"семгалы садж"}'::jsonb,                        11270, true, false, false, false, false, 3),
    (rid, c_sadj, '{"en":"садж ассорти (4 персоны)","ru":"садж ассорти (4 персоны)","kz":"садж ассорти (4 адамға)"}'::jsonb, 12070, true, false, false, false, false, 4);

  -- Роллы (18)
  INSERT INTO products (restaurant_id, category_id, name, price, is_available, is_archived, is_new, is_popular, is_spicy, order_index) VALUES
    (rid, c_rolly, '{"en":"ямаха","ru":"ямаха","kz":"ямаха"}'::jsonb,                                                            2970, true, false, false, false, false, 1),
    (rid, c_rolly, '{"en":"калифорния с крабом","ru":"калифорния с крабом","kz":"қақпақты крабпен"}'::jsonb,                      2770, true, false, false, false, false, 2),
    (rid, c_rolly, '{"en":"филадельфия classic","ru":"филадельфия classic","kz":"филадельфия classic"}'::jsonb,                   3070, true, false, false, false, false, 3),
    (rid, c_rolly, '{"en":"калифорния с лососем","ru":"калифорния с лососем","kz":"калифорния лососьмен"}'::jsonb,                 3170, true, false, false, false, false, 4),
    (rid, c_rolly, '{"en":"чиз / ірімшік","ru":"чиз / ірімшік","kz":"чиз / ірімшік"}'::jsonb,                                    2570, true, false, false, false, false, 5),
    (rid, c_rolly, '{"en":"филадельфия grill","ru":"филадельфия grill","kz":"филадельфия grill"}'::jsonb,                         3070, true, false, false, false, false, 6),
    (rid, c_rolly, '{"en":"ролл планета","ru":"ролл планета","kz":"планета роллы"}'::jsonb,                                       2870, true, false, false, false, false, 7),
    (rid, c_rolly, '{"en":"дует","ru":"дует","kz":"дует"}'::jsonb,                                                                3270, true, false, false, false, false, 8),
    (rid, c_rolly, '{"en":"филадельфия с угрем","ru":"филадельфия с угрем","kz":"жыланбалықты филадельфия"}'::jsonb,               3370, true, false, false, false, false, 9),
    (rid, c_rolly, '{"en":"калифорния с креветками","ru":"калифорния с креветками","kz":"калифорния креветкамен"}'::jsonb,         2870, true, false, false, false, false, 10),
    (rid, c_rolly, '{"en":"ролл канада","ru":"ролл канада","kz":"канада роллы"}'::jsonb,                                          3670, true, false, false, false, false, 11),
    (rid, c_rolly, '{"en":"ролл бонито","ru":"ролл бонито","kz":"бонито роллы"}'::jsonb,                                         2870, true, false, false, false, false, 12),
    (rid, c_rolly, '{"en":"филадельфия с креветками","ru":"филадельфия с креветками","kz":"креветкалы филадельфия"}'::jsonb,       3170, true, false, false, false, false, 13),
    (rid, c_rolly, '{"en":"ролл овощной","ru":"ролл овощной","kz":"көкөністі ролл"}'::jsonb,                                      2170, true, false, false, false, false, 14),
    (rid, c_rolly, '{"en":"ролл с лососем","ru":"ролл с лососем","kz":"лосось роллы"}'::jsonb,                                    2570, true, false, false, false, false, 15),
    (rid, c_rolly, '{"en":"ролл с огурцом","ru":"ролл с огурцом","kz":"қияр роллы"}'::jsonb,                                     1770, true, false, false, false, false, 16),
    (rid, c_rolly, '{"en":"ролл с курицей","ru":"ролл с курицей","kz":"тауық роллы"}'::jsonb,                                     2870, true, false, false, false, false, 17),
    (rid, c_rolly, '{"en":"ролл с жаренными креветками","ru":"ролл с жаренными креветками","kz":"қуырылған креветкалы ролл"}'::jsonb, 3170, true, false, false, false, false, 18);

  -- Сеты роллов (9)
  INSERT INTO products (restaurant_id, category_id, name, price, is_available, is_archived, is_new, is_popular, is_spicy, order_index) VALUES
    (rid, c_sety, '{"en":"сет окинава","ru":"сет окинава","kz":"окинава сеті"}'::jsonb,        8970,  true, false, false, false, false, 1),
    (rid, c_sety, '{"en":"сет ассорти","ru":"сет ассорти","kz":"ассорти сеті"}'::jsonb,        13570, true, false, false, false, false, 2),
    (rid, c_sety, '{"en":"сет экспресс","ru":"сет экспресс","kz":"экспресс сеті"}'::jsonb,     10970, true, false, false, false, false, 3),
    (rid, c_sety, '{"en":"сет пекин","ru":"сет пекин","kz":"пекин сеті"}'::jsonb,              7870,  true, false, false, false, false, 4),
    (rid, c_sety, '{"en":"сет жаренный","ru":"сет жаренный","kz":"қуырылған сет"}'::jsonb,     9270,  true, false, false, false, false, 5),
    (rid, c_sety, '{"en":"сет запеченный","ru":"сет запеченный","kz":"пісірілген сет"}'::jsonb, 9770, true, false, false, false, false, 6),
    (rid, c_sety, '{"en":"сет холодный","ru":"сет холодный","kz":"суық сет"}'::jsonb,          9170,  true, false, false, false, false, 7),
    (rid, c_sety, '{"en":"сет куриный","ru":"сет куриный","kz":"тауық сеті"}'::jsonb,          8470,  true, false, false, false, false, 8),
    (rid, c_sety, '{"en":"сет хот","ru":"сет хот","kz":"хот сеті"}'::jsonb,                    13570, true, false, false, false, false, 9);

  -- Темпура и запеченные (16)
  INSERT INTO products (restaurant_id, category_id, name, price, is_available, is_archived, is_new, is_popular, is_spicy, order_index) VALUES
    (rid, c_tempura, '{"en":"темпура америка","ru":"темпура америка","kz":"темпура америка"}'::jsonb,                     2970, true, false, false, false, false, 1),
    (rid, c_tempura, '{"en":"темпура лосось","ru":"темпура лосось","kz":"темпура лосось"}'::jsonb,                         2870, true, false, false, false, false, 2),
    (rid, c_tempura, '{"en":"темпура филадельфия","ru":"темпура филадельфия","kz":"темпура филадельфия"}'::jsonb,          2970, true, false, false, false, false, 3),
    (rid, c_tempura, '{"en":"темпура оригами","ru":"темпура оригами","kz":"темпура оригами"}'::jsonb,                      3370, true, false, false, false, false, 4),
    (rid, c_tempura, '{"en":"темпура курица","ru":"темпура курица","kz":"темпура тауық"}'::jsonb,                          2870, true, false, false, false, false, 5),
    (rid, c_tempura, '{"en":"темпура ассорти","ru":"темпура ассорти","kz":"темпура ассорти"}'::jsonb,                      3370, true, false, false, false, false, 6),
    (rid, c_tempura, '{"en":"темпура краб","ru":"темпура краб","kz":"темпура краб"}'::jsonb,                               2770, true, false, false, false, false, 7),
    (rid, c_tempura, '{"en":"жаренный лосось","ru":"жаренный лосось","kz":"қуырылған лосось"}'::jsonb,                     3070, true, false, false, false, false, 8),
    (rid, c_tempura, '{"en":"жаренный угорь","ru":"жаренный угорь","kz":"қуырылған жыланбалық"}'::jsonb,                   3070, true, false, false, false, false, 9),
    (rid, c_tempura, '{"en":"филадельфия fusion","ru":"филадельфия fusion","kz":"филадельфия fusion"}'::jsonb,             3470, true, false, false, false, false, 10),
    (rid, c_tempura, '{"en":"запеченный с угрем","ru":"запеченный с угрем","kz":"жыланбалықпен пісірілген"}'::jsonb,       3470, true, false, false, false, false, 11),
    (rid, c_tempura, '{"en":"запеченная калифорния","ru":"запеченная калифорния","kz":"пісірілген калифорния"}'::jsonb,    3070, true, false, false, false, false, 12),
    (rid, c_tempura, '{"en":"запеченный с креветками","ru":"запеченный с креветками","kz":"креветкамен пісірілген"}'::jsonb, 3470, true, false, false, false, false, 13),
    (rid, c_tempura, '{"en":"запеченный курица","ru":"запеченный курица","kz":"пісірілген тауық"}'::jsonb,                 3070, true, false, false, false, false, 14),
    (rid, c_tempura, '{"en":"запеченный креветка","ru":"запеченный креветка","kz":"пісірілген креветка"}'::jsonb,          3470, true, false, false, false, false, 15),
    (rid, c_tempura, '{"en":"запеченный краб","ru":"запеченный краб","kz":"пісірілген краб"}'::jsonb,                      3070, true, false, false, false, false, 16);

  -- Чай (17)
  INSERT INTO products (restaurant_id, category_id, name, price, is_available, is_archived, is_new, is_popular, is_spicy, order_index) VALUES
    (rid, c_chay, '{"en":"чашка чая (черный/зеленый)","ru":"чашка чая (черный/зеленый)","kz":"бір кесе шай (қара/жасыл)"}'::jsonb,                  370,  true, false, false, false, false, 1),
    (rid, c_chay, '{"en":"ташкент чай (чайник)","ru":"ташкент чай (чайник)","kz":"ташкент шайы (шайнек)"}'::jsonb,                                    1370, true, false, false, false, false, 2),
    (rid, c_chay, '{"en":"черный чай (чайник)","ru":"черный чай (чайник)","kz":"қара шай (шайнек)"}'::jsonb,                                          970,  true, false, false, false, false, 3),
    (rid, c_chay, '{"en":"марокканский чай (чайник)","ru":"марокканский чай (чайник)","kz":"марокко шайы (шайнек)"}'::jsonb,                          1470, true, false, false, false, false, 4),
    (rid, c_chay, '{"en":"тропический чай (чайник)","ru":"тропический чай (чайник)","kz":"тропикалық шай (шайнек)"}'::jsonb,                          1470, true, false, false, false, false, 5),
    (rid, c_chay, '{"en":"ягодный чай (чайник)","ru":"ягодный чай (чайник)","kz":"жидекті шай (шайнек)"}'::jsonb,                                    1570, true, false, false, false, false, 6),
    (rid, c_chay, '{"en":"турецкий чай 1,9 л (чайник)","ru":"турецкий чай 1,9 л (чайник)","kz":"түрік шайы 1,9 л (шайнек)"}'::jsonb,                 1870, true, false, false, false, false, 7),
    (rid, c_chay, '{"en":"турецкий чай 1,9 л с восточными сладостями","ru":"турецкий чай 1,9 л с восточными сладостями","kz":"түрік шайы 1,9 л шығыс тәттілерімен"}'::jsonb, 2870, true, false, false, false, false, 8),
    (rid, c_chay, '{"en":"зеленый чай (чайник)","ru":"зеленый чай (чайник)","kz":"жасыл шай (шайнек)"}'::jsonb,                                      870,  true, false, false, false, false, 9),
    (rid, c_chay, '{"en":"малина-мята (чайник)","ru":"малина-мята (чайник)","kz":"таңқурай-жалбыз (шайнек)"}'::jsonb,                                 1270, true, false, false, false, false, 10),
    (rid, c_chay, '{"en":"чай по-казахски (чайник)","ru":"чай по-казахски (чайник)","kz":"қазақша шай (шайнек)"}'::jsonb,                             1470, true, false, false, false, false, 11),
    (rid, c_chay, '{"en":"казахский чай с набором","ru":"казахский чай с набором","kz":"қазақша шай жиынтықпен"}'::jsonb,                              3070, true, false, false, false, false, 12),
    (rid, c_chay, '{"en":"летний чай (чайник)","ru":"летний чай (чайник)","kz":"жазғы шай (шайнек)"}'::jsonb,                                         1370, true, false, false, false, false, 13),
    (rid, c_chay, '{"en":"фирменный чай Assorti (чайник)","ru":"фирменный чай Assorti (чайник)","kz":"фирмалық шай Assorti (шайнек)"}'::jsonb,         1570, true, false, false, false, false, 14),
    (rid, c_chay, '{"en":"жұмыстың шәйі (чайник)","ru":"жұмыстың шәйі (чайник)","kz":"жұмыстың шәйі (шайнек)"}'::jsonb,                              1470, true, false, false, false, false, 15),
    (rid, c_chay, '{"en":"турецкий чай 3,4 л (чайник)","ru":"турецкий чай 3,4 л (чайник)","kz":"түрік шайы 3,4 л (шайнек)"}'::jsonb,                  2370, true, false, false, false, false, 16),
    (rid, c_chay, '{"en":"турецкий чай 3,4 л с восточными сладостями","ru":"турецкий чай 3,4 л с восточными сладостями","kz":"түрік шайы 3,4 л шығыс тәттілерімен"}'::jsonb, 3370, true, false, false, false, false, 17);

  -- Лимонад 1 л (12)
  INSERT INTO products (restaurant_id, category_id, name, price, is_available, is_archived, is_new, is_popular, is_spicy, order_index) VALUES
    (rid, c_limon1, '{"en":"классик 1 л","ru":"классик 1 л","kz":"классик 1 л"}'::jsonb,                  2170, true, false, false, false, false, 1),
    (rid, c_limon1, '{"en":"мохито 1 л","ru":"мохито 1 л","kz":"мохито 1 л"}'::jsonb,                    2170, true, false, false, false, false, 2),
    (rid, c_limon1, '{"en":"манго-маракуйя 1 л","ru":"манго-маракуйя 1 л","kz":"манго-маракуйя 1 л"}'::jsonb, 2170, true, false, false, false, false, 3),
    (rid, c_limon1, '{"en":"малина-мята 1 л","ru":"малина-мята 1 л","kz":"таңқурай-жалбыз 1 л"}'::jsonb,  2170, true, false, false, false, false, 4),
    (rid, c_limon1, '{"en":"киви-яблоко 1 л","ru":"киви-яблоко 1 л","kz":"киви-алма 1 л"}'::jsonb,       2170, true, false, false, false, false, 5),
    (rid, c_limon1, '{"en":"мохито-клубника 1 л","ru":"мохито-клубника 1 л","kz":"мохито-құлпынай 1 л"}'::jsonb, 2170, true, false, false, false, false, 6),
    (rid, c_limon1, '{"en":"киви-лайм 1 л","ru":"киви-лайм 1 л","kz":"киви-лайм 1 л"}'::jsonb,          2170, true, false, false, false, false, 7),
    (rid, c_limon1, '{"en":"ягодный 1 л","ru":"ягодный 1 л","kz":"жидекті 1 л"}'::jsonb,                 2170, true, false, false, false, false, 8),
    (rid, c_limon1, '{"en":"апельсин 1 л","ru":"апельсин 1 л","kz":"апельсин 1 л"}'::jsonb,              2170, true, false, false, false, false, 9),
    (rid, c_limon1, '{"en":"тропический 1 л","ru":"тропический 1 л","kz":"тропикалық 1 л"}'::jsonb,      2170, true, false, false, false, false, 10),
    (rid, c_limon1, '{"en":"клубника 1 л","ru":"клубника 1 л","kz":"құлпынай 1 л"}'::jsonb,              2170, true, false, false, false, false, 11),
    (rid, c_limon1, '{"en":"блю курасао 1 л","ru":"блю курасао 1 л","kz":"блю курасао 1 л"}'::jsonb,     2170, true, false, false, false, false, 12);

  -- Лимонад 0,5 л (12)
  INSERT INTO products (restaurant_id, category_id, name, price, is_available, is_archived, is_new, is_popular, is_spicy, order_index) VALUES
    (rid, c_limon05, '{"en":"классик 0,5 л","ru":"классик 0,5 л","kz":"классик 0,5 л"}'::jsonb,                  970, true, false, false, false, false, 1),
    (rid, c_limon05, '{"en":"мохито 0,5 л","ru":"мохито 0,5 л","kz":"мохито 0,5 л"}'::jsonb,                    970, true, false, false, false, false, 2),
    (rid, c_limon05, '{"en":"манго-маракуйя 0,5 л","ru":"манго-маракуйя 0,5 л","kz":"манго-маракуйя 0,5 л"}'::jsonb, 970, true, false, false, false, false, 3),
    (rid, c_limon05, '{"en":"малина-мята 0,5 л","ru":"малина-мята 0,5 л","kz":"таңқурай-жалбыз 0,5 л"}'::jsonb,  970, true, false, false, false, false, 4),
    (rid, c_limon05, '{"en":"киви-яблоко 0,5 л","ru":"киви-яблоко 0,5 л","kz":"киви-алма 0,5 л"}'::jsonb,       970, true, false, false, false, false, 5),
    (rid, c_limon05, '{"en":"мохито-клубника 0,5 л","ru":"мохито-клубника 0,5 л","kz":"мохито-құлпынай 0,5 л"}'::jsonb, 970, true, false, false, false, false, 6),
    (rid, c_limon05, '{"en":"киви-лайм 0,5 л","ru":"киви-лайм 0,5 л","kz":"киви-лайм 0,5 л"}'::jsonb,          970, true, false, false, false, false, 7),
    (rid, c_limon05, '{"en":"ягодный 0,5 л","ru":"ягодный 0,5 л","kz":"жидекті 0,5 л"}'::jsonb,                 970, true, false, false, false, false, 8),
    (rid, c_limon05, '{"en":"апельсин 0,5 л","ru":"апельсин 0,5 л","kz":"апельсин 0,5 л"}'::jsonb,              970, true, false, false, false, false, 9),
    (rid, c_limon05, '{"en":"тропический 0,5 л","ru":"тропический 0,5 л","kz":"тропикалық 0,5 л"}'::jsonb,      970, true, false, false, false, false, 10),
    (rid, c_limon05, '{"en":"клубника 0,5 л","ru":"клубника 0,5 л","kz":"құлпынай 0,5 л"}'::jsonb,              970, true, false, false, false, false, 11),
    (rid, c_limon05, '{"en":"блю курасао 0,5 л","ru":"блю курасао 0,5 л","kz":"блю курасао 0,5 л"}'::jsonb,     970, true, false, false, false, false, 12);

  -- Напитки (11)
  INSERT INTO products (restaurant_id, category_id, name, price, is_available, is_archived, is_new, is_popular, is_spicy, order_index) VALUES
    (rid, c_napitki, '{"en":"Bonaqua 0,5 л","ru":"Bonaqua 0,5 л","kz":"Bonaqua 0,5 л"}'::jsonb,                470,  true, false, false, false, false, 1),
    (rid, c_napitki, '{"en":"Bonaqua 1 л","ru":"Bonaqua 1 л","kz":"Bonaqua 1 л"}'::jsonb,                      670,  true, false, false, false, false, 2),
    (rid, c_napitki, '{"en":"Coca-Cola 0,5 л","ru":"Coca-Cola 0,5 л","kz":"Coca-Cola 0,5 л"}'::jsonb,          870,  true, false, false, false, false, 3),
    (rid, c_napitki, '{"en":"Coca-Cola 1 л","ru":"Coca-Cola 1 л","kz":"Coca-Cola 1 л"}'::jsonb,                1070, true, false, false, false, false, 4),
    (rid, c_napitki, '{"en":"Sprite 1 л","ru":"Sprite 1 л","kz":"Sprite 1 л"}'::jsonb,                         1070, true, false, false, false, false, 5),
    (rid, c_napitki, '{"en":"энергетик 0,4 л","ru":"энергетик 0,4 л","kz":"энергетик 0,4 л"}'::jsonb,          970,  true, false, false, false, false, 6),
    (rid, c_napitki, '{"en":"Fuse Tea 1 л","ru":"Fuse Tea 1 л","kz":"Fuse Tea 1 л"}'::jsonb,                   970,  true, false, false, false, false, 7),
    (rid, c_napitki, '{"en":"Fanta 1 л","ru":"Fanta 1 л","kz":"Fanta 1 л"}'::jsonb,                            1070, true, false, false, false, false, 8),
    (rid, c_napitki, '{"en":"Fanta 0,5 л","ru":"Fanta 0,5 л","kz":"Fanta 0,5 л"}'::jsonb,                      870,  true, false, false, false, false, 9),
    (rid, c_napitki, '{"en":"сок (для детей) 0,25 л","ru":"сок (для детей) 0,25 л","kz":"сок (балаларға) 0,25 л"}'::jsonb, 470, true, false, false, false, false, 10),
    (rid, c_napitki, '{"en":"Pico натуральный сок 1 л","ru":"Pico натуральный сок 1 л","kz":"Pico табиғи шырын 1 л"}'::jsonb, 1370, true, false, false, false, false, 11);

  -- Десерты (9)
  INSERT INTO products (restaurant_id, category_id, name, price, is_available, is_archived, is_new, is_popular, is_spicy, order_index) VALUES
    (rid, c_deserty, '{"en":"молочная девочка","ru":"молочная девочка","kz":"молочная девочка"}'::jsonb,        1670, true, false, false, false, false, 1),
    (rid, c_deserty, '{"en":"чизкейк","ru":"чизкейк","kz":"чизкейк"}'::jsonb,                                  1570, true, false, false, false, false, 2),
    (rid, c_deserty, '{"en":"сникерс","ru":"сникерс","kz":"сникерс"}'::jsonb,                                  1670, true, false, false, false, false, 3),
    (rid, c_deserty, '{"en":"киндер","ru":"киндер","kz":"киндер"}'::jsonb,                                      1670, true, false, false, false, false, 4),
    (rid, c_deserty, '{"en":"ванильное мороженое","ru":"ванильное мороженое","kz":"ваниль балмұздағы"}'::jsonb,  1370, true, false, false, false, false, 5),
    (rid, c_deserty, '{"en":"шоколадное мороженое","ru":"шоколадное мороженое","kz":"шоколад балмұздағы"}'::jsonb, 1370, true, false, false, false, false, 6),
    (rid, c_deserty, '{"en":"клубничное мороженое","ru":"клубничное мороженое","kz":"құлпынай балмұздағы"}'::jsonb, 1370, true, false, false, false, false, 7),
    (rid, c_deserty, '{"en":"ассорти мороженое","ru":"ассорти мороженое","kz":"ассорти балмұздақ"}'::jsonb,     1370, true, false, false, false, false, 8),
    (rid, c_deserty, '{"en":"восточные сладости","ru":"восточные сладости","kz":"шығыс тәттілері"}'::jsonb,     2570, true, false, false, false, false, 9);

  -- Кофе (12)
  INSERT INTO products (restaurant_id, category_id, name, price, is_available, is_archived, is_new, is_popular, is_spicy, order_index) VALUES
    (rid, c_kofe, '{"en":"эспрессо","ru":"эспрессо","kz":"эспрессо"}'::jsonb,                          770,  true, false, false, false, false, 1),
    (rid, c_kofe, '{"en":"американо","ru":"американо","kz":"американо"}'::jsonb,                        1170, true, false, false, false, false, 2),
    (rid, c_kofe, '{"en":"капучино","ru":"капучино","kz":"капучино"}'::jsonb,                           1170, true, false, false, false, false, 3),
    (rid, c_kofe, '{"en":"фраппучино","ru":"фраппучино","kz":"фраппучино"}'::jsonb,                    1170, true, false, false, false, false, 4),
    (rid, c_kofe, '{"en":"флэт уайт","ru":"флэт уайт","kz":"флэт уайт"}'::jsonb,                      1170, true, false, false, false, false, 5),
    (rid, c_kofe, '{"en":"латте","ru":"латте","kz":"латте"}'::jsonb,                                    1170, true, false, false, false, false, 6),
    (rid, c_kofe, '{"en":"cold brew coffee","ru":"cold brew coffee","kz":"cold brew coffee"}'::jsonb,   2200, true, false, false, false, false, 7),
    (rid, c_kofe, '{"en":"раф","ru":"раф","kz":"раф"}'::jsonb,                                          1270, true, false, false, false, false, 8),
    (rid, c_kofe, '{"en":"латте макиато","ru":"латте макиато","kz":"латте макиато"}'::jsonb,            1170, true, false, false, false, false, 9),
    (rid, c_kofe, '{"en":"горячий шоколад","ru":"горячий шоколад","kz":"ыстық шоколад"}'::jsonb,       1270, true, false, false, false, false, 10),
    (rid, c_kofe, '{"en":"холодный американо","ru":"холодный американо","kz":"суық американо"}'::jsonb,  870, true, false, false, false, false, 11),
    (rid, c_kofe, '{"en":"аффогато","ru":"аффогато","kz":"аффогато"}'::jsonb,                           1270, true, false, false, false, false, 12);

  -- Молочные коктейли (4)
  INSERT INTO products (restaurant_id, category_id, name, price, is_available, is_archived, is_new, is_popular, is_spicy, order_index) VALUES
    (rid, c_kokteyly, '{"en":"молочный коктейль сникерс 0,5 л","ru":"молочный коктейль сникерс 0,5 л","kz":"сникерс сүтті коктейлі 0,5 л"}'::jsonb,    1770, true, false, false, false, false, 1),
    (rid, c_kokteyly, '{"en":"молочный коктейль банан 0,5 л","ru":"молочный коктейль банан 0,5 л","kz":"банан сүтті коктейлі 0,5 л"}'::jsonb,            1770, true, false, false, false, false, 2),
    (rid, c_kokteyly, '{"en":"молочный коктейль клубника 0,5 л","ru":"молочный коктейль клубника 0,5 л","kz":"құлпынай сүтті коктейлі 0,5 л"}'::jsonb,  1770, true, false, false, false, false, 3),
    (rid, c_kokteyly, '{"en":"молочный коктейль орео 0,5 л","ru":"молочный коктейль орео 0,5 л","kz":"орео сүтті коктейлі 0,5 л"}'::jsonb,              1770, true, false, false, false, false, 4);

  -- Сиропы (4)
  INSERT INTO products (restaurant_id, category_id, name, price, is_available, is_archived, is_new, is_popular, is_spicy, order_index) VALUES
    (rid, c_siropy, '{"en":"сироп карамель","ru":"сироп карамель","kz":"карамель сиропы"}'::jsonb,         270, true, false, false, false, false, 1),
    (rid, c_siropy, '{"en":"сироп кокосовый","ru":"сироп кокосовый","kz":"кокос сиропы"}'::jsonb,          270, true, false, false, false, false, 2),
    (rid, c_siropy, '{"en":"сироп фисташковый","ru":"сироп фисташковый","kz":"фисташка сиропы"}'::jsonb,   270, true, false, false, false, false, 3),
    (rid, c_siropy, '{"en":"сироп шоколадный","ru":"сироп шоколадный","kz":"шоколад сиропы"}'::jsonb,      270, true, false, false, false, false, 4);

  RAISE NOTICE 'Seed complete — 30 categories, 302 products inserted for restaurant %', rid;
END $$;
