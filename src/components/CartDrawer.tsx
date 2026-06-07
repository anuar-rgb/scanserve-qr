"use client";

import { useState, useEffect } from "react";
import { X, Plus, Minus, Check, ChevronLeft, ChevronDown, Trash2, Star, Copy } from "lucide-react";
import { resolve, type Lang, type Dish, type PaymentInfo } from "./MenuTemplate";
import { supabase, isConfigured } from "@/lib/supabase";
import { fetchPaymentBanks } from "@/lib/fetch-menu";
import type { DbPaymentBank } from "@/lib/db-types";
import { RESTAURANT_ID, DB_TABLES } from "@/constants";
import { capFirst } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

export type CartMap = Record<string, { dish: Dish; qty: number; currency: string; cartKey: string; selectedModifiers?: { id: string; name: string; price: number }[] }>;

interface GuestTable { id: string; label: string; seats: number; }

type PaymentMethod = "pay-at-restaurant" | "cash" | "kaspi" | "card-transfer" | "remote-payment";
type OrderType = "dine-in" | "pickup" | "delivery";
type TimingMode = "asap" | "preorder";
type Step = "cart" | "checkout" | "success";

interface PlacedOrder {
  restaurantName: string;
  orderType: OrderType;
  timingMode: TimingMode;
  preorderDate?: string;
  preorderTime?: string;
  tableNumber?: string;
  deliveryAddress?: string;
  cityName?: string;
  paymentMethod: PaymentMethod;
  selectedBankIdx?: number;
  remoteBank?: "kaspi" | "halyk";
  invoicePhone?: string;
  paymentComment?: string;
  notes?: string;
  phoneNumber?: string;
  items: { name: string; qty: number; price: number; currency: string }[];
  total: number;
  currency: string;
  deliveryFee?: number;
  savings?: number;
  tipsAmount?: number;
}

export interface StoredOrder {
  id: string;
  clientId: string;
  timestamp: number;
  restaurantName: string;
  orderType: "dine-in" | "pickup" | "delivery";
  timingMode?: "asap" | "preorder";
  preorderDate?: string;
  preorderTime?: string;
  tableNumber?: string;
  items: { name: string; qty: number; price: number; currency: string }[];
  total: number;
  currency: string;
  status: "pending" | "refund-requested";
}

// ── Design tokens (mirrors MenuTemplate) ──────────────────────────────────────

const SP = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
const R  = { sm: 10, md: 20, lg: 24, full: 999 } as const;
const DELIVERY_FEE = 600;

function effPrice(dish: Dish, selectedModifiers?: { id: string; name: string; price: number }[]): number {
  const modTotal = selectedModifiers?.reduce((s, m) => s + m.price, 0) ?? 0;
  if (!dish.isPromo || !dish.discountLabel) return dish.price + modTotal;
  const pct = parseInt(dish.discountLabel, 10);
  if (isNaN(pct) || pct <= 0 || pct >= 100) return dish.price + modTotal;
  return Math.round(dish.price * (1 - pct / 100)) + modTotal;
}

// ── Kazakhstan cities ─────────────────────────────────────────────────────────

const KZ_CITIES: { id: string; en: string; ru: string; kz: string }[] = [
  { id: "abai",            en: "Abai",            ru: "Абай",            kz: "Абай"           },
  { id: "aksai",           en: "Aksai",           ru: "Аксай",           kz: "Ақсай"          },
  { id: "aksu",            en: "Aksu",            ru: "Аксу",            kz: "Ақсу"           },
  { id: "aktau",           en: "Aktau",           ru: "Актау",           kz: "Ақтау"          },
  { id: "aktobe",          en: "Aktobe",          ru: "Актобе",          kz: "Ақтөбе"         },
  { id: "almaty",          en: "Almaty",          ru: "Алматы",          kz: "Алматы"         },
  { id: "altay",           en: "Altay",           ru: "Алтай",           kz: "Алтай"          },
  { id: "aral",            en: "Aral",            ru: "Арал",            kz: "Арал"           },
  { id: "arkalyk",         en: "Arkalyk",         ru: "Аркалык",         kz: "Арқалық"        },
  { id: "astana",          en: "Astana",          ru: "Астана",          kz: "Астана"         },
  { id: "atbasar",         en: "Atbasar",         ru: "Атбасар",         kz: "Атбасар"        },
  { id: "atyrau",          en: "Atyrau",          ru: "Атырау",          kz: "Атырау"         },
  { id: "baikonur",        en: "Baikonur",        ru: "Байконур",        kz: "Байқоңыр"       },
  { id: "balkhash",        en: "Balkhash",        ru: "Балхаш",          kz: "Балқаш"         },
  { id: "beyneu",          en: "Beyneu",          ru: "Бейнеу",          kz: "Бейнеу"         },
  { id: "ekibastuz",       en: "Ekibastuz",       ru: "Экибастуз",       kz: "Екібастұз"      },
  { id: "embi",            en: "Embi",            ru: "Эмба",            kz: "Емба"           },
  { id: "esik",            en: "Esik",            ru: "Есик",            kz: "Есік"           },
  { id: "fort_shevchenko", en: "Fort Shevchenko", ru: "Форт-Шевченко",   kz: "Форт-Шевченко" },
  { id: "kandyagash",      en: "Kandyagash",      ru: "Кандыагаш",       kz: "Қандыағаш"      },
  { id: "karagandy",       en: "Karagandy",       ru: "Қарағанды",       kz: "Қарағанды"      },
  { id: "kaskelen",        en: "Kaskelen",        ru: "Каскелен",        kz: "Қаскелен"       },
  { id: "kentau",          en: "Kentau",          ru: "Кентау",          kz: "Кентау"         },
  { id: "khromtau",        en: "Khromtau",        ru: "Хромтау",         kz: "Хромтау"        },
  { id: "kokshetau",       en: "Kokshetau",       ru: "Кокшетау",        kz: "Көкшетау"       },
  { id: "kostanay",        en: "Kostanay",        ru: "Костанай",        kz: "Қостанай"       },
  { id: "kyzylorda",       en: "Kyzylorda",       ru: "Кызылорда",       kz: "Қызылорда"      },
  { id: "lisakovsk",       en: "Lisakovsk",       ru: "Лисаковск",       kz: "Лисаковск"      },
  { id: "oral",            en: "Oral",            ru: "Орал",            kz: "Орал"           },
  { id: "oskemen",         en: "Oskemen",         ru: "Өскемен",         kz: "Өскемен"        },
  { id: "pavlodar",        en: "Pavlodar",        ru: "Павлодар",        kz: "Павлодар"       },
  { id: "petropavl",       en: "Petropavl",       ru: "Петропавл",       kz: "Петропавл"      },
  { id: "qonayev",         en: "Qonayev",         ru: "Конаев",          kz: "Қонаев"         },
  { id: "ridder",          en: "Ridder",          ru: "Риддер",          kz: "Риддер"         },
  { id: "rudny",           en: "Rudny",           ru: "Рудный",          kz: "Рудный"         },
  { id: "saryagash",       en: "Saryagash",       ru: "Сарыагаш",        kz: "Сарыағаш"       },
  { id: "satpayev",        en: "Satpayev",        ru: "Сатпаев",         kz: "Сатпаев"        },
  { id: "semey",           en: "Semey",           ru: "Семей",           kz: "Семей"          },
  { id: "shakhtinsk",      en: "Shakhtinsk",      ru: "Шахтинск",        kz: "Шахтинск"       },
  { id: "shchuchinsk",     en: "Shchuchinsk",     ru: "Щучинск",         kz: "Щучинск"        },
  { id: "shu",             en: "Shu",             ru: "Шу",              kz: "Шу"             },
  { id: "shymkent",        en: "Shymkent",        ru: "Шымкент",         kz: "Шымкент"        },
  { id: "stepnogorsk",     en: "Stepnogorsk",     ru: "Степногорск",     kz: "Степногорск"    },
  { id: "taldykorgan",     en: "Taldykorgan",     ru: "Талдыкорган",     kz: "Талдықорған"    },
  { id: "talgar",          en: "Talgar",          ru: "Талгар",          kz: "Талғар"         },
  { id: "taraz",           en: "Taraz",           ru: "Тараз",           kz: "Тараз"          },
  { id: "tekeli",          en: "Tekeli",          ru: "Текели",          kz: "Текелі"         },
  { id: "temirtau",        en: "Temirtau",        ru: "Темиртау",        kz: "Теміртау"       },
  { id: "turgai",          en: "Turgai",          ru: "Тургай",          kz: "Торғай"         },
  { id: "turkestan",       en: "Turkestan",       ru: "Туркестан",       kz: "Түркістан"      },
  { id: "zhanaozen",       en: "Zhanaozen",       ru: "Жанаозен",        kz: "Жаңаөзен"       },
  { id: "zhanibek",        en: "Zhanibek",        ru: "Жанибек",         kz: "Жаңыбек"        },
  { id: "zharkent",        en: "Zharkent",        ru: "Жаркент",         kz: "Жаркент"        },
  { id: "zhezkazgan",      en: "Zhezkazgan",      ru: "Жезказган",       kz: "Жезқазған"      },
];

// ── UI translations ───────────────────────────────────────────────────────────

const T: Record<string, Record<Lang, string>> = {
  cart:              { en: "Your Cart",                               ru: "Ваш заказ",                                   kz: "Тапсырыс"                              },
  emptyCart:         { en: "Your cart is empty",                      ru: "Корзина пуста",                               kz: "Себет бос"                             },
  emptyHint:         { en: "Add dishes to get started",               ru: "Добавьте блюда для начала",                   kz: "Тағам қосыңыз"                         },
  total:             { en: "Total",                                   ru: "Итого",                                       kz: "Барлығы"                               },
  checkout:          { en: "Checkout",                                ru: "Оформить заказ",                              kz: "Тапсырыс беру"                         },
  checkoutTitle:     { en: "Checkout",                                ru: "Оформление заказа",                           kz: "Тапсырысты рәсімдеу"                   },
  selectOrderType:   { en: "Order Type",                              ru: "Тип заказа",                                  kz: "Тапсырыс түрі"                         },
  dineIn:            { en: "Dine-in",                                 ru: "В заведении",                                 kz: "Мекемеде"                              },
  pickup:            { en: "Pickup",                                  ru: "Самовывоз",                                   kz: "Өзіңіз алу"                            },
  delivery:          { en: "Delivery",                                ru: "Доставка",                                    kz: "Жеткізу"                               },
  tableNum:          { en: "Table number or area name",               ru: "Номер стола или название места",              kz: "Үстел нөмірі немесе орын атауы"        },
  tableHint:         { en: "e.g. Topchan 1, VIP 5, Table 3",         ru: "Например: Топчан 1, Кабина 5",                kz: "Мысалы: Топчан 1, Кабина 5"            },
  deliveryAddr:      { en: "Delivery Address",                        ru: "Адрес доставки",                              kz: "Жеткізу мекенжайы"                     },
  addrHint:          { en: "Street, house, apartment",                ru: "Улица, дом, квартира",                        kz: "Көше, үй, пәтер"                       },
  pickupReady:       { en: "Your order will be ready for pickup at the counter in 15–20 min.", ru: "Ваш заказ будет готов на кассе через 15–20 мин.", kz: "Тапсырысыңыз 15–20 минутта кассада дайын болады." },
  notes:             { en: "Comments / Notes",                        ru: "Комментарии / Пожелания",                     kz: "Ескертулер"                            },
  notesHint:         { en: "e.g. no onions, extra sauce…",            ru: "Например: без лука, дополнительный соус…",    kz: "Мысалы: пиязсыз, қосымша тұздық…"     },
  optional:          { en: "optional",                                ru: "необязательно",                               kz: "міндетті емес"                         },
  payment:           { en: "Payment",                                 ru: "Оплата",                                      kz: "Төлем"                                 },
  payAtRest:         { en: "Pay at Restaurant",                       ru: "Оплата в заведении",                          kz: "Мекемеде төлеу"                        },
  payAtRestSub:      { en: "Cash or POS terminal",                    ru: "Наличные или терминал",                       kz: "Қолма-қол немесе терминал"             },
  cash:              { en: "Cash",                                    ru: "Наличными",                                   kz: "Қолма-қол"                             },
  cashSub:           { en: "Pay in cash on arrival",                  ru: "Оплата наличными при получении",              kz: "Алу кезінде қолма-қол төлеу"           },
  kaspi:             { en: "Kaspi Transfer",                          ru: "Kaspi перевод",                               kz: "Kaspi аударым"                         },
  kaspiSub:          { en: "Send to phone number",                    ru: "Перевод на номер телефона",                   kz: "Телефонға аударым"                     },
  kaspiAfter:        { en: "Transfer after placing order",            ru: "Переведите после подтверждения заказа",       kz: "Тапсырыс берген соң аударыңыз"         },
  cardTransfer:      { en: "Card Transfer",                           ru: "Перевод на карту",                            kz: "Картаға аударым"                       },
  cardTransferSub:   { en: "Transfer to bank card",                   ru: "Перевод на банковскую карту",                 kz: "Банк картасына аударым"                },
  cardTransferAfter: { en: "Please transfer the total to the number below:", ru: "Переведите сумму заказа на номер ниже:", kz: "Тапсырыс сомасын төмендегі нөмірге аударыңыз:" },
  placeOrder:        { en: "Place Order via WhatsApp",                ru: "Отправить заказ в WhatsApp",                  kz: "WhatsApp арқылы тапсырыс беру"         },
  back:              { en: "Back",                                    ru: "Назад",                                       kz: "Артқа"                                 },
  success:           { en: "Order Sent!",                             ru: "Заказ отправлен!",                            kz: "Тапсырыс жіберілді!"                   },
  successSub:        { en: "Your order was sent via WhatsApp.",       ru: "Заказ отправлен через WhatsApp.",             kz: "Тапсырысыңыз WhatsApp арқылы жіберілді." },
  table:             { en: "Table",                                   ru: "Стол",                                        kz: "Үстел"                                 },
  address:           { en: "Address",                                 ru: "Адрес",                                       kz: "Мекенжай"                              },
  orderTypeLabel:    { en: "Order type",                              ru: "Тип заказа",                                  kz: "Тапсырыс түрі"                         },
  summary:           { en: "Order Summary",                          ru: "Состав заказа",                               kz: "Тапсырыс мазмұны"                      },
  backToMenu:        { en: "Back to Menu",                            ru: "Вернуться в меню",                            kz: "Мәзірге оралу"                         },
  notesLabel:        { en: "Notes",                                   ru: "Пожелания",                                   kz: "Ескертулер"                            },
  recipient:         { en: "Recipient",                               ru: "Получатель",                                  kz: "Алушы"                                 },
  clearCart:         { en: "Clear Cart",                              ru: "Очистить корзину",                            kz: "Себетті тазарту"                       },
  clearConfirm:      { en: "Remove all items from your cart?",        ru: "Удалить все блюда из корзины?",               kz: "Себеттегі барлық тағамдарды жоюға болады ма?" },
  cancel:            { en: "Cancel",                                  ru: "Отмена",                                      kz: "Болдырмау"                             },
  clearConfirmBtn:   { en: "Clear",                                   ru: "Очистить",                                    kz: "Тазарту"                               },
  deliveryFee:       { en: "Delivery fee",                            ru: "Доставка",                                    kz: "Жеткізу"                               },
  savings:           { en: "Your savings",                            ru: "Ваша экономия",                               kz: "Үнемдедіңіз"                           },
  cityLabel:         { en: "City",                                    ru: "Город",                                       kz: "Қала"                                  },
  citySelect:        { en: "Select city",                             ru: "Выберите город",                              kz: "Қала таңдаңыз"                         },
  citySearchHint:    { en: "Search city...",                          ru: "Поиск города...",                             kz: "Қала іздеу..."                         },
  noCityFound:       { en: "No cities found",                         ru: "Города не найдены",                           kz: "Қала табылмады"                        },
  phoneLabel:              { en: "Your Phone Number",                                          ru: "Ваш номер телефона",                                          kz: "Телефон нөміріңіз"                                              },
  deliveryPhoneLabel:      { en: "Your delivery contact number",                               ru: "Ваш номер телефона для доставки",                             kz: "Жеткізуге арналған телефон нөміріңіз"                           },
  phonePlaceholder:        { en: "+7 (7xx) xxx-xx-xx",                                         ru: "+7 (7xx) xxx-xx-xx",                                          kz: "+7 (7xx) xxx-xx-xx"                                             },
  invoicePhoneLabel:       { en: "Phone number for invoice (Kaspi/Halyk)",                     ru: "Номер телефона для выставления счета (Kaspi/Halyk)",           kz: "Шот жіберуге арналған телефон нөмірі (Kaspi/Halyk)"             },
  invoicePhonePlaceholder: { en: "Enter the number linked to your bank app",                   ru: "Введите номер, к которому привязан банк",                     kz: "Банкке тіркелген нөмірді енгізіңіз"                             },
  selectBank:           { en: "Select Bank",                             ru: "Выберите банк",                               kz: "Банк таңдаңыз"                         },
  remotePayment:        { en: "Remote Payment",                          ru: "Удаленная оплата",                            kz: "Қашықтан төлем"                        },
  remotePaymentSub:     { en: "Invoice via bank app",                    ru: "Счет через банковское приложение",            kz: "Банк арқылы шот жіберу"                },
  selectBankForInvoice: { en: "Select bank to send invoice",             ru: "Выберите банк для выставления счета",         kz: "Шот жіберу үшін банкті таңдаңыз"       },
  paymentComment:       { en: "Payment Comment (optional)",              ru: "Комментарий к оплате (необязательно)",        kz: "Төлемге түсініктеме (міндетті емес)"   },
  paymentCommentHint:   { en: "e.g. Waiting for invoice on Kaspi",       ru: "Например: Жду счет на Kaspi",                 kz: "Мысалы: Шотты Kaspi-ге жіберіңіз"     },
  kaspiBank:            { en: "Kaspi.kz",                                ru: "Kaspi.kz",                                    kz: "Kaspi.kz"                              },
  halykBank:            { en: "Halyk Bank",                              ru: "Halyk Bank",                                  kz: "Halyk Bank"                            },
  bankLabel:            { en: "Bank",                                     ru: "Банк",                                        kz: "Банк"                                  },
  rateOrder:            { en: "Rate Your Order",                          ru: "Оцените ваш заказ",                           kz: "Тапсырысыңызды бағалаңыз"              },
  reviewSend:           { en: "Submit Review",                            ru: "Отправить отзыв",                             kz: "Пікір жіберу"                          },
  reviewThanks:         { en: "Thank you for your review!",               ru: "Спасибо за ваш отзыв!",                      kz: "Пікіріңізге рахмет!"                   },
  reviewHint:           { en: "Your comment (optional)",                  ru: "Комментарий (необязательно)",                 kz: "Түсініктеме (міндетті емес)"           },
  tipsToggle:           { en: "Leave a tip for the team",                 ru: "Оставить чаевые команде",                     kz: "Команда үшін чаевые қалдыру"           },
  tipsPlaceholder:      { en: "Enter amount in ₸",                        ru: "Введите сумму в ₸",                           kz: "₸ сомасын енгізіңіз"                   },
  tipsApply:            { en: "Apply",                                    ru: "Применить",                                   kz: "Қолдану"                               },
  tipsLabel:            { en: "Tips",                                     ru: "Чаевые",                                      kz: "Чаевые"                                },
  timingLabel:          { en: "When?",                                    ru: "Когда?",                                      kz: "Қашан?"                                },
  asap:                 { en: "As Soon As Possible",                      ru: "Как можно быстрее",                           kz: "Мүмкіндігінше тез"                     },
  preorderMode:         { en: "Pre-order",                                ru: "Предзаказ",                                   kz: "Алдын ала тапсырыс"                    },
  preorderDate:         { en: "Date",                                     ru: "Дата",                                        kz: "Күн"                                   },
  preorderTime:         { en: "Time",                                     ru: "Время",                                       kz: "Уақыт"                                 },
  preorderFor:          { en: "Pre-order for",                            ru: "Предзаказ на",                                kz: "Алдын ала тапсырыс"                    },
  selectTable:          { en: "Choose a Table",                          ru: "Выберите стол",                               kz: "Үстел таңдаңыз"                        },
  tableOccupied:        { en: "Occupied",                                ru: "Занят",                                       kz: "Бос емес"                              },
  noTablesAvailable:    { en: "No tables available",                     ru: "Нет доступных столов",                        kz: "Бос үстел жоқ"                         },
  loadingTables:        { en: "Loading tables…",                         ru: "Загрузка столов…",                            kz: "Үстелдер жүктелуде…"                   },
  dineInSuccess:        { en: "Order Received!",                         ru: "Ваш заказ принят!",                           kz: "Тапсырысыңыз қабылданды!"              },
  dineInSuccessSub:     { en: "Our staff will attend to you shortly.",   ru: "Официант скоро подойдет.",                    kz: "Даяшы жақын арада келеді."             },
  sendOrder:            { en: "Place Order",                             ru: "Отправить заказ",                             kz: "Тапсырыс беру"                         },
};

const tn = (key: string, lang: Lang): string => T[key]?.[lang] ?? T[key]?.en ?? key;

// ── WhatsApp order ────────────────────────────────────────────────────────────

function buildWhatsAppUrl(
  order: PlacedOrder,
  phone: string,
  lang: Lang,
  kaspiPhone?: string,
  cardTransferOptions?: PaymentInfo[],
  orderId?: string,
  tipsAmount?: number,
): string {
  // Message-only translations (not shown in the UI, only in the WA message)
  const MSG: Record<string, Record<Lang, string>> = {
    newOrder:     { en: "NEW ORDER",               ru: "НОВЫЙ ЗАКАЗ",              kz: "ЖАНА ТАПСЫРЫС"           },
    orderLabel:   { en: "Order",                   ru: "Заказ",                    kz: "Тапсырыс"                 },
    typeLabel:    { en: "Type",                     ru: "Тип",                      kz: "Тури"                     },
    dineIn:       { en: "Dine-in",                  ru: "В заведении",              kz: "Мекемеде"                 },
    pickupType:   { en: "Pickup",                   ru: "Самовывоз",                kz: "Озинiз алу"               },
    deliveryType: { en: "Delivery",                 ru: "Доставка",                 kz: "Жеткiзу"                  },
    tableLabel:   { en: "Table",                    ru: "Стол",                     kz: "Устел"                    },
    addrLabel:    { en: "Address",                  ru: "Адрес",                    kz: "Мекенжай"                 },
    pickupInfo:   { en: "Pickup at counter",        ru: "Самовывоз на кассе",       kz: "Кассада алу"              },
    payLabel:     { en: "Payment",                  ru: "Оплата",                   kz: "Толем"                    },
    payAtRest:    { en: "Pay at Restaurant",        ru: "Оплата в заведении",       kz: "Мекемеде толеу"           },
    cashPay:      { en: "Cash",                     ru: "Наличными",                kz: "Колма-кол"                },
    kaspiPay:     { en: "Kaspi Transfer",           ru: "Kaspi перевод",            kz: "Kaspi аударым"            },
    cardPay:      { en: "Card Transfer",            ru: "Перевод на карту",         kz: "Картага аударым"          },
    dishesLabel:  { en: "Items",                    ru: "Блюда",                    kz: "Тагамдар"                 },
    totalLabel:   { en: "TOTAL",                    ru: "ИТОГО",                    kz: "БАРЛЫГЫ"                  },
    notesLabel:   { en: "Notes",                    ru: "Пожелания",                kz: "Ескертулер"               },
    recipient:    { en: "Recipient",                ru: "Получатель",               kz: "Алушы"                    },
    cityLabel:    { en: "City",                     ru: "Город",                    kz: "Кала"                     },
    phoneLabel:           { en: "Phone",                        ru: "Телефон",                              kz: "Телефон"                              },
    deliveryContactLabel: { en: "Delivery Contact",             ru: "Контакт для доставки",                 kz: "Жеткізу байланысы"                    },
    billingContactLabel:  { en: "Billing Contact",              ru: "Контакт для выставления счета",        kz: "Шот байланысы"                        },
    deliveryFeeLabel:     { en: "Delivery fee",                 ru: "Доставка",                             kz: "Жеткiзу"                              },
    remotePay:            { en: "Remote Payment",               ru: "Удаленная оплата",                     kz: "Қашықтан төлем"                       },
    bankLabel:            { en: "Bank",                         ru: "Банк",                                 kz: "Банк"                                 },
    kaspiBank:            { en: "Kaspi.kz",                     ru: "Kaspi.kz",                             kz: "Kaspi.kz"                             },
    halykBank:            { en: "Halyk Bank",                   ru: "Halyk Bank",                           kz: "Halyk Bank"                           },
    paymentCommentLabel:  { en: "Payment Comment",              ru: "Комментарий к оплате",                 kz: "Төлемге түсініктеме"                  },
    preorderLabel:        { en: "Pre-order",                   ru: "Предзаказ",                            kz: "Алдын ала тапсырыс"                   },
    preorderDateLabel:    { en: "Date",                        ru: "Дата",                                 kz: "Күн"                                  },
    preorderTimeLabel:    { en: "Time",                        ru: "Время",                                kz: "Уақыт"                                },
    commentsLabel:        { en: "Comments",                    ru: "Пожелания",                            kz: "Ескертулер"                           },
    tipsLabel:            { en: "Tips",                        ru: "Чаевые",                               kz: "Чаевые"                               },
  };

  const m = (key: string): string => MSG[key]?.[lang] ?? MSG[key]?.en ?? key;

  const orderTypeLabel =
    order.orderType === "dine-in" ? m("dineIn")
    : order.orderType === "pickup" ? m("pickupType")
    : m("deliveryType");

  const locationLine =
    order.orderType === "dine-in" && order.tableNumber
      ? `• ${m("tableLabel")}: ${order.tableNumber}`
      : order.orderType === "delivery" && order.deliveryAddress
      ? `• ${m("addrLabel")}: ${order.deliveryAddress}`
      : `• ${m("pickupInfo")}`;

  const selectedBank =
    order.paymentMethod === "card-transfer" &&
    order.selectedBankIdx != null &&
    cardTransferOptions?.[order.selectedBankIdx]
      ? cardTransferOptions[order.selectedBankIdx]
      : null;

  const remoteBankName =
    order.remoteBank === "kaspi" ? m("kaspiBank")
    : order.remoteBank === "halyk" ? m("halykBank")
    : "";

  const paymentMethodLabel =
    order.paymentMethod === "pay-at-restaurant" ? m("payAtRest")
    : order.paymentMethod === "cash"            ? m("cashPay")
    : order.paymentMethod === "kaspi"           ? m("kaspiPay")
    : order.paymentMethod === "remote-payment"  ? m("remotePay")
    : selectedBank
      ? `${m("cardPay")} (${selectedBank.bankName})`
      : m("cardPay");

  const paymentLines: string[] = [`• ${m("payLabel")}: ${paymentMethodLabel}`];
  if (order.paymentMethod === "kaspi" && kaspiPhone) {
    paymentLines.push(`   >> ${kaspiPhone}`);
  }
  if (order.paymentMethod === "remote-payment") {
    if (remoteBankName) paymentLines.push(`   • ${m("bankLabel")}: ${remoteBankName}`);
    if (order.invoicePhone) paymentLines.push(`   • ${m("billingContactLabel")}: ${order.invoicePhone}`);
    if (order.paymentComment) paymentLines.push(`   • ${m("paymentCommentLabel")}: ${order.paymentComment}`);
  }
  if (order.paymentMethod === "card-transfer" && cardTransferOptions?.length) {
    const optsToShow = selectedBank ? [selectedBank] : cardTransferOptions;
    optsToShow.forEach((o) => {
      const recip = o.recipientName ? ` · ${m("recipient")}: ${o.recipientName}` : "";
      paymentLines.push(`   • ${o.bankName}: ${o.phone}${recip}`);
    });
  }

  const lines = [
    ...(orderId ? [`*${m("orderLabel")} #${orderId}*`] : []),
    `**** ${order.restaurantName} — ${m("newOrder")} ****`,
    `• ${m("typeLabel")}: ${orderTypeLabel}`,
    ...(order.phoneNumber ? [`• ${order.orderType === "delivery" ? m("deliveryContactLabel") : m("phoneLabel")}: ${order.phoneNumber}`] : []),
    ...(order.cityName ? [`• ${m("cityLabel")}: ${order.cityName}`] : []),
    locationLine,
    ...paymentLines,
    `---`,
    `${m("dishesLabel")}:`,
    ...order.items.map(
      (i) => `• ${i.name} x${i.qty} — ${(i.price * i.qty).toLocaleString("ru-RU")} ${i.currency}`,
    ),
    ...(order.deliveryFee ? [`• 🚚 ${m("deliveryFeeLabel")}: ${order.deliveryFee.toLocaleString("ru-RU")} ${order.currency}`] : []),
    ...((tipsAmount && tipsAmount > 0) ? [`• 💝 ${m("tipsLabel")}: ${tipsAmount.toLocaleString("ru-RU")} ${order.currency}`] : []),
    `---`,
    `>> *${m("totalLabel")}: ${order.total.toLocaleString("ru-RU")} ${order.currency}*`,
    ...(order.timingMode === "preorder" ? [
      `📅 *${m("preorderLabel")}*`,
      `• ${m("preorderDateLabel")}: ${order.preorderDate ?? ""}`,
      `• ${m("preorderTimeLabel")}: ${order.preorderTime ?? ""}`,
    ] : []),
    ...(order.notes ? [`• ${m("notesLabel")}: ${order.notes}`] : []),
  ];

  // encodeURIComponent correctly percent-encodes Kazakh/Cyrillic characters (UTF-8)
  const text = encodeURIComponent(lines.join("\n"));
  const cleanPhone = phone.replace(/\D/g, "");
  return `https://wa.me/${cleanPhone}?text=${text}`;
}

function localDateISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatPreorderDate(dateStr: string, lang: Lang): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const ru = ["янв","фев","мар","апр","мая","июн","июл","авг","сен","окт","ноя","дек"];
  const kz = ["қан","ақп","нау","сәу","мам","мау","шіл","там","қыр","қаз","қар","жел"];
  const en = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const names = lang === "kz" ? kz : lang === "en" ? en : ru;
  return `${day} ${names[month - 1]} ${year}`;
}

// ── CartDrawer component ──────────────────────────────────────────────────────

export interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  cart: CartMap;
  onUpdateQty: (cartKey: string, delta: number) => void;
  lang: Lang;
  theme: "dark" | "light";
  restaurantName: string;
  currency: string;
  kaspiPhone?: string;
  whatsappPhone?: string;
  cardTransferOptions?: PaymentInfo[];
  onClearCart: () => void;
  onOrderPlaced?: (order: StoredOrder) => void;
  clientId?: string;
  initialTableNumber?: string;
}

export function CartDrawer({
  open,
  onClose,
  cart,
  onUpdateQty,
  lang,
  theme,
  restaurantName,
  currency,
  kaspiPhone = "+7 700 000 0000",
  whatsappPhone = "77012345678",
  cardTransferOptions,
  onClearCart,
  onOrderPlaced,
  clientId = "anon",
  initialTableNumber,
}: CartDrawerProps) {
  const isTableLocked = Boolean(initialTableNumber);
  const [step, setStep]                       = useState<Step>("cart");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [orderType, setOrderType]             = useState<OrderType | null>(isTableLocked ? "dine-in" : null);
  const [timingMode, setTimingMode]           = useState<TimingMode>("asap");
  const [preorderDate, setPreorderDate]       = useState("");
  const [preorderTime, setPreorderTime]       = useState("");
  const [tableNumber, setTableNumber]         = useState(initialTableNumber ?? "");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [notes, setNotes]                     = useState("");
  const [payment, setPayment]                 = useState<PaymentMethod | null>(isTableLocked ? "pay-at-restaurant" : null);
  const [cardBankIdx, setCardBankIdx]         = useState<number | null>(null);
  const [placedOrder, setPlacedOrder]         = useState<PlacedOrder | null>(null);
  const [loading, setLoading]                 = useState(false);
  const [remoteBank, setRemoteBank]           = useState<"kaspi" | "halyk" | null>(null);
  const [invoicePhone, setInvoicePhone]       = useState("");
  const [paymentComment, setPaymentComment]   = useState("");
  const [city, setCity]                       = useState("");
  const [citySearch, setCitySearch]           = useState("");
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const [phoneNumber, setPhoneNumber]         = useState("");
  const [customerName, setCustomerName]       = useState("");
  const [customerCity, setCustomerCity]       = useState("");
  const [placedOrderId, setPlacedOrderId]     = useState<string | null>(null);
  const [reviewRating, setReviewRating]       = useState(0);
  const [reviewComment, setReviewComment]     = useState("");
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [reviewLoading, setReviewLoading]     = useState(false);
  const [guestTables, setGuestTables]         = useState<GuestTable[]>([]);
  const [occupiedLabels, setOccupiedLabels]   = useState<Set<string>>(new Set());
  const [tablesLoading, setTablesLoading]     = useState(false);
  const [subTableConfirmBase, setSubTableConfirmBase] = useState<string | null>(null);
  const [paymentBanks, setPaymentBanks]               = useState<DbPaymentBank[]>([]);
  const [copiedIdx, setCopiedIdx]                     = useState<number | null>(null);
  const [tipsEnabled, setTipsEnabled]                 = useState(false);
  const [tipsInput, setTipsInput]                     = useState("");
  const [tipsAmount, setTipsAmount]                   = useState(0);
  const [guestSession, setGuestSession]               = useState<{id: string; name: string|null; phone: string|null; email?: string; bonusAmount: number} | null>(null);
  const [useBonuses, setUseBonuses]                   = useState(false);

  useEffect(() => {
    // Refresh guest session every time the drawer opens
    try {
      const raw = localStorage.getItem("menu-guest-session");
      const parsed = raw ? (JSON.parse(raw) as {id:string;name:string|null;phone:string|null;email?:string;bonusAmount:number}) : null;
      // Discard legacy password-based sessions (no email field)
      setGuestSession(parsed?.email ? parsed : null);
    } catch {
      setGuestSession(null);
    }
    setUseBonuses(false);

    if (!open || !isConfigured) return;
    let cancelled = false;
    async function fetchData() {
      setTablesLoading(true);
      const [tablesRes, ordersRes, banks] = await Promise.all([
        supabase
          .from(DB_TABLES.restaurantTables)
          .select("id, label, seats")
          .eq("restaurant_id", RESTAURANT_ID)
          .eq("is_active", true)
          .order("label"),
        supabase
          .from(DB_TABLES.orders)
          .select("table_number")
          .eq("restaurant_id", RESTAURANT_ID)
          .eq("status", "pending")
          .eq("type", "dine-in"),
        fetchPaymentBanks(RESTAURANT_ID),
      ]);
      if (cancelled) return;
      setGuestTables((tablesRes.data as GuestTable[]) ?? []);
      setOccupiedLabels(
        new Set(((ordersRes.data ?? []) as { table_number: string }[]).map((o) => o.table_number))
      );
      setPaymentBanks(banks ?? []);
      setTablesLoading(false);
    }
    fetchData();
    return () => { cancelled = true; };
  }, [open]);

  const isMobile = typeof navigator !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  const isDark  = theme === "dark";
  const bg      = isDark ? "#121212" : "#F5F5F7";
  const surface = isDark ? "#1C1C1C" : "#ECEEF0";
  const card    = isDark ? "#1E1E1E" : "#FFFFFF";
  const textClr = isDark ? "#E0E0E0" : "#121212";
  const muted   = isDark ? "#9A9A9A" : "#6B7280";
  const border  = isDark ? "#2A2A2A" : "#DDE1E6";

  const items        = Object.values(cart);
  const total        = items.reduce((s, { dish, qty, selectedModifiers }) => s + effPrice(dish, selectedModifiers) * qty, 0);
  const deliveryFee  = orderType === "delivery" ? DELIVERY_FEE : 0;
  // Bonuses can cover food + delivery but not tips (tips go to staff in cash)
  const maxBonuses   = guestSession ? Math.min(guestSession.bonusAmount, total + deliveryFee) : 0;
  const bonusesApplied = useBonuses ? maxBonuses : 0;
  const grandTotal   = total + deliveryFee + tipsAmount - bonusesApplied;
  const totalSavings = items.reduce((s, { dish, qty }) => {
    const promoBase = dish.isPromo && dish.discountLabel
      ? (() => { const pct = parseInt(dish.discountLabel, 10); return isNaN(pct) || pct <= 0 || pct >= 100 ? dish.price : Math.round(dish.price * (1 - pct / 100)); })()
      : dish.price;
    return s + (dish.price - promoBase) * qty;
  }, 0);
  const isEmpty      = items.length === 0;

  const phoneValid = (orderType === "pickup" || orderType === "delivery")
    ? phoneNumber.trim().replace(/\D/g, "").length >= 10
    : true;

  const bankOk =
    payment !== "remote-payment" ||
    (remoteBank !== null && invoicePhone.trim().replace(/\D/g, "").length >= 10);

  const preorderOk =
    timingMode === "asap" ||
    (preorderDate !== "" && preorderTime !== "");

  const preorderContactOk =
    timingMode !== "preorder" ||
    (customerName.trim().length > 0 &&
      (orderType !== "dine-in" || (phoneNumber.trim().length > 0 && customerCity.trim().length > 0)));

  const canPlaceOrder =
    bankOk &&
    orderType !== null &&
    payment !== null &&
    phoneValid &&
    preorderOk &&
    preorderContactOk &&
    (orderType === "dine-in"
      ? tableNumber.trim().length > 0
      : orderType === "delivery"
      ? deliveryAddress.trim().length > 0 && city !== ""
      : /* pickup */ city !== "");

  const handlePaymentSelect = (id: PaymentMethod) => {
    setPayment(id);
    setCardBankIdx(null);
    if (id !== "remote-payment") {
      setRemoteBank(null);
      setInvoicePhone("");
      setPaymentComment("");
    }
  };

  const iconBtn: React.CSSProperties = {
    width: 32, height: 32, borderRadius: R.full,
    border: `1px solid ${border}`, background: surface, color: textClr,
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", flexShrink: 0,
  };

  const primaryBtn = (disabled = false): React.CSSProperties => ({
    width: "100%", padding: "14px 0", borderRadius: R.full, border: "none",
    fontSize: 15, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer",
    letterSpacing: "0.02em", transition: "background 0.2s, color 0.2s",
    background: disabled ? border : textClr,
    color: disabled ? muted : bg,
  });

  const resetCheckout = () => {
    setOrderType(isTableLocked ? "dine-in" : null);
    setTimingMode("asap");
    setPreorderDate("");
    setPreorderTime("");
    if (!isTableLocked) setTableNumber("");
    setDeliveryAddress("");
    setNotes("");
    setPayment(null);
    setCardBankIdx(null);
    setPlacedOrder(null);
    setCity("");
    setCitySearch("");
    setCityDropdownOpen(false);
    setPhoneNumber("");
    setRemoteBank(null);
    setInvoicePhone("");
    setPaymentComment("");
    setPlacedOrderId(null);
    setReviewRating(0);
    setReviewComment("");
    setReviewSubmitted(false);
    setTipsEnabled(false);
    setTipsInput("");
    setTipsAmount(0);
    setUseBonuses(false);
  };

  const handleClose = () => {
    setShowClearConfirm(false);
    if (step === "success") {
      setStep("cart");
      resetCheckout();
    }
    onClose();
  };

  // Reset payment when order type changes if the current selection is incompatible.
  const handleOrderTypeSelect = (type: OrderType) => {
    setOrderType(type);
    setCardBankIdx(null);
    if (type === "dine-in") {
      setCity("");
      setCitySearch("");
      setCityDropdownOpen(false);
      setPayment("pay-at-restaurant");
    } else {
      if (payment === "pay-at-restaurant") setPayment(null);
    }
  };

  const handlePlaceOrder = async () => {
    if (!canPlaceOrder || loading) return;
    setLoading(true);
    const orderItems = items.map(({ dish, qty, currency: c, selectedModifiers }) => {
      const finalPrice = effPrice(dish, selectedModifiers);
      const modSuffix = selectedModifiers?.length
        ? ` (+ ${selectedModifiers.map(m => m.name).join(", ")})`
        : "";
      return {
        name: resolve(dish.name, lang) + modSuffix,
        qty,
        price: finalPrice,
        currency: c || currency,
        product_id: dish.id,
        ...(dish.isPromo && dish.discountLabel ? { original_price: dish.price } : {}),
      };
    });
    const foundCity = KZ_CITIES.find((c) => c.id === city);
    const order: PlacedOrder = {
      restaurantName,
      orderType: orderType!,
      timingMode,
      preorderDate: timingMode === "preorder" ? preorderDate : undefined,
      preorderTime: timingMode === "preorder" ? preorderTime : undefined,
      tableNumber: orderType === "dine-in" ? tableNumber.trim() : undefined,
      deliveryAddress: orderType === "delivery" ? deliveryAddress.trim() : undefined,
      cityName: foundCity ? foundCity[lang] : city || undefined,
      paymentMethod: payment!,
      selectedBankIdx: payment === "card-transfer" && cardBankIdx !== null ? cardBankIdx : undefined,
      remoteBank: payment === "remote-payment" && remoteBank !== null ? remoteBank : undefined,
      invoicePhone: payment === "remote-payment" && invoicePhone.trim() ? invoicePhone.trim() : undefined,
      paymentComment: payment === "remote-payment" && paymentComment.trim() ? paymentComment.trim() : undefined,
      notes: notes.trim() || undefined,
      phoneNumber: (orderType === "pickup" || orderType === "delivery") ? phoneNumber.trim() : undefined,
      items: orderItems,
      total: grandTotal,
      currency,
      deliveryFee: deliveryFee || undefined,
      savings: totalSavings || undefined,
      tipsAmount: tipsAmount || undefined,
    };
    const orderId = `ORD-${Date.now().toString(36).toUpperCase().slice(-6)}`;
    setPlacedOrderId(orderId);

    if (orderType === "dine-in") {
      // Direct Supabase insert — no WhatsApp redirect for table orders
      if (isConfigured) {
        // Auto-assign the waiter responsible for this table (from rotation)
        let assignedWaiterId: string | null = null;
        if (tableNumber.trim()) {
          const { data: tableRow } = await supabase
            .from(DB_TABLES.restaurantTables)
            .select("assigned_waiter_id")
            .eq("restaurant_id", RESTAURANT_ID)
            .eq("label", tableNumber.trim())
            .maybeSingle();
          assignedWaiterId = tableRow?.assigned_waiter_id ?? null;
        }

        const { error } = await supabase.from(DB_TABLES.orders).insert({
          id: orderId,
          restaurant_id: RESTAURANT_ID,
          table_number: tableNumber.trim() || null,
          items_json: orderItems,
          total_price: grandTotal,
          tips_amount: tipsAmount || 0,
          status: "pending",
          type: "dine-in",
          order_type: timingMode,
          payment_method: payment,
          preorder_date: timingMode === "preorder" ? preorderDate : null,
          preorder_time: timingMode === "preorder" ? preorderTime : null,
          customer_comments: notes.trim() || null,
          customer_name: timingMode === "preorder" ? (customerName.trim() || null) : null,
          customer_phone: timingMode === "preorder" ? (phoneNumber.trim() || null) : null,
          customer_city: timingMode === "preorder" ? (customerCity.trim() || null) : null,
          opened_by: assignedWaiterId,
          guest_id: guestSession?.id ?? null,
          used_bonuses: bonusesApplied > 0,
          bonuses_deducted: bonusesApplied,
        });
        if (error) {
          setLoading(false);
          return;
        }
      }
    } else {
      // pickup/delivery — build WhatsApp URL then save to DB, then redirect
      const bankInfos = paymentBanks.map(b => ({ bankName: b.bank_name, phone: b.phone, recipientName: b.recipient_name ?? undefined }));
      const url = buildWhatsAppUrl(order, whatsappPhone, lang, kaspiPhone, bankInfos.length ? bankInfos : cardTransferOptions, orderId, tipsAmount || undefined);

      if (isConfigured) {
        // Use values from `order` object — same source as WhatsApp message, avoids any state-read mismatch
        const { error: insertError } = await supabase.from(DB_TABLES.orders).insert({
          id: orderId,
          restaurant_id: RESTAURANT_ID,
          table_number: null,
          items_json: orderItems,
          total_price: order.total,
          tips_amount: order.tipsAmount ?? 0,
          status: "pending",
          type: order.orderType,
          order_type: order.timingMode,
          payment_method: order.paymentMethod,
          preorder_date: order.preorderDate ?? null,
          preorder_time: order.preorderTime ?? null,
          customer_comments: order.notes ?? null,
          customer_name: customerName.trim() || null,
          customer_phone: order.phoneNumber ?? null,
          customer_city: order.cityName ?? null,
          delivery_address: order.deliveryAddress ?? null,
          payment_bank: order.remoteBank ?? null,
          payment_phone: order.invoicePhone ?? null,
          guest_id: guestSession?.id ?? null,
          used_bonuses: bonusesApplied > 0,
          bonuses_deducted: bonusesApplied,
        });
        if (insertError) console.error("[CartDrawer] order insert failed:", insertError);
      }

      // Save phone to CRM (fire-and-forget — don't block WhatsApp redirect)
      if (order.phoneNumber) {
        fetch("/api/crm/register-phone", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: order.phoneNumber,
            ...(customerName.trim() ? { name: customerName.trim() } : {}),
          }),
        }).catch(() => {/* ignore */});
      }

      if (isMobile) {
        window.location.href = url;
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    }

    onClearCart();
    setPlacedOrder(order);
    setStep("success");
    setLoading(false);
    onOrderPlaced?.({
      id: orderId,
      clientId,
      timestamp: Date.now(),
      restaurantName,
      orderType: order.orderType,
      timingMode,
      preorderDate: order.preorderDate,
      preorderTime: order.preorderTime,
      tableNumber: order.tableNumber,
      items: orderItems,
      total: grandTotal,
      currency,
      status: "pending",
    });
  };

  const handleSubmitReview = async () => {
    if (reviewRating === 0 || reviewLoading) return;
    setReviewLoading(true);
    try {
      if (isConfigured) {
        await supabase.from("reviews").insert({
          restaurant_id: RESTAURANT_ID,
          order_id: placedOrderId,
          rating: reviewRating,
          comment: reviewComment.trim() || null,
        });
      }
    } finally {
      setReviewSubmitted(true);
      setReviewLoading(false);
    }
  };

  const filteredCities = KZ_CITIES.filter((c) => {
    if (!citySearch.trim()) return true;
    const q = citySearch.toLowerCase();
    return (
      c.en.toLowerCase().includes(q) ||
      c.ru.toLowerCase().includes(q) ||
      c.kz.toLowerCase().includes(q)
    );
  });

  const ORDER_TYPE_OPTIONS: { id: OrderType; icon: string; labelKey: string }[] = [
    { id: "dine-in",  icon: "🍽️", labelKey: "dineIn"   },
    { id: "pickup",   icon: "🛍️", labelKey: "pickup"   },
    { id: "delivery", icon: "🚚", labelKey: "delivery" },
  ];

  const labelSectionStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, letterSpacing: "0.07em",
    textTransform: "uppercase", color: muted,
    margin: `0 0 ${SP.sm}px`,
  };

  const textareaStyle = (filled: boolean): React.CSSProperties => ({
    display: "block", width: "100%", marginTop: SP.sm,
    padding: "13px 14px",
    background: surface,
    border: `1.5px solid ${filled ? textClr : border}`,
    borderRadius: R.md, color: textClr, fontSize: 15,
    outline: "none", boxSizing: "border-box",
    resize: "none",
    transition: "border-color 0.15s",
    fontFamily: "inherit",
  });

  // ── Payment options per order type ────────────────────────────────────────
  const dineInPaymentOptions: { id: PaymentMethod; icon: string; labelKey: string; subKey: string }[] = [
    { id: "pay-at-restaurant", icon: "🏧", labelKey: "payAtRest", subKey: "payAtRestSub" },
  ];
  const remotePaymentOptions: { id: PaymentMethod; icon: string; labelKey: string; subKey: string }[] = [
    { id: "cash",           icon: "💵", labelKey: "cash",          subKey: "cashSub"          },
    { id: "card-transfer",  icon: "💳", labelKey: "cardTransfer",  subKey: "cardTransferSub"  },
    { id: "remote-payment", icon: "📲", labelKey: "remotePayment", subKey: "remotePaymentSub" },
  ];

  const paymentOptions = orderType === "dine-in" ? dineInPaymentOptions : remotePaymentOptions;

  // ── Success screen: payment label ─────────────────────────────────────────
  const successPaymentLabel = (method: PaymentMethod): string => {
    switch (method) {
      case "pay-at-restaurant": return tn("payAtRest", lang);
      case "cash":              return tn("cash", lang);
      case "kaspi":             return tn("kaspi", lang);
      case "card-transfer":     return tn("cardTransfer", lang);
      case "remote-payment":    return tn("remotePayment", lang);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: "fixed", inset: 0,
          backgroundColor: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(2px)",
          zIndex: 80,
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.3s",
        }}
      />

      {/* Drawer sheet */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: "max(calc(50vw - 240px), 0px)",
          width: "min(100vw, 480px)",
          maxHeight: "88vh",
          background: bg,
          borderRadius: "24px 24px 0 0",
          boxShadow: "0 -4px 40px rgba(0,0,0,0.4)",
          zIndex: 90,
          display: "flex",
          flexDirection: "column",
          transform: open ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.32s cubic-bezier(0.32,0.72,0,1)",
          fontFamily: "'Montserrat', system-ui, sans-serif",
          color: textClr,
          overflow: "hidden",
        } as React.CSSProperties}
      >
        {/* Drag handle */}
        <div style={{ padding: "12px 0 0", display: "flex", justifyContent: "center", flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: border }} />
        </div>

        {/* ── STEP: CART ──────────────────────────────────────────────────── */}
        {step === "cart" && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: `${SP.sm}px ${SP.md}px` }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{tn("cart", lang)}</h2>
              <div style={{ display: "flex", alignItems: "center", gap: SP.sm - 2 }}>
                {!isEmpty && (
                  <button
                    onClick={() => setShowClearConfirm(true)}
                    title={tn("clearCart", lang)}
                    style={{ ...iconBtn, color: isDark ? "#E05555" : "#C0392B" }}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
                <button onClick={handleClose} style={iconBtn}><X size={15} /></button>
              </div>
            </div>

            {/* Inline clear confirmation */}
            {showClearConfirm && (
              <div style={{
                margin: `0 ${SP.md}px ${SP.sm}px`,
                padding: "10px 14px",
                background: isDark ? "#2A1A1A" : "#FFF0F0",
                border: `1.5px solid ${isDark ? "#5A2020" : "#F5C6C6"}`,
                borderRadius: R.md,
                display: "flex", alignItems: "center", gap: SP.sm,
                flexShrink: 0,
              }}>
                <p style={{ flex: 1, fontSize: 13, margin: 0, color: textClr, lineHeight: 1.4 }}>
                  {tn("clearConfirm", lang)}
                </p>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  style={{
                    padding: "5px 12px", borderRadius: R.full, border: `1px solid ${border}`,
                    background: "transparent", color: muted, fontSize: 12, fontWeight: 600,
                    cursor: "pointer", flexShrink: 0,
                  }}
                >
                  {tn("cancel", lang)}
                </button>
                <button
                  onClick={() => { onClearCart(); setShowClearConfirm(false); }}
                  style={{
                    padding: "5px 12px", borderRadius: R.full, border: "none",
                    background: isDark ? "#E05555" : "#C0392B", color: "#FFF",
                    fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0,
                  }}
                >
                  {tn("clearConfirmBtn", lang)}
                </button>
              </div>
            )}

            <div style={{ flex: 1, overflowY: "auto", padding: `0 ${SP.md}px` }}>
              {isEmpty ? (
                <div style={{ textAlign: "center", padding: "52px 0", color: muted }}>
                  <p style={{ fontSize: 44, margin: "0 0 12px" }}>🛒</p>
                  <p style={{ fontSize: 16, fontWeight: 600, color: textClr, margin: "0 0 6px" }}>{tn("emptyCart", lang)}</p>
                  <p style={{ fontSize: 13, margin: 0 }}>{tn("emptyHint", lang)}</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: SP.sm, paddingBottom: SP.sm }}>
                  {items.map(({ dish, qty, currency: ic, cartKey: ck, selectedModifiers }) => {
                    const fp = effPrice(dish, selectedModifiers);
                    const hasPromoDiscount = fp - (selectedModifiers?.reduce((s, m) => s + m.price, 0) ?? 0) < dish.price;
                    return (
                    <div key={ck} style={{ display: "flex", alignItems: "center", gap: SP.md - 4, padding: SP.sm + 2, background: card, borderRadius: R.md, border: `1px solid ${border}` }}>
                      <span style={{ fontSize: 26, flexShrink: 0 }}>{dish.emoji}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2, flexWrap: "wrap" }}>
                          <p style={{ fontSize: 14, fontWeight: 600, margin: 0, lineHeight: 1.3 }}>
                            {capFirst(resolve(dish.name, lang))}
                          </p>
                          {hasPromoDiscount && (
                            <span style={{ fontSize: 9, fontWeight: 800, padding: "1px 7px", borderRadius: 999, backgroundColor: "#FF4D6D", color: "#fff", letterSpacing: "0.05em", flexShrink: 0 }}>
                              -{dish.discountLabel}%
                            </span>
                          )}
                        </div>
                        {selectedModifiers && selectedModifiers.length > 0 && (
                          <p style={{ fontSize: 11, color: muted, margin: "1px 0 2px", lineHeight: 1.3 }}>
                            + {selectedModifiers.map(m => m.name).join(", ")}
                          </p>
                        )}
                        {hasPromoDiscount ? (
                          <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                            <span style={{ fontSize: 11, color: muted, textDecoration: "line-through" }}>
                              {(dish.price * qty).toLocaleString()}
                            </span>
                            <span style={{ fontSize: 13, fontWeight: 700 }}>
                              {(fp * qty).toLocaleString()} {ic || currency}
                            </span>
                          </div>
                        ) : (
                          <p style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>
                            {(fp * qty).toLocaleString()} {ic || currency}
                          </p>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: SP.sm - 2, flexShrink: 0 }}>
                        <button onClick={() => onUpdateQty(ck, -1)} style={iconBtn}><Minus size={12} /></button>
                        <span style={{ fontSize: 14, fontWeight: 700, minWidth: 20, textAlign: "center" }}>{qty}</span>
                        <button onClick={() => onUpdateQty(ck, +1)} style={iconBtn}><Plus size={12} /></button>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>

            {!isEmpty && (
              <div style={{ padding: SP.md, borderTop: `1px solid ${border}`, flexShrink: 0 }}>
                {totalSavings > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: isDark ? "#6DB86D" : "#2E7D32" }}>🎉 {tn("savings", lang)}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: isDark ? "#6DB86D" : "#2E7D32" }}>-{totalSavings.toLocaleString()} {currency}</span>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: SP.md }}>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{tn("total", lang)}</span>
                  <span style={{ fontSize: 18, fontWeight: 700 }}>{total.toLocaleString()} {currency}</span>
                </div>
                <button onClick={() => setStep("checkout")} style={primaryBtn()}>
                  {tn("checkout", lang)}
                </button>
              </div>
            )}
          </>
        )}

        {/* ── STEP: CHECKOUT ──────────────────────────────────────────────── */}
        {step === "checkout" && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: SP.sm, padding: `${SP.sm}px ${SP.md}px` }}>
              <button onClick={() => setStep("cart")} style={iconBtn}><ChevronLeft size={15} /></button>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, flex: 1 }}>{tn("checkoutTitle", lang)}</h2>
              <button onClick={handleClose} style={iconBtn}><X size={15} /></button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: `${SP.sm}px ${SP.md}px ${SP.lg}px` }}>

              {/* ── Order type ── */}
              {isTableLocked ? (
                <div style={{
                  display: "flex", alignItems: "center", gap: SP.sm, marginBottom: SP.lg,
                  padding: "10px 14px",
                  background: isDark ? "rgba(108,71,255,0.12)" : "rgba(108,71,255,0.08)",
                  border: `1.5px solid rgba(108,71,255,0.3)`,
                  borderRadius: R.md,
                }}>
                  <span style={{ fontSize: 18 }}>📍</span>
                  <div>
                    <div style={{ fontSize: 11, color: muted, marginBottom: 2 }}>{tn("table", lang)}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: textClr }}>{tableNumber}</div>
                  </div>
                </div>
              ) : (
                <>
                  <p style={labelSectionStyle}>{tn("selectOrderType", lang)}</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: SP.sm, marginBottom: SP.lg }}>
                    {ORDER_TYPE_OPTIONS.map(({ id, icon, labelKey }) => {
                      const sel = orderType === id;
                      return (
                        <button
                          key={id}
                          onClick={() => handleOrderTypeSelect(id)}
                          style={{
                            display: "flex", flexDirection: "column", alignItems: "center",
                            justifyContent: "center", gap: 6,
                            padding: "12px 8px",
                            background: sel
                              ? (isDark ? "rgba(245,245,245,0.10)" : "rgba(0,0,0,0.05)")
                              : card,
                            border: `2px solid ${sel ? textClr : border}`,
                            borderRadius: R.lg,
                            cursor: "pointer",
                            transition: "all 0.15s",
                            color: textClr,
                          }}
                        >
                          <span style={{ fontSize: 22 }}>{icon}</span>
                          <span style={{ fontSize: 11, fontWeight: sel ? 700 : 500, lineHeight: 1.2, textAlign: "center" }}>
                            {tn(labelKey, lang)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {/* ── Timing mode ── */}
              <p style={labelSectionStyle}>{tn("timingLabel", lang)}</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: SP.sm, marginBottom: SP.lg }}>
                {(["asap", "preorder"] as const).map((mode) => {
                  const sel = timingMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setTimingMode(mode)}
                      style={{
                        display: "flex", flexDirection: "column", alignItems: "center",
                        justifyContent: "center", gap: 6,
                        padding: "12px 8px",
                        background: sel
                          ? (isDark ? "rgba(245,245,245,0.10)" : "rgba(0,0,0,0.05)")
                          : card,
                        border: `2px solid ${sel ? textClr : border}`,
                        borderRadius: R.lg,
                        cursor: "pointer",
                        transition: "all 0.15s",
                        color: textClr,
                      }}
                    >
                      <span style={{ fontSize: 22 }}>{mode === "asap" ? "⚡" : "📅"}</span>
                      <span style={{ fontSize: 11, fontWeight: sel ? 700 : 500, lineHeight: 1.2, textAlign: "center" }}>
                        {tn(mode === "asap" ? "asap" : "preorderMode", lang)}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* ── Preorder date & time ── */}
              {timingMode === "preorder" && (
                <div style={{ marginBottom: SP.lg, display: "flex", gap: SP.sm }}>
                  <label style={{ flex: 1 }}>
                    <span style={labelSectionStyle}>{tn("preorderDate", lang)}</span>
                    <input
                      type="date"
                      value={preorderDate}
                      min={localDateISO()}
                      onChange={(e) => setPreorderDate(e.target.value)}
                      style={{
                        display: "block", width: "100%", marginTop: SP.sm,
                        padding: "13px 14px",
                        background: surface,
                        border: `1.5px solid ${preorderDate ? textClr : border}`,
                        borderRadius: R.md, color: textClr, fontSize: 15,
                        outline: "none", boxSizing: "border-box",
                        transition: "border-color 0.15s",
                        fontFamily: "inherit",
                      } as React.CSSProperties}
                    />
                  </label>
                  <label style={{ flex: 1 }}>
                    <span style={labelSectionStyle}>{tn("preorderTime", lang)}</span>
                    <input
                      type="time"
                      value={preorderTime}
                      onChange={(e) => setPreorderTime(e.target.value)}
                      style={{
                        display: "block", width: "100%", marginTop: SP.sm,
                        padding: "13px 14px",
                        background: surface,
                        border: `1.5px solid ${preorderTime ? textClr : border}`,
                        borderRadius: R.md, color: textClr, fontSize: 15,
                        outline: "none", boxSizing: "border-box",
                        transition: "border-color 0.15s",
                        fontFamily: "inherit",
                      } as React.CSSProperties}
                    />
                  </label>
                </div>
              )}

              {/* ── Preorder confirmation summary ── */}
              {timingMode === "preorder" && preorderDate && preorderTime && (
                <div style={{
                  marginBottom: SP.lg, padding: SP.md,
                  background: isDark ? "rgba(96,165,250,0.1)" : "rgba(37,99,235,0.07)",
                  borderRadius: R.md,
                  border: `1.5px solid ${isDark ? "rgba(96,165,250,0.35)" : "rgba(37,99,235,0.25)"}`,
                  display: "flex", alignItems: "center", gap: SP.sm,
                }}>
                  <span style={{ fontSize: 22, flexShrink: 0 }}>📅</span>
                  <div>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: isDark ? "rgba(147,197,253,0.85)" : "rgba(37,99,235,0.75)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {lang === "en" ? "Pre-order" : lang === "kz" ? "Алдын ала тапсырыс" : "Вы делаете предзаказ на:"}
                    </p>
                    <p style={{ margin: "3px 0 0", fontSize: 16, fontWeight: 800, color: textClr }}>
                      {formatPreorderDate(preorderDate, lang)}{" "}
                      <span style={{ fontWeight: 500, color: muted }}>{lang === "en" ? "at" : lang === "kz" ? "сағат" : "в"}</span>{" "}
                      {preorderTime}
                    </p>
                  </div>
                </div>
              )}

              {/* ── Preorder contact: name (always) + phone (dine-in only, already shown for pickup/delivery) ── */}
              {timingMode === "preorder" && (
                <div style={{ marginBottom: SP.lg }}>
                  <label style={{ display: "block", marginBottom: SP.md }}>
                    <span style={labelSectionStyle}>
                      {lang === "en" ? "Your Name" : lang === "kz" ? "Есіміңіз" : "Ваше имя"}
                    </span>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder={lang === "en" ? "Name for the reservation" : lang === "kz" ? "Брондауға арналған есім" : "Имя для брони"}
                      style={{
                        display: "block", width: "100%", marginTop: SP.sm,
                        padding: "13px 14px",
                        background: surface,
                        border: `1.5px solid ${customerName.trim() ? textClr : border}`,
                        borderRadius: R.md, color: textClr, fontSize: 15,
                        outline: "none", boxSizing: "border-box",
                        transition: "border-color 0.15s",
                        fontFamily: "inherit",
                      } as React.CSSProperties}
                    />
                  </label>
                  {orderType === "dine-in" && (
                    <>
                      <label style={{ display: "block", marginBottom: SP.md }}>
                        <span style={labelSectionStyle}>{tn("phoneLabel", lang)}</span>
                        <input
                          type="tel"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          placeholder={tn("phonePlaceholder", lang)}
                          style={{
                            display: "block", width: "100%", marginTop: SP.sm,
                            padding: "13px 14px",
                            background: surface,
                            border: `1.5px solid ${phoneNumber.trim() ? textClr : border}`,
                            borderRadius: R.md, color: textClr, fontSize: 15,
                            outline: "none", boxSizing: "border-box",
                            transition: "border-color 0.15s",
                            fontFamily: "inherit",
                          } as React.CSSProperties}
                        />
                      </label>
                      <label style={{ display: "block" }}>
                        <span style={labelSectionStyle}>
                          {lang === "en" ? "City" : lang === "kz" ? "Қала" : "Город"}
                        </span>
                        <input
                          type="text"
                          value={customerCity}
                          onChange={(e) => setCustomerCity(e.target.value)}
                          placeholder={lang === "en" ? "Your city" : lang === "kz" ? "Сіздің қалаңыз" : "Ваш город"}
                          style={{
                            display: "block", width: "100%", marginTop: SP.sm,
                            padding: "13px 14px",
                            background: surface,
                            border: `1.5px solid ${customerCity.trim() ? textClr : border}`,
                            borderRadius: R.md, color: textClr, fontSize: 15,
                            outline: "none", boxSizing: "border-box",
                            transition: "border-color 0.15s",
                            fontFamily: "inherit",
                          } as React.CSSProperties}
                        />
                      </label>
                    </>
                  )}
                </div>
              )}

              {/* ── Table picker (dine-in, not pre-filled from QR) ── */}
              {orderType === "dine-in" && !isTableLocked && (
                <div style={{ marginBottom: SP.lg }}>
                  <p style={labelSectionStyle}>{tn("selectTable", lang)}</p>
                  {tablesLoading ? (
                    <p style={{ fontSize: 13, color: muted, textAlign: "center", padding: "16px 0" }}>
                      {tn("loadingTables", lang)}
                    </p>
                  ) : guestTables.length === 0 ? (
                    <div style={{
                      padding: "12px 14px", background: surface, borderRadius: R.md,
                      marginTop: SP.sm, color: muted, fontSize: 13, textAlign: "center",
                    }}>
                      {tn("noTablesAvailable", lang)}
                    </div>
                  ) : (
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))",
                      gap: SP.sm,
                      marginTop: SP.sm,
                    }}>
                      {guestTables.map((t) => {
                        const isOccupied = occupiedLabels.has(t.label);
                        const isSelected = tableNumber === t.label || tableNumber.startsWith(t.label + ".");
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                              if (isOccupied) {
                                setSubTableConfirmBase(t.label);
                              } else {
                                setTableNumber(tableNumber === t.label ? "" : t.label);
                              }
                            }}
                            style={{
                              display: "flex", flexDirection: "column",
                              alignItems: "center", justifyContent: "center",
                              gap: 3, padding: "10px 6px",
                              background: isSelected
                                ? (isDark ? "rgba(255,255,255,0.13)" : "rgba(0,0,0,0.07)")
                                : card,
                              border: `2px solid ${isSelected ? textClr : isOccupied ? "rgba(139,92,246,0.35)" : border}`,
                              borderRadius: R.md,
                              cursor: "pointer",
                              opacity: isOccupied ? 0.65 : 1,
                              transition: "all 0.15s",
                              color: textClr,
                            }}
                          >
                            <span style={{ fontSize: 17, fontWeight: 800, lineHeight: 1 }}>{t.label}</span>
                            <span style={{ fontSize: 9, color: isOccupied ? "rgb(139,92,246)" : muted, lineHeight: 1.2, fontWeight: isOccupied ? 700 : 400 }}>
                              {isOccupied ? "занят" : `${t.seats} мест`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── Sub-table confirmation dialog ── */}
              {subTableConfirmBase && (
                <div style={{
                  position: "fixed", inset: 0, zIndex: 9999,
                  display: "flex", alignItems: "flex-end", justifyContent: "center",
                  background: "rgba(0,0,0,0.55)",
                }}>
                  <div style={{
                    width: "100%", maxWidth: 480,
                    background: card, borderRadius: `${R.lg}px ${R.lg}px 0 0`,
                    padding: "24px 20px 32px",
                    boxShadow: "0 -4px 32px rgba(0,0,0,0.25)",
                  }}>
                    <p style={{ fontSize: 17, fontWeight: 800, color: textClr, marginBottom: 8 }}>
                      Стол занят
                    </p>
                    <p style={{ fontSize: 14, color: muted, marginBottom: 24, lineHeight: 1.5 }}>
                      Стол {subTableConfirmBase} сейчас занят. Хотите открыть новый счёт за этим столом?
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <button
                        type="button"
                        onClick={() => {
                          const base = subTableConfirmBase;
                          let i = 1;
                          while (occupiedLabels.has(`${base}.${i}`)) i++;
                          setTableNumber(`${base}.${i}`);
                          setSubTableConfirmBase(null);
                        }}
                        style={{
                          width: "100%", padding: "14px 0", borderRadius: R.full,
                          background: textClr, color: bg, border: "none",
                          fontSize: 15, fontWeight: 700, cursor: "pointer",
                        }}
                      >
                        Открыть новый счёт · {subTableConfirmBase}.
                        {(() => { let i = 1; while (occupiedLabels.has(`${subTableConfirmBase}.${i}`)) i++; return i; })()}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSubTableConfirmBase(null)}
                        style={{
                          width: "100%", padding: "13px 0", borderRadius: R.full,
                          background: "transparent", color: muted,
                          border: `1.5px solid ${border}`,
                          fontSize: 15, fontWeight: 600, cursor: "pointer",
                        }}
                      >
                        Назад
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── City selector (delivery + pickup) ── */}
              {(orderType === "delivery" || orderType === "pickup") && (
                <div style={{ marginBottom: SP.lg }}>
                  <p style={{ ...labelSectionStyle, margin: `0 0 ${SP.sm}px` }}>{tn("cityLabel", lang)}</p>
                  <div>
                    <button
                      type="button"
                      onClick={() => { setCitySearch(""); setCityDropdownOpen((v) => !v); }}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        width: "100%", padding: "13px 14px",
                        background: surface,
                        border: `1.5px solid ${city ? textClr : border}`,
                        borderRadius: cityDropdownOpen ? `${R.md}px ${R.md}px 0 0` : R.md,
                        color: city ? textClr : muted,
                        fontSize: 15, cursor: "pointer", fontFamily: "inherit",
                        boxSizing: "border-box", textAlign: "left",
                        transition: "border-color 0.15s",
                      } as React.CSSProperties}
                    >
                      <span>
                        {city
                          ? KZ_CITIES.find((c) => c.id === city)?.[lang] ?? city
                          : tn("citySelect", lang)}
                      </span>
                      <ChevronDown
                        size={16}
                        style={{
                          transform: cityDropdownOpen ? "rotate(180deg)" : "none",
                          transition: "transform 0.2s",
                          flexShrink: 0,
                        }}
                      />
                    </button>

                    {cityDropdownOpen && (
                      <div style={{
                        border: `1.5px solid ${textClr}`,
                        borderTop: `1px solid ${border}`,
                        borderRadius: `0 0 ${R.md}px ${R.md}px`,
                        background: surface,
                        overflow: "hidden",
                      }}>
                        <div style={{ padding: 8, borderBottom: `1px solid ${border}` }}>
                          <input
                            type="text"
                            autoFocus
                            value={citySearch}
                            onChange={(e) => setCitySearch(e.target.value)}
                            placeholder={tn("citySearchHint", lang)}
                            style={{
                              width: "100%", padding: "8px 10px",
                              background: isDark ? "#252525" : "#E6E8EC",
                              border: `1px solid ${border}`,
                              borderRadius: R.sm, color: textClr, fontSize: 13,
                              outline: "none", boxSizing: "border-box", fontFamily: "inherit",
                            } as React.CSSProperties}
                          />
                        </div>
                        <div style={{ maxHeight: 200, overflowY: "auto" }}>
                          {filteredCities.length === 0 ? (
                            <p style={{ padding: "12px 14px", fontSize: 13, color: muted, margin: 0, textAlign: "center" }}>
                              {tn("noCityFound", lang)}
                            </p>
                          ) : (
                            filteredCities.map((c, i) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => { setCity(c.id); setCitySearch(""); setCityDropdownOpen(false); }}
                                style={{
                                  display: "block", width: "100%", padding: "10px 14px",
                                  background: city === c.id
                                    ? (isDark ? "rgba(245,245,245,0.09)" : "rgba(0,0,0,0.05)")
                                    : "transparent",
                                  border: "none",
                                  borderBottom: i < filteredCities.length - 1 ? `1px solid ${border}` : "none",
                                  color: textClr, fontSize: 14, cursor: "pointer",
                                  textAlign: "left", fontFamily: "inherit",
                                } as React.CSSProperties}
                              >
                                {c[lang]}
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {orderType === "delivery" && (
                <label style={{ display: "block", marginBottom: SP.lg }}>
                  <span style={labelSectionStyle}>{tn("deliveryAddr", lang)}</span>
                  <textarea
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder={tn("addrHint", lang)}
                    rows={3}
                    style={textareaStyle(deliveryAddress.trim().length > 0)}
                  />
                </label>
              )}

              {orderType === "pickup" && (
                <div style={{
                  padding: SP.md, marginBottom: SP.lg,
                  background: surface, borderRadius: R.md, border: `1px solid ${border}`,
                  display: "flex", alignItems: "center", gap: SP.sm,
                }}>
                  <span style={{ fontSize: 24, flexShrink: 0 }}>⏱️</span>
                  <p style={{ fontSize: 13, color: textClr, margin: 0, lineHeight: 1.5 }}>
                    {tn("pickupReady", lang)}
                  </p>
                </div>
              )}

              {/* ── Phone number (pickup + delivery) ── */}
              {(orderType === "pickup" || orderType === "delivery") && (
                <label style={{ display: "block", marginBottom: SP.lg }}>
                  <span style={labelSectionStyle}>
                    {tn(orderType === "delivery" ? "deliveryPhoneLabel" : "phoneLabel", lang)}
                  </span>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder={tn("phonePlaceholder", lang)}
                    style={{
                      display: "block", width: "100%", marginTop: SP.sm,
                      padding: "13px 14px",
                      background: surface,
                      border: `1.5px solid ${phoneNumber.trim().replace(/\D/g, "").length >= 10 ? textClr : (!phoneNumber.trim() ? border : "#E05555")}`,
                      borderRadius: R.md, color: textClr, fontSize: 15,
                      outline: "none", boxSizing: "border-box",
                      transition: "border-color 0.15s",
                      fontFamily: "inherit",
                    } as React.CSSProperties}
                  />
                </label>
              )}

              {/* ── Payment ── */}
              {orderType !== null && (
                <>
                  <p style={labelSectionStyle}>{tn("payment", lang)}</p>

                  {orderType === "dine-in" ? (
                    // Dine-in: single confirmed option, non-interactive
                    <div style={{
                      padding: SP.md, marginBottom: SP.sm, background: card,
                      border: `2px solid ${textClr}`,
                      borderRadius: R.lg,
                      display: "flex", alignItems: "center", gap: SP.md,
                    }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: R.full,
                        background: textClr,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                      }}>
                        <div style={{ width: 8, height: 8, borderRadius: R.full, background: bg }} />
                      </div>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 2px" }}>🏧 {tn("payAtRest", lang)}</p>
                        <p style={{ fontSize: 12, color: muted, margin: 0 }}>{tn("payAtRestSub", lang)}</p>
                      </div>
                    </div>
                  ) : (
                    paymentOptions.map(({ id, icon, labelKey, subKey }) => (
                      <PaymentCard
                        key={id}
                        selected={payment === id}
                        onSelect={() => handlePaymentSelect(id)}
                        icon={icon}
                        label={tn(labelKey, lang)}
                        sublabel={tn(subKey, lang)}
                        border={border} card={card} textClr={textClr} muted={muted}
                      />
                    ))
                  )}

                  {/* Card transfer: all banks with copy buttons */}
                  {payment === "card-transfer" && paymentBanks.length > 0 && (
                    <div style={{ marginBottom: SP.md }}>
                      <p style={{ fontSize: 12, color: muted, margin: `0 0 ${SP.sm}px`, lineHeight: 1.5 }}>
                        {lang === "en"
                          ? "Please transfer the order amount to one of the cards below:"
                          : lang === "kz"
                          ? "Тапсырыс сомасын төмендегі карталардың біріне аударыңыз:"
                          : "Пожалуйста, переведите сумму заказа или предоплаты на одну из указанных карт:"}
                      </p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {paymentBanks.map((bank, i) => (
                          <div key={bank.id} style={{ borderRadius: R.md, border: `1.5px solid ${isDark ? "#3A3A3A" : "#D0D4D9"}`, overflow: "hidden" }}>
                            <div style={{ padding: "8px 14px", background: isDark ? "#252525" : "#ECEEF0", borderBottom: `1px solid ${border}` }}>
                              <p style={{ fontSize: 11, fontWeight: 700, color: muted, margin: 0, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                                💳 {bank.bank_name}
                              </p>
                            </div>
                            <div style={{ padding: "10px 14px", background: surface }}>
                              <div style={{ display: "flex", alignItems: "center", gap: SP.sm }}>
                                <p style={{ fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: "0.03em", fontVariantNumeric: "tabular-nums", flex: 1 }}>
                                  {bank.phone}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(bank.phone).then(() => {
                                      setCopiedIdx(i);
                                      setTimeout(() => setCopiedIdx(null), 2000);
                                    });
                                  }}
                                  style={{
                                    display: "flex", alignItems: "center", gap: 4,
                                    padding: "5px 10px", borderRadius: R.full,
                                    border: `1.5px solid ${copiedIdx === i ? (isDark ? "#6DB86D" : "#2E7D32") : border}`,
                                    background: copiedIdx === i ? (isDark ? "rgba(109,184,109,0.15)" : "rgba(46,125,50,0.08)") : surface,
                                    color: copiedIdx === i ? (isDark ? "#6DB86D" : "#2E7D32") : muted,
                                    fontSize: 11, fontWeight: 700, cursor: "pointer",
                                    transition: "all 0.2s", flexShrink: 0,
                                  } as React.CSSProperties}
                                >
                                  {copiedIdx === i ? <Check size={11} /> : <Copy size={11} />}
                                  {copiedIdx === i
                                    ? (lang === "en" ? "Copied!" : lang === "kz" ? "Көшірілді!" : "Скопировано!")
                                    : (lang === "en" ? "Copy" : lang === "kz" ? "Көшіру" : "Копировать")}
                                </button>
                              </div>
                              {bank.recipient_name && (
                                <p style={{ fontSize: 13, color: textClr, margin: "4px 0 0", fontWeight: 500 }}>
                                  {tn("recipient", lang)}: <strong>{bank.recipient_name}</strong>
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Remote payment: bank selection + comment */}
                  {payment === "remote-payment" && (
                    <div style={{ marginBottom: SP.md }}>
                      <div style={{
                        marginBottom: SP.md, padding: "10px 14px",
                        background: isDark ? "rgba(168,85,247,0.08)" : "rgba(168,85,247,0.06)",
                        border: `1.5px solid ${isDark ? "rgba(168,85,247,0.30)" : "rgba(168,85,247,0.20)"}`,
                        borderRadius: R.md,
                        display: "flex", alignItems: "flex-start", gap: SP.sm,
                      }}>
                        <span style={{ fontSize: 18, flexShrink: 0 }}>📲</span>
                        <p style={{ margin: 0, fontSize: 12, color: isDark ? "rgba(216,180,254,0.85)" : "rgba(107,33,168,0.85)", lineHeight: 1.5 }}>
                          {lang === "en"
                            ? "The admin will send you a payment request via Kaspi or Halyk Bank. Please enter the phone number linked to your bank app."
                            : lang === "kz"
                            ? "Әкімші Kaspi немесе Halyk Bank арқылы сізге шот жіберді. Банк қолданбасына тіркелген телефон нөмірін енгізіңіз."
                            : "Администратор выставит вам счёт через Kaspi или Halyk Bank. Укажите номер телефона, к которому привязан ваш банк."}
                        </p>
                      </div>
                      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: muted, margin: `0 0 ${SP.sm}px` }}>
                        {tn("selectBankForInvoice", lang)}
                      </p>
                      <div style={{ display: "flex", gap: 8, marginBottom: SP.md }}>
                        {(["kaspi", "halyk"] as const).map((bankId) => {
                          const bankName = bankId === "kaspi" ? tn("kaspiBank", lang) : tn("halykBank", lang);
                          const isSelected = remoteBank === bankId;
                          return (
                            <button
                              key={bankId}
                              type="button"
                              onClick={() => setRemoteBank(bankId)}
                              style={{
                                flex: 1, padding: "12px 10px", borderRadius: R.md, cursor: "pointer",
                                border: `2px solid ${isSelected ? textClr : border}`,
                                background: isSelected
                                  ? (isDark ? "rgba(224,224,224,0.08)" : "rgba(0,0,0,0.04)")
                                  : card,
                                color: textClr,
                                display: "flex", alignItems: "center", gap: 8,
                                transition: "border-color 0.15s, background 0.15s",
                              } as React.CSSProperties}
                            >
                              <div style={{
                                width: 18, height: 18, borderRadius: R.full,
                                border: `2px solid ${isSelected ? textClr : border}`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                flexShrink: 0, transition: "all 0.15s",
                              }}>
                                {isSelected && <div style={{ width: 8, height: 8, borderRadius: R.full, background: textClr }} />}
                              </div>
                              <span style={{ fontSize: 13, fontWeight: isSelected ? 700 : 500 }}>{bankName}</span>
                            </button>
                          );
                        })}
                      </div>
                      <label style={{ display: "block", marginBottom: SP.md }}>
                        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: muted, margin: `0 0 ${SP.sm}px`, display: "block" }}>
                          {tn("invoicePhoneLabel", lang)}
                        </span>
                        <input
                          type="tel"
                          value={invoicePhone}
                          onChange={(e) => setInvoicePhone(e.target.value)}
                          placeholder={tn("invoicePhonePlaceholder", lang)}
                          style={{
                            display: "block", width: "100%", marginTop: SP.sm,
                            padding: "13px 14px",
                            background: surface,
                            border: `1.5px solid ${invoicePhone.trim().replace(/\D/g, "").length >= 10 ? textClr : (!invoicePhone.trim() ? border : "#E05555")}`,
                            borderRadius: R.md, color: textClr, fontSize: 15,
                            outline: "none", boxSizing: "border-box",
                            transition: "border-color 0.15s",
                            fontFamily: "inherit",
                          } as React.CSSProperties}
                        />
                      </label>
                    </div>
                  )}

                </>
              )}

              {/* ── Notes (optional) ── */}
              <label style={{ display: "block", marginBottom: SP.lg }}>
                <span style={labelSectionStyle}>
                  {tn("notes", lang)}{" "}
                  <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                    ({tn("optional", lang)})
                  </span>
                </span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={tn("notesHint", lang)}
                  rows={2}
                  style={textareaStyle(notes.trim().length > 0)}
                />
              </label>

              {/* ── Tips ── */}
              <div style={{ marginBottom: SP.lg }}>
                {/* Toggle row */}
                <button
                  onClick={() => {
                    const next = !tipsEnabled;
                    setTipsEnabled(next);
                    if (!next) { setTipsInput(""); setTipsAmount(0); }
                  }}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    width: "100%", padding: "12px 14px",
                    background: tipsEnabled
                      ? (isDark ? "rgba(124,58,237,0.14)" : "rgba(124,58,237,0.07)")
                      : surface,
                    border: `1.5px solid ${tipsEnabled ? "rgba(124,58,237,0.5)" : border}`,
                    borderRadius: tipsEnabled ? `${R.md}px ${R.md}px 0 0` : R.md,
                    color: textClr, cursor: "pointer",
                    transition: "all 0.2s",
                  } as React.CSSProperties}
                >
                  <span style={{ fontSize: 14, fontWeight: 600 }}>
                    💝 {tn("tipsToggle", lang)}
                  </span>
                  {/* pill toggle */}
                  <div style={{
                    width: 42, height: 24, borderRadius: 12,
                    background: tipsEnabled ? "#7C3AED" : (isDark ? "#3A3A3A" : "#D1D5DB"),
                    position: "relative", transition: "background 0.2s", flexShrink: 0,
                  }}>
                    <div style={{
                      position: "absolute", top: 3, left: tipsEnabled ? 21 : 3,
                      width: 18, height: 18, borderRadius: "50%", background: "#FFFFFF",
                      transition: "left 0.2s",
                    }} />
                  </div>
                </button>

                {/* Expanded panel */}
                {tipsEnabled && (
                  <div style={{
                    padding: "14px 14px 12px",
                    background: isDark ? "rgba(124,58,237,0.07)" : "rgba(124,58,237,0.04)",
                    border: `1.5px solid rgba(124,58,237,0.35)`,
                    borderTop: "none",
                    borderRadius: `0 0 ${R.md}px ${R.md}px`,
                  }}>
                    {/* Quick amounts */}
                    <div style={{ display: "flex", gap: SP.sm, marginBottom: SP.sm }}>
                      {[300, 500, 1000].map((amt) => (
                        <button
                          key={amt}
                          onClick={() => { setTipsInput(String(amt)); setTipsAmount(amt); }}
                          style={{
                            flex: 1, padding: "8px 0", borderRadius: R.sm,
                            border: `1.5px solid ${tipsAmount === amt ? "#7C3AED" : border}`,
                            background: tipsAmount === amt
                              ? (isDark ? "rgba(124,58,237,0.25)" : "rgba(124,58,237,0.12)")
                              : surface,
                            color: tipsAmount === amt ? "#7C3AED" : textClr,
                            fontSize: 13, fontWeight: 700, cursor: "pointer",
                            transition: "all 0.15s",
                          } as React.CSSProperties}
                        >
                          {amt.toLocaleString()} ₸
                        </button>
                      ))}
                    </div>

                    {/* Custom amount input + Apply */}
                    <div style={{ display: "flex", gap: SP.sm }}>
                      <input
                        type="number"
                        min="0"
                        value={tipsInput}
                        onChange={(e) => setTipsInput(e.target.value)}
                        placeholder={tn("tipsPlaceholder", lang)}
                        style={{
                          flex: 1, padding: "10px 12px",
                          background: surface,
                          border: `1.5px solid ${tipsInput ? "#7C3AED" : border}`,
                          borderRadius: R.sm, color: textClr, fontSize: 14,
                          outline: "none", boxSizing: "border-box",
                          fontFamily: "inherit",
                        } as React.CSSProperties}
                      />
                      <button
                        onClick={() => {
                          const v = parseInt(tipsInput, 10);
                          setTipsAmount(isNaN(v) || v < 0 ? 0 : v);
                        }}
                        style={{
                          padding: "10px 16px", borderRadius: R.sm, border: "none",
                          background: "#7C3AED", color: "#FFFFFF",
                          fontSize: 13, fontWeight: 700, cursor: "pointer",
                          flexShrink: 0,
                        }}
                      >
                        {tn("tipsApply", lang)}
                      </button>
                    </div>

                    {tipsAmount > 0 && (
                      <p style={{ fontSize: 12, color: "#7C3AED", marginTop: 8, fontWeight: 600 }}>
                        ✓ {tn("tipsLabel", lang)}: {tipsAmount.toLocaleString()} ₸
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* ── Bonus points ── */}
              {guestSession && maxBonuses > 0 && (
                <div style={{ marginBottom: SP.lg }}>
                  <button
                    onClick={() => setUseBonuses(!useBonuses)}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      width: "100%", padding: "12px 14px",
                      background: useBonuses
                        ? (isDark ? "rgba(16,185,129,0.14)" : "rgba(16,185,129,0.07)")
                        : surface,
                      border: `1.5px solid ${useBonuses ? "rgba(16,185,129,0.5)" : border}`,
                      borderRadius: R.md,
                      color: textClr, cursor: "pointer",
                      transition: "all 0.2s",
                    } as React.CSSProperties}
                  >
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>
                        🎁 {lang === "kz" ? "Бонустарды пайдалану" : "Оплатить бонусами"}
                      </div>
                      <div style={{ fontSize: 12, marginTop: 2, color: useBonuses ? "#10B981" : muted }}>
                        {lang === "kz" ? "Қолжетімді" : "Доступно"}: {guestSession.bonusAmount.toLocaleString()} ₸
                        {useBonuses && ` · -${bonusesApplied.toLocaleString()} ₸`}
                      </div>
                    </div>
                    <div style={{
                      width: 42, height: 24, borderRadius: 12,
                      background: useBonuses ? "#10B981" : (isDark ? "#3A3A3A" : "#D1D5DB"),
                      position: "relative", transition: "background 0.2s", flexShrink: 0,
                    }}>
                      <div style={{
                        position: "absolute", top: 3, left: useBonuses ? 21 : 3,
                        width: 18, height: 18, borderRadius: "50%", background: "#FFFFFF",
                        transition: "left 0.2s",
                      }} />
                    </div>
                  </button>
                </div>
              )}

              {/* ── Order summary ── */}
              <div style={{ background: surface, borderRadius: R.md, padding: SP.md, border: `1px solid ${border}` }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: muted, margin: `0 0 ${SP.sm}px`, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {tn("summary", lang)}
                </p>
                {items.map(({ dish, qty, currency: ic, cartKey: ck, selectedModifiers }) => (
                  <div key={ck} style={{ marginBottom: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 13 }}>
                      <span style={{ color: muted, flex: 1, minWidth: 0 }}>
                        {capFirst(resolve(dish.name, lang))} × {qty}
                      </span>
                      <span style={{ fontWeight: 600, flexShrink: 0, marginLeft: 6 }}>
                        {effPrice(dish, selectedModifiers) < dish.price && (
                          <span style={{ fontSize: 11, color: muted, textDecoration: "line-through", marginRight: 4, fontWeight: 400 }}>
                            {(dish.price * qty).toLocaleString()}
                          </span>
                        )}
                        {(effPrice(dish, selectedModifiers) * qty).toLocaleString()} {ic || currency}
                      </span>
                    </div>
                    {selectedModifiers && selectedModifiers.length > 0 && (
                      <p style={{ fontSize: 11, color: muted, margin: "1px 0 2px", lineHeight: 1.3 }}>
                        + {selectedModifiers.map(m => m.name).join(", ")}
                      </p>
                    )}
                    {effPrice(dish, selectedModifiers) < dish.price && (
                      <span style={{ display: "inline-block", marginTop: 2, fontSize: 9, fontWeight: 800, padding: "1px 5px", borderRadius: 999, backgroundColor: "#FF4D6D", color: "#fff", letterSpacing: "0.05em" }}>
                        -{dish.discountLabel}%
                      </span>
                    )}
                  </div>
                ))}
                {deliveryFee > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
                    <span style={{ color: muted }}>🚚 {tn("deliveryFee", lang)}</span>
                    <span style={{ fontWeight: 600 }}>{deliveryFee.toLocaleString()} {currency}</span>
                  </div>
                )}
                {totalSavings > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5, color: isDark ? "#6DB86D" : "#2E7D32" }}>
                    <span>🎉 {tn("savings", lang)}</span>
                    <span style={{ fontWeight: 700 }}>-{totalSavings.toLocaleString()} {currency}</span>
                  </div>
                )}
                {tipsAmount > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5, color: "#7C3AED" }}>
                    <span>💝 {tn("tipsLabel", lang)}</span>
                    <span style={{ fontWeight: 700 }}>+{tipsAmount.toLocaleString()} {currency}</span>
                  </div>
                )}
                {bonusesApplied > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5, color: "#10B981" }}>
                    <span>🎁 {lang === "kz" ? "Бонустар" : "Бонусы"}</span>
                    <span style={{ fontWeight: 700 }}>-{bonusesApplied.toLocaleString()} {currency}</span>
                  </div>
                )}
                <div style={{ borderTop: `1px solid ${border}`, paddingTop: SP.sm, marginTop: SP.xs, display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700 }}>
                  <span>{tn("total", lang)}</span>
                  <span>{grandTotal.toLocaleString()} {currency}</span>
                </div>
              </div>
            </div>

            <div style={{ padding: SP.md, borderTop: `1px solid ${border}`, flexShrink: 0 }}>
              <button
                onClick={handlePlaceOrder}
                disabled={!canPlaceOrder || loading}
                style={primaryBtn(!canPlaceOrder || loading)}
              >
                {loading ? "…" : orderType === "dine-in" ? tn("sendOrder", lang) : tn("placeOrder", lang)}
              </button>
            </div>
          </>
        )}

        {/* ── STEP: SUCCESS ────────────────────────────────────────────────── */}
        {step === "success" && placedOrder && (
          <>
            <div style={{ flex: 1, overflowY: "auto", padding: `${SP.md}px ${SP.md}px ${SP.xl}px`, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: 72, height: 72, borderRadius: R.full, background: surface, border: `2px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "center", margin: `${SP.xl}px 0 ${SP.md}px` }}>
                <Check size={32} strokeWidth={2.5} />
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", textAlign: "center" }}>
                {placedOrder.orderType === "dine-in" ? tn("dineInSuccess", lang) : tn("success", lang)}
              </h2>
              <p style={{ fontSize: 14, color: muted, margin: "0 0 28px", textAlign: "center", lineHeight: 1.5 }}>
                {placedOrder.orderType === "dine-in" ? tn("dineInSuccessSub", lang) : tn("successSub", lang)}
              </p>

              <div style={{ width: "100%", background: surface, borderRadius: R.lg, padding: SP.md, border: `1px solid ${border}` }}>
                <OrderRow
                  label={tn("orderTypeLabel", lang)}
                  value={tn(
                    placedOrder.orderType === "dine-in" ? "dineIn" :
                    placedOrder.orderType === "pickup"  ? "pickup" : "delivery",
                    lang,
                  )}
                  border={border} muted={muted}
                />
                {placedOrder.timingMode === "preorder" && placedOrder.preorderDate && (
                  <div style={{ marginBottom: SP.sm, paddingBottom: SP.sm, borderBottom: `1px solid ${border}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", background: isDark ? "rgba(251,191,36,0.10)" : "rgba(251,191,36,0.12)", borderRadius: R.sm, border: `1px solid rgba(251,191,36,0.35)`, marginBottom: 6 }}>
                      <span style={{ fontSize: 16 }}>📅</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: isDark ? "#FBBF24" : "#B45309" }}>
                        {tn("preorderMode", lang)}: {placedOrder.preorderDate}{placedOrder.preorderTime ? ` · ${placedOrder.preorderTime}` : ""}
                      </span>
                    </div>
                  </div>
                )}
                {placedOrder.orderType === "dine-in" && placedOrder.tableNumber && (
                  <OrderRow label={tn("table", lang)} value={placedOrder.tableNumber} border={border} muted={muted} />
                )}
                {(placedOrder.orderType === "delivery" || placedOrder.orderType === "pickup") && placedOrder.cityName && (
                  <OrderRow label={tn("cityLabel", lang)} value={placedOrder.cityName} border={border} muted={muted} />
                )}
                {placedOrder.orderType === "delivery" && placedOrder.deliveryAddress && (
                  <OrderRow label={tn("address", lang)} value={placedOrder.deliveryAddress} border={border} muted={muted} />
                )}
                {placedOrder.phoneNumber && (
                  <OrderRow label={tn("phoneLabel", lang)} value={placedOrder.phoneNumber} border={border} muted={muted} />
                )}
                <OrderRow
                  label={tn("payment", lang)}
                  value={successPaymentLabel(placedOrder.paymentMethod)}
                  border={border} muted={muted}
                />
                {/* Remote payment details on success */}
                {placedOrder.paymentMethod === "remote-payment" && (placedOrder.remoteBank || placedOrder.invoicePhone || placedOrder.paymentComment) && (
                  <div style={{ marginBottom: SP.sm, paddingBottom: SP.sm, borderBottom: `1px solid ${border}` }}>
                    {placedOrder.remoteBank && (
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
                        <span style={{ color: muted }}>{tn("bankLabel", lang)}</span>
                        <span style={{ fontWeight: 600 }}>{placedOrder.remoteBank === "kaspi" ? tn("kaspiBank", lang) : tn("halykBank", lang)}</span>
                      </div>
                    )}
                    {placedOrder.invoicePhone && (
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
                        <span style={{ color: muted }}>{tn("invoicePhoneLabel", lang)}</span>
                        <span style={{ fontWeight: 600 }}>{placedOrder.invoicePhone}</span>
                      </div>
                    )}
                    {placedOrder.paymentComment && (
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                        <span style={{ color: muted }}>{tn("paymentComment", lang)}</span>
                        <span style={{ fontWeight: 600, maxWidth: "60%", textAlign: "right" }}>{placedOrder.paymentComment}</span>
                      </div>
                    )}
                  </div>
                )}
                {/* Show card transfer details on success — only the selected bank */}
                {placedOrder.paymentMethod === "card-transfer" && paymentBanks.length > 0 && (() => {
                  const selectedBank =
                    placedOrder.selectedBankIdx != null
                      ? paymentBanks[placedOrder.selectedBankIdx]
                      : paymentBanks.length === 1 ? paymentBanks[0] : null;
                  const banksToShow = selectedBank ? [selectedBank] : paymentBanks;
                  return (
                    <div style={{ marginBottom: SP.sm, paddingBottom: SP.sm, borderBottom: `1px solid ${border}` }}>
                      {banksToShow.map((bank, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
                          <span style={{ color: muted }}>{bank.bank_name}</span>
                          <span style={{ fontWeight: 600 }}>{bank.phone}{bank.recipient_name ? ` · ${bank.recipient_name}` : ""}</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
                {placedOrder.notes && (
                  <OrderRow label={tn("notesLabel", lang)} value={placedOrder.notes} border={border} muted={muted} />
                )}
                <p style={{ fontSize: 11, fontWeight: 700, color: muted, margin: `${SP.sm}px 0`, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {tn("summary", lang)}
                </p>
                {placedOrder.items.map((item, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
                    <span style={{ color: muted }}>{capFirst(item.name)} × {item.qty}</span>
                    <span style={{ fontWeight: 600 }}>{(item.price * item.qty).toLocaleString()} {item.currency}</span>
                  </div>
                ))}
                {placedOrder.deliveryFee && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
                    <span style={{ color: muted }}>🚚 {tn("deliveryFee", lang)}</span>
                    <span style={{ fontWeight: 600 }}>{placedOrder.deliveryFee.toLocaleString()} {placedOrder.currency}</span>
                  </div>
                )}
                {placedOrder.savings && placedOrder.savings > 0 ? (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5, color: isDark ? "#6DB86D" : "#2E7D32" }}>
                    <span>🎉 {tn("savings", lang)}</span>
                    <span style={{ fontWeight: 700 }}>-{placedOrder.savings.toLocaleString()} {placedOrder.currency}</span>
                  </div>
                ) : null}
                {placedOrder.tipsAmount && placedOrder.tipsAmount > 0 ? (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5, color: "#7C3AED" }}>
                    <span>💝 {tn("tipsLabel", lang)}</span>
                    <span style={{ fontWeight: 700 }}>+{placedOrder.tipsAmount.toLocaleString()} {placedOrder.currency}</span>
                  </div>
                ) : null}
                <div style={{ borderTop: `1px solid ${border}`, paddingTop: SP.sm, marginTop: SP.xs, display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 700 }}>
                  <span>{tn("total", lang)}</span>
                  <span>{placedOrder.total.toLocaleString()} {placedOrder.currency}</span>
                </div>
              </div>

              {/* ── Payment reminder (card-transfer / remote-payment) ── */}
              {placedOrder.paymentMethod === "card-transfer" && paymentBanks.length > 0 && (() => {
                const bank =
                  placedOrder.selectedBankIdx != null
                    ? paymentBanks[placedOrder.selectedBankIdx]
                    : paymentBanks.length === 1 ? paymentBanks[0] : paymentBanks[0];
                return (
                  <div style={{
                    width: "100%", marginTop: SP.md, padding: SP.md,
                    background: isDark ? "rgba(245,158,11,0.10)" : "rgba(245,158,11,0.10)",
                    border: `1.5px solid ${isDark ? "rgba(245,158,11,0.35)" : "rgba(245,158,11,0.30)"}`,
                    borderRadius: R.lg, boxSizing: "border-box",
                  }}>
                    <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 800, color: isDark ? "#FCD34D" : "#B45309", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {lang === "en" ? "⚠️ Payment Reminder" : lang === "kz" ? "⚠️ Төлем ескертуі" : "⚠️ Напоминание об оплате"}
                    </p>
                    <p style={{ margin: "0 0 8px", fontSize: 13, color: textClr, lineHeight: 1.5 }}>
                      {lang === "en"
                        ? `Please transfer ${placedOrder.total.toLocaleString()} ${placedOrder.currency} to:`
                        : lang === "kz"
                        ? `${placedOrder.total.toLocaleString()} ${placedOrder.currency} сомасын аударыңыз:`
                        : `Пожалуйста, переведите ${placedOrder.total.toLocaleString()} ${placedOrder.currency} на:`}
                    </p>
                    <div style={{ background: isDark ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.7)", borderRadius: R.md, padding: "10px 12px", marginBottom: 8 }}>
                      <p style={{ margin: "0 0 2px", fontSize: 11, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{bank.bank_name}</p>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <p style={{ margin: 0, fontSize: 18, fontWeight: 800, flex: 1, letterSpacing: "0.02em" }}>{bank.phone}</p>
                        <button
                          type="button"
                          onClick={() => { navigator.clipboard.writeText(bank.phone).then(() => { setCopiedIdx(-1); setTimeout(() => setCopiedIdx(null), 2000); }); }}
                          style={{
                            display: "flex", alignItems: "center", gap: 4,
                            padding: "4px 10px", borderRadius: R.full,
                            border: `1.5px solid ${copiedIdx === -1 ? (isDark ? "#6DB86D" : "#2E7D32") : border}`,
                            background: copiedIdx === -1 ? (isDark ? "rgba(109,184,109,0.15)" : "rgba(46,125,50,0.08)") : "transparent",
                            color: copiedIdx === -1 ? (isDark ? "#6DB86D" : "#2E7D32") : muted,
                            fontSize: 11, fontWeight: 700, cursor: "pointer",
                            transition: "all 0.2s",
                          }}
                        >
                          {copiedIdx === -1 ? <Check size={11} /> : <Copy size={11} />}
                          {copiedIdx === -1
                            ? (lang === "en" ? "Copied!" : lang === "kz" ? "Көшірілді!" : "Скопировано!")
                            : (lang === "en" ? "Copy" : lang === "kz" ? "Көшіру" : "Копировать")}
                        </button>
                      </div>
                      {bank.recipient_name && (
                        <p style={{ margin: "4px 0 0", fontSize: 12, color: muted }}>{tn("recipient", lang)}: <strong style={{ color: textClr }}>{bank.recipient_name}</strong></p>
                      )}
                    </div>
                    <p style={{ margin: 0, fontSize: 11, color: muted, lineHeight: 1.4 }}>
                      {lang === "en"
                        ? "After the transfer is confirmed, the administrator will process your order."
                        : lang === "kz"
                        ? "Аударым тексерілгеннен кейін, әкімші тапсырысыңызды өңдейді."
                        : "После проверки перевода администратор подтвердит ваш заказ."}
                    </p>
                  </div>
                );
              })()}
              {placedOrder.paymentMethod === "remote-payment" && (
                <div style={{
                  width: "100%", marginTop: SP.md, padding: SP.md,
                  background: isDark ? "rgba(168,85,247,0.08)" : "rgba(168,85,247,0.06)",
                  border: `1.5px solid ${isDark ? "rgba(168,85,247,0.30)" : "rgba(168,85,247,0.20)"}`,
                  borderRadius: R.lg, boxSizing: "border-box",
                }}>
                  <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 800, color: isDark ? "rgba(216,180,254,0.9)" : "rgba(107,33,168,0.9)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {lang === "en" ? "📲 Remote Payment" : lang === "kz" ? "📲 Қашықтан төлем" : "📲 Удалённая оплата"}
                  </p>
                  <p style={{ margin: 0, fontSize: 13, color: textClr, lineHeight: 1.5 }}>
                    {lang === "en"
                      ? `The administrator will send you a payment request via ${placedOrder.remoteBank === "kaspi" ? "Kaspi" : placedOrder.remoteBank === "halyk" ? "Halyk Bank" : "your bank app"}${placedOrder.invoicePhone ? ` to ${placedOrder.invoicePhone}` : ""}. Your order will be confirmed after payment.`
                      : lang === "kz"
                      ? `Әкімші${placedOrder.invoicePhone ? ` ${placedOrder.invoicePhone}` : ""} нөміріне ${placedOrder.remoteBank === "kaspi" ? "Kaspi" : placedOrder.remoteBank === "halyk" ? "Halyk Bank" : "банк"} арқылы шот жіберді. Төлемнен кейін тапсырысыңыз расталады.`
                      : `Администратор выставит счёт через ${placedOrder.remoteBank === "kaspi" ? "Kaspi" : placedOrder.remoteBank === "halyk" ? "Halyk Bank" : "банковское приложение"}${placedOrder.invoicePhone ? ` на номер ${placedOrder.invoicePhone}` : ""}. После оплаты ваш заказ будет подтверждён.`}
                  </p>
                </div>
              )}

              {/* ── Review block ── */}
              <div style={{ width: "100%", marginTop: SP.md }}>
                {reviewSubmitted ? (
                  <div style={{ textAlign: "center", padding: `${SP.sm}px 0 ${SP.md}px` }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: isDark ? "#6DB86D" : "#2E7D32", margin: 0 }}>
                      {tn("reviewThanks", lang)}
                    </p>
                  </div>
                ) : (
                  <div style={{ padding: SP.md, background: surface, borderRadius: R.lg, border: `1px solid ${border}` }}>
                    <p style={{ fontSize: 13, fontWeight: 700, textAlign: "center", margin: `0 0 ${SP.sm}px`, color: textClr }}>
                      {tn("rateOrder", lang)}
                    </p>
                    <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: SP.md }}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button
                          key={s}
                          onClick={() => setReviewRating(s)}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 2, lineHeight: 1 }}
                        >
                          <Star
                            size={28}
                            fill={s <= reviewRating ? "#FBBF24" : "none"}
                            style={{ color: s <= reviewRating ? "#FBBF24" : (isDark ? "#3A3A3A" : "#D1D5DB"), transition: "color 0.15s, fill 0.15s" }}
                          />
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder={tn("reviewHint", lang)}
                      rows={2}
                      style={{
                        display: "block", width: "100%",
                        padding: "10px 12px", marginBottom: SP.sm,
                        background: isDark ? "#252525" : "#E6E8EC",
                        border: `1.5px solid ${reviewComment.trim() ? textClr : border}`,
                        borderRadius: R.md, color: textClr, fontSize: 14,
                        outline: "none", boxSizing: "border-box",
                        resize: "none", fontFamily: "inherit",
                        transition: "border-color 0.15s",
                      } as React.CSSProperties}
                    />
                    <button
                      onClick={handleSubmitReview}
                      disabled={reviewRating === 0 || reviewLoading}
                      style={{
                        width: "100%", padding: "11px 0", borderRadius: R.full, border: "none",
                        fontSize: 14, fontWeight: 700,
                        cursor: reviewRating === 0 ? "not-allowed" : "pointer",
                        background: reviewRating === 0 ? border : (isDark ? "#FBBF24" : "#D97706"),
                        color: reviewRating === 0 ? muted : "#FFF",
                        transition: "background 0.2s",
                      }}
                    >
                      {reviewLoading ? "…" : tn("reviewSend", lang)}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div style={{ padding: SP.md, borderTop: `1px solid ${border}`, flexShrink: 0 }}>
              <button onClick={handleClose} style={primaryBtn()}>{tn("backToMenu", lang)}</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ── Small sub-components ──────────────────────────────────────────────────────

function PaymentCard({
  selected, onSelect, icon, label, sublabel,
  border, card, textClr, muted,
}: {
  selected: boolean; onSelect: () => void;
  icon: string; label: string; sublabel: string;
  border: string; card: string; textClr: string; muted: string;
}) {
  return (
    <div
      onClick={onSelect}
      style={{
        padding: SP.md, marginBottom: SP.sm, background: card,
        border: `2px solid ${selected ? textClr : border}`,
        borderRadius: R.lg, cursor: "pointer",
        display: "flex", alignItems: "center", gap: SP.md,
        transition: "border-color 0.15s",
      }}
    >
      <div style={{
        width: 20, height: 20, borderRadius: R.full,
        border: `2px solid ${selected ? textClr : border}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, transition: "all 0.15s",
      }}>
        {selected && <div style={{ width: 10, height: 10, borderRadius: R.full, background: textClr }} />}
      </div>
      <div>
        <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 2px" }}>{icon} {label}</p>
        <p style={{ fontSize: 12, color: muted, margin: 0 }}>{sublabel}</p>
      </div>
    </div>
  );
}

function OrderRow({ label, value, border, muted }: { label: string; value: string; border: string; muted: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: SP.sm, paddingBottom: SP.sm, borderBottom: `1px solid ${border}` }}>
      <span style={{ fontSize: 13, color: muted }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700 }}>{value}</span>
    </div>
  );
}
