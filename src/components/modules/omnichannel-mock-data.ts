export type Channel = "viber" | "olx" | "whatsapp";
export type ConversationStatus = "open" | "answered" | "closed";
export type ListingChannelStatus = "active" | "paused" | "error" | "removed";
export type CatalogStatus = "synced" | "error";

export type ChatMessage = {
  id: string;
  author: "customer" | "operator";
  channel: Channel;
  text: string;
  time: string;
};

export type Conversation = {
  id: string;
  name: string;
  phone: string;
  channel: Channel;
  status: ConversationStatus;
  lastMessage: string;
  time: string;
  unread: boolean;
  b2b: boolean;
  vins: string[];
  unsavedVin?: string;
  connection: string;
  messages: ChatMessage[];
};

export type StockItem = {
  id: string;
  name: string;
  oem: string;
  sku: string;
  price: number;
  quantity: number;
  location: string;
  imageTone: string;
};

export type MockListing = StockItem & {
  id: string;
  olxStatus: ListingChannelStatus;
  catalogStatus: CatalogStatus;
  syncedAt: string;
};

export const mockConversations: Conversation[] = [
  {
    id: "conv-1",
    name: "Amar Hadžić",
    phone: "+387 61 234 890",
    channel: "viber",
    status: "open",
    lastMessage: "Evo broj šasije WVWZZZ1KZ...",
    time: "09:42",
    unread: true,
    b2b: false,
    vins: ["WVWZZZ1KZAW123456"],
    unsavedVin: "WVWZZZ1KZAW987654",
    connection: "Viber Live Session",
    messages: [
      { id: "m-1", author: "customer", channel: "viber", text: "Poštovani, imate li prednje kočione diskove za Golf 7 2.0 TDI?", time: "09:38" },
      { id: "m-2", author: "operator", channel: "viber", text: "Pozdrav Amare! Provjeravam stanje i kompatibilnost. Možete li mi poslati broj šasije?", time: "09:40" },
      { id: "m-3", author: "customer", channel: "viber", text: "Evo broj šasije WVWZZZ1KZAW987654.", time: "09:42" },
    ],
  },
  {
    id: "conv-2",
    name: "Lejla Kovačević",
    phone: "+387 62 441 205",
    channel: "olx",
    status: "answered",
    lastMessage: "Koja je zadnja cijena za far?",
    time: "09:36",
    unread: true,
    b2b: false,
    vins: ["WAUZZZ4G9GN012345"],
    connection: "OLX poruka",
    messages: [
      { id: "m-4", author: "customer", channel: "olx", text: "Zdravo, koja je zadnja cijena za far za Audi A6 2016. godište?", time: "09:31" },
      { id: "m-5", author: "operator", channel: "olx", text: "Pozdrav! Cijena zavisi od strane fara i oznake. Imate li broj šasije ili OEM broj?", time: "09:34" },
      { id: "m-6", author: "customer", channel: "olx", text: "Koja je zadnja cijena za far?", time: "09:36" },
    ],
  },
  {
    id: "conv-3",
    name: "Auto servis Kordić",
    phone: "+387 63 555 018",
    channel: "whatsapp",
    status: "open",
    lastMessage: "Treba nam set za Passat B8.",
    time: "09:18",
    unread: false,
    b2b: true,
    vins: ["WVWZZZ3CZHE045671", "WVWZZZ3CZJE078921"],
    connection: "WhatsApp Business",
    messages: [
      { id: "m-7", author: "customer", channel: "whatsapp", text: "Treba nam set prednjih diskova i pločica za Passat B8.", time: "09:15" },
      { id: "m-8", author: "operator", channel: "whatsapp", text: "Imamo više opcija na stanju. Pošaljite VIN da provjerimo odgovarajući set.", time: "09:16" },
      { id: "m-9", author: "customer", channel: "whatsapp", text: "Treba nam set za Passat B8.", time: "09:18" },
    ],
  },
  {
    id: "conv-4",
    name: "Nermin Babić",
    phone: "+387 61 740 326",
    channel: "whatsapp",
    status: "answered",
    lastMessage: "Može li dostava danas za Zenicu?",
    time: "08:57",
    unread: false,
    b2b: false,
    vins: [],
    connection: "WhatsApp Business",
    messages: [
      { id: "m-10", author: "customer", channel: "whatsapp", text: "Trebaju mi zadnje pločice za Škodu Octaviju 2018.", time: "08:50" },
      { id: "m-11", author: "operator", channel: "whatsapp", text: "Imamo ih na stanju. Možete li poslati broj šasije za provjeru?", time: "08:54" },
      { id: "m-12", author: "customer", channel: "whatsapp", text: "Može li dostava danas za Zenicu?", time: "08:57" },
    ],
  },
  {
    id: "conv-5",
    name: "Emir Selimović",
    phone: "+387 62 990 410",
    channel: "olx",
    status: "closed",
    lastMessage: "Hvala, narudžba potvrđena.",
    time: "Juče",
    unread: false,
    b2b: false,
    vins: ["TMBJG7NE6J0123467"],
    connection: "OLX poruka",
    messages: [
      { id: "m-13", author: "customer", channel: "olx", text: "Da li je dostupan lijevi retrovizor za Octaviju?", time: "Juče, 15:20" },
      { id: "m-14", author: "operator", channel: "olx", text: "Dostupan je, cijena je 145 KM. Mogu rezervisati do kraja dana.", time: "Juče, 15:23" },
      { id: "m-15", author: "customer", channel: "olx", text: "Hvala, narudžba potvrđena.", time: "Juče, 15:29" },
    ],
  },
];

export const mockStock: StockItem[] = [
  { id: "part-1", name: "Prednji kočioni disk 312 mm", oem: "5Q0615301F", sku: "BRK-VW-1842", price: 189, quantity: 8, location: "Prolaz A · Polica 3", imageTone: "from-emerald-950 to-green-900 text-emerald-200" },
  { id: "part-2", name: "Prednji far, lijevi LED", oem: "4G0941005C", sku: "LGT-AU-0921", price: 645, quantity: 3, location: "Prolaz C · Polica 12", imageTone: "from-green-950 to-emerald-900 text-emerald-200" },
  { id: "part-3", name: "Set pločica prednjih kočnica", oem: "8V0698151F", sku: "BRK-AU-2103", price: 118, quantity: 12, location: "Prolaz A · Polica 5", imageTone: "from-emerald-950 to-green-900 text-emerald-200" },
  { id: "part-4", name: "Zadnje kočione pločice", oem: "5Q0698451P", sku: "BRK-SK-0645", price: 86, quantity: 0, location: "Prolaz A · Polica 7", imageTone: "from-green-950 to-emerald-900 text-emerald-200" },
  { id: "part-5", name: "Lijevi vanjski retrovizor", oem: "5E1857507R", sku: "MIR-SK-0887", price: 145, quantity: 5, location: "Prolaz D · Polica 2", imageTone: "from-emerald-950 to-green-900 text-emerald-200" },
  { id: "part-6", name: "Set diskova i pločica, prednji", oem: "3Q0615301H", sku: "BRK-VW-3370", price: 329, quantity: 4, location: "Prolaz A · Polica 4", imageTone: "from-green-950 to-emerald-900 text-emerald-200" },
];

export const mockListings: MockListing[] = [
  { ...mockStock[0], olxStatus: "active", catalogStatus: "synced", syncedAt: "Danas, 09:38" },
  { ...mockStock[1], olxStatus: "active", catalogStatus: "synced", syncedAt: "Danas, 09:24" },
  { ...mockStock[2], olxStatus: "active", catalogStatus: "synced", syncedAt: "Danas, 08:52" },
  { ...mockStock[3], olxStatus: "error", catalogStatus: "error", syncedAt: "Juče, 17:06" },
  { ...mockStock[4], olxStatus: "paused", catalogStatus: "synced", syncedAt: "Juče, 16:42" },
  { ...mockStock[5], olxStatus: "active", catalogStatus: "synced", syncedAt: "Juče, 15:30" },
];
