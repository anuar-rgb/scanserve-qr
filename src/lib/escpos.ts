// ESC/POS binary command builder for 80mm LAN thermal printers.
// Text is encoded as CP866 (DOS Cyrillic) — universally supported in CIS printers.
// All commands target 80mm paper (42 chars per line at standard font).

const ESC = 0x1b;
const GS  = 0x1d;
const LF  = 0x0a;

export const LINE_WIDTH = 42;

// Unicode → CP866 lookup for Cyrillic block
const CP866_MAP: Record<number, number> = {
  // А-П (uppercase)
  0x0410: 0x80, 0x0411: 0x81, 0x0412: 0x82, 0x0413: 0x83,
  0x0414: 0x84, 0x0415: 0x85, 0x0416: 0x86, 0x0417: 0x87,
  0x0418: 0x88, 0x0419: 0x89, 0x041A: 0x8A, 0x041B: 0x8B,
  0x041C: 0x8C, 0x041D: 0x8D, 0x041E: 0x8E, 0x041F: 0x8F,
  // Р-Я (uppercase)
  0x0420: 0x90, 0x0421: 0x91, 0x0422: 0x92, 0x0423: 0x93,
  0x0424: 0x94, 0x0425: 0x95, 0x0426: 0x96, 0x0427: 0x97,
  0x0428: 0x98, 0x0429: 0x99, 0x042A: 0x9A, 0x042B: 0x9B,
  0x042C: 0x9C, 0x042D: 0x9D, 0x042E: 0x9E, 0x042F: 0x9F,
  // а-п (lowercase)
  0x0430: 0xA0, 0x0431: 0xA1, 0x0432: 0xA2, 0x0433: 0xA3,
  0x0434: 0xA4, 0x0435: 0xA5, 0x0436: 0xA6, 0x0437: 0xA7,
  0x0438: 0xA8, 0x0439: 0xA9, 0x043A: 0xAA, 0x043B: 0xAB,
  0x043C: 0xAC, 0x043D: 0xAD, 0x043E: 0xAE, 0x043F: 0xAF,
  // р-я (lowercase)
  0x0440: 0xE0, 0x0441: 0xE1, 0x0442: 0xE2, 0x0443: 0xE3,
  0x0444: 0xE4, 0x0445: 0xE5, 0x0446: 0xE6, 0x0447: 0xE7,
  0x0448: 0xE8, 0x0449: 0xE9, 0x044A: 0xEA, 0x044B: 0xEB,
  0x044C: 0xEC, 0x044D: 0xED, 0x044E: 0xEE, 0x044F: 0xEF,
  // Ё / ё
  0x0401: 0xF0,
  0x0451: 0xF1,
};

/** Encode UTF-8 string → CP866 Buffer (non-Cyrillic ASCII passthrough, unknown → '?') */
export function cp866(text: string): Buffer {
  const bytes: number[] = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0x3F;
    if (cp < 0x80) {
      bytes.push(cp);
    } else {
      bytes.push(CP866_MAP[cp] ?? 0x3F);
    }
  }
  return Buffer.from(bytes);
}

// ── Low-level builders ─────────────────────────────────────────────────────────

function b(...bytes: number[]): Buffer { return Buffer.from(bytes); }
function text(s: string): Buffer { return cp866(s); }
function textLF(s: string): Buffer { return Buffer.concat([cp866(s), b(LF)]); }
function separator(): Buffer { return textLF("-".repeat(LINE_WIDTH)); }

/** Pad two strings to fill LINE_WIDTH: left-aligned name, right-aligned value */
function padRow(left: string, right: string): Buffer {
  const gap = LINE_WIDTH - right.length - 1;
  const l = left.length > gap ? left.slice(0, gap) : left.padEnd(gap);
  return textLF(`${l} ${right}`);
}

// ── ESC/POS command constants ──────────────────────────────────────────────────

const INIT         = () => b(ESC, 0x40);               // Initialize printer
const SET_CP866    = () => b(ESC, 0x74, 0x11);         // Code table: PC866 Cyrillic
const ALIGN_LEFT   = () => b(ESC, 0x61, 0x00);
const ALIGN_CENTER = () => b(ESC, 0x61, 0x01);
const BOLD_ON      = () => b(ESC, 0x45, 0x01);
const BOLD_OFF     = () => b(ESC, 0x45, 0x00);
const SIZE_NORMAL  = () => b(GS, 0x21, 0x00);          // 1×1
const SIZE_WIDE    = () => b(GS, 0x21, 0x10);          // 2× width
const SIZE_TALL    = () => b(GS, 0x21, 0x01);          // 2× height
const SIZE_DOUBLE  = () => b(GS, 0x21, 0x11);          // 2× width + 2× height
const FEED         = (n: number) => b(ESC, 0x64, n);   // Feed n lines
const CUT          = () => b(GS, 0x56, 0x42, 0x00);   // Partial cut
/** Beep: n pulses, each lasting duration×100ms */
const BEEP         = (n: number, duration: number) => b(ESC, 0x42, n, duration);

// ── Public types ───────────────────────────────────────────────────────────────

export interface EscPosItem {
  name: string;
  qty: number;
  price?: number;
  original_price?: number;
  modifiers?: { name: string }[];
  note?: string;
  categoryId?: string;
}

export interface KitchenTicketOpts {
  tableLabel: string;
  orderType: "dine-in" | "delivery" | "takeaway" | string;
  orderTime: string;
  orderId: string;
  items: EscPosItem[];
  beep?: boolean;
}

export interface PreCheckOpts {
  restaurantName: string;
  tableLabel: string;
  waiterName: string;
  orderId: string;
  orderTime: string;
  items: EscPosItem[];
  totalPrice: number;
  paidAmount?: number;
}

// ── Ticket builders ────────────────────────────────────────────────────────────

/** Кухонный бегунок — no prices, large qty, auto cut + beep */
export function buildKitchenTicket(opts: KitchenTicketOpts): Buffer {
  const { tableLabel, orderType, orderTime, orderId, items, beep = true } = opts;
  const typeLabel =
    orderType === "dine-in"  ? "ЗАЛ" :
    orderType === "delivery" ? "ДОСТАВКА" : "С СОБОЙ";
  const d = new Date(orderTime);
  const timeStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

  const chunks: Buffer[] = [
    INIT(),
    SET_CP866(),
    ...(beep ? [BEEP(3, 3)] : []),

    ALIGN_CENTER(),
    BOLD_ON(),
    SIZE_DOUBLE(),
    textLF("*** КУХНЯ ***"),
    SIZE_NORMAL(),
    BOLD_OFF(),

    SIZE_WIDE(),
    textLF(tableLabel.toUpperCase()),
    SIZE_NORMAL(),
    textLF(`ТИП: ${typeLabel}  ВРЕМЯ: ${timeStr}`),
    separator(),
    ALIGN_LEFT(),
  ];

  for (const item of items) {
    chunks.push(
      BOLD_ON(),
      SIZE_TALL(),
      textLF(`[${item.qty} шт]  ${item.name.toUpperCase()}`),
      SIZE_NORMAL(),
      BOLD_OFF(),
    );
    for (const mod of item.modifiers ?? []) {
      chunks.push(textLF(`  >> ${mod.name.toUpperCase()}`));
    }
    if (item.note) chunks.push(textLF(`  * ${item.note.toUpperCase()}`));
    chunks.push(b(LF));
  }

  chunks.push(
    separator(),
    ALIGN_CENTER(),
    textLF(`#${orderId.slice(0, 8).toUpperCase()}`),
    FEED(3),
    CUT(),
  );

  return Buffer.concat(chunks);
}

/** Пречек — prices, totals, waiter, auto cut (no beep) */
export function buildPreCheck(opts: PreCheckOpts): Buffer {
  const { restaurantName, tableLabel, waiterName, orderId, orderTime, items, totalPrice, paidAmount = 0 } = opts;
  const d = new Date(orderTime);
  const dateStr = d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
  const timeStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const savedAmount = items.reduce(
    (s, it) => it.original_price != null ? s + (it.original_price - (it.price ?? 0)) * it.qty : s,
    0,
  );
  const balanceDue = Math.max(0, totalPrice - paidAmount);

  const chunks: Buffer[] = [
    INIT(),
    SET_CP866(),
    ALIGN_CENTER(),
    BOLD_ON(),
    textLF(restaurantName.toUpperCase()),
    BOLD_OFF(),
    textLF("--- ПРЕЧЕК ---"),
    separator(),
    ALIGN_LEFT(),
    textLF(tableLabel),
    textLF(`Дата: ${dateStr}  Время: ${timeStr}`),
    textLF(`Официант: ${waiterName}`),
    separator(),
  ];

  for (const item of items) {
    const price  = item.price ?? 0;
    const total  = price * item.qty;
    const name   = item.name.length > 24 ? item.name.slice(0, 24) : item.name;
    chunks.push(
      padRow(`${name} x${item.qty}`, `${total.toLocaleString("ru-RU")} T`),
      textLF(`  @ ${price.toLocaleString("ru-RU")} T`),
    );
    for (const mod of item.modifiers ?? []) {
      chunks.push(textLF(`  + ${mod.name}`));
    }
    if (item.note) chunks.push(textLF(`  * ${item.note}`));
  }

  chunks.push(
    separator(),
    BOLD_ON(),
    padRow("ИТОГО:", `${totalPrice.toLocaleString("ru-RU")} T`),
    BOLD_OFF(),
  );
  if (savedAmount > 0) {
    chunks.push(padRow("Скидка:", `-${savedAmount.toLocaleString("ru-RU")} T`));
  }
  if (paidAmount > 0) {
    chunks.push(padRow("Предоплата:", `-${paidAmount.toLocaleString("ru-RU")} T`));
  }
  if (savedAmount > 0 || paidAmount > 0) {
    chunks.push(BOLD_ON(), padRow("К ОПЛАТЕ:", `${balanceDue.toLocaleString("ru-RU")} T`), BOLD_OFF());
  }

  chunks.push(
    separator(),
    ALIGN_CENTER(),
    textLF("Спасибо за визит!"),
    textLF(`#${orderId.slice(0, 8).toUpperCase()}`),
    FEED(3),
    CUT(),
  );

  return Buffer.concat(chunks);
}

/** Тестовая страница для проверки связи с принтером */
export function buildTestPage(printerName: string): Buffer {
  return Buffer.concat([
    INIT(),
    SET_CP866(),
    BEEP(1, 2),
    ALIGN_CENTER(),
    BOLD_ON(),
    textLF("*** ТЕСТ ПРИНТЕРА ***"),
    BOLD_OFF(),
    separator(),
    textLF(printerName),
    textLF("Соединение успешно!"),
    separator(),
    FEED(3),
    CUT(),
  ]);
}
