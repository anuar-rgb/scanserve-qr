import type { RestaurantInfo, PaymentInfo } from "@/components/MenuTemplate";

export const restaurant: RestaurantInfo = {
  name: "АС ТӨРІ",
  address: {
    en: "Address coming soon",
    ru: "Адрес скоро добавим",
    kz: "Мекенжайды жуырда қосамыз",
  },
  currency: "₸",
  kaspiPhone: "+7 778 965 13 12",
  phone: "+7 778 965 13 12",
  whatsappPhone: "77789651312",
  instagramUrl: "https://www.instagram.com/astori.kz",
  description: {
    en: "Welcome to АС ТӨРІ — a cozy spot for authentic Kazakh cuisine. We cook with soul and serve with warmth. Enjoy your meal!",
    ru: "Добро пожаловать в АС ТӨРІ — уютное место для настоящей казахской кухни. Готовим с душой, угощаем с теплом. Приятного аппетита!",
    kz: "АС ТӨРІ-ге қош келдіңіз — дәстүрлі қазақ асханасы. Жүректен пісіріп, жылылықпен сыйлаймыз. Дәмді болсын!",
  },
  cardTransferOptions: [
    { bankName: "Kaspi.kz",   phone: "+7 778 965 13 12", recipientName: "Байтанов Ә." },
    { bankName: "Halyk Bank", phone: "+7 778 965 13 12", recipientName: "Байтанов Ә." },
  ] satisfies PaymentInfo[],
  serviceCharge: "Барлық бағаларға 15% қызмет ақысы кіреді · 15% service charge included",
  workingHours: "10:00 – 22:00",
};
