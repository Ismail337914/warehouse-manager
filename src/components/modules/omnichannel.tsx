"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Box,
  Building2,
  Check,
  CheckCheck,
  ChevronDown,
  CircleAlert,
  Clock3,
  FileText,
  Image as ImageIcon,
  Link2,
  MessageCircle,
  MoreHorizontal,
  PackageCheck,
  Pause,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Tag,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";

import {
  mockConversations,
  mockListings,
  mockStock,
  type CatalogStatus,
  type Channel,
  type ChatMessage,
  type Conversation,
  type ConversationStatus,
  type ListingChannelStatus,
  type MockListing,
  type StockItem,
} from "./omnichannel-mock-data";
import { ListingsModule } from "./listings";

type ModuleTab = "inbox" | "listings" | "integrations";
type ConversationFilter = "all" | Channel | "unread";

const channelMeta: Record<Channel, { label: string; className: string; icon: string }> = {
  viber: { label: "Viber", className: "bg-violet-100 text-violet-700", icon: "V" },
  olx: { label: "OLX", className: "bg-sky-100 text-sky-700", icon: "O" },
  whatsapp: { label: "WhatsApp", className: "bg-emerald-100 text-emerald-700", icon: "W" },
};

const conversationStatusLabel: Record<ConversationStatus, string> = {
  open: "Otvoreno",
  answered: "Odgovoreno",
  closed: "Zatvoreno",
};

const conversationStatusClass: Record<ConversationStatus, string> = {
  open: "bg-amber-50 text-amber-700 ring-amber-200",
  answered: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  closed: "bg-slate-100 text-slate-500 ring-slate-200",
};

const listingStatusLabel: Record<ListingChannelStatus, string> = {
  active: "Aktivan",
  paused: "Pauziran",
  error: "Greška",
  removed: "Uklonjen",
};

function formatPrice(price: number) {
  return `${new Intl.NumberFormat("bs-BA", { maximumFractionDigits: 2 }).format(price)} KM`;
}

function nowLabel() {
  return new Intl.DateTimeFormat("bs-BA", { hour: "2-digit", minute: "2-digit" }).format(new Date());
}

function ChannelMark({ channel, small = false }: { channel: Channel; small?: boolean }) {
  const meta = channelMeta[channel];
  return (
    <span
      aria-label={meta.label}
      title={meta.label}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ${meta.className} ${small ? "h-5 w-5 text-[10px]" : "h-7 w-7 text-xs"}`}
    >
      {meta.icon}
    </span>
  );
}

function SectionHeading({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {detail && <p className="mt-0.5 text-xs text-slate-500">{detail}</p>}
      </div>
      {action}
    </div>
  );
}

function StockThumbnail({ item, large = false }: { item: StockItem; large?: boolean }) {
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${item.imageTone} ${large ? "h-14 w-14" : "h-10 w-10"}`}>
      <Box className={large ? "h-6 w-6" : "h-5 w-5"} strokeWidth={1.7} aria-hidden="true" />
    </div>
  );
}

function StatusPill({ status }: { status: ListingChannelStatus }) {
  const styles: Record<ListingChannelStatus, string> = {
    active: "bg-emerald-50 text-emerald-700",
    paused: "bg-slate-100 text-slate-600",
    error: "bg-rose-50 text-rose-700",
    removed: "bg-slate-100 text-slate-500",
  };
  const Icon = status === "active" ? Check : status === "paused" ? Pause : status === "error" ? CircleAlert : X;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium ${styles[status]}`}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {listingStatusLabel[status]}
    </span>
  );
}

function CatalogPill({ status }: { status: CatalogStatus }) {
  return status === "synced" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700">
      <CheckCheck className="h-3 w-3" aria-hidden="true" /> Sinhronizovan
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-700">
      <CircleAlert className="h-3 w-3" aria-hidden="true" /> Potrebna dopuna
    </span>
  );
}

function SummaryCard({ label, value, note, icon: Icon, tone }: {
  label: string;
  value: string;
  note: string;
  icon: typeof ShoppingBag;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm shadow-slate-200/40 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-1.5 text-xl font-semibold tracking-tight text-slate-950 sm:mt-2 sm:text-2xl">{value}</p>
          <p className="mt-1 text-[10px] leading-4 text-slate-500 sm:text-[11px]">{note}</p>
        </div>
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
    </div>
  );
}

export function OmnichannelModule() {
  const [activeTab, setActiveTab] = useState<ModuleTab>("inbox");
  const [mobileInboxView, setMobileInboxView] = useState<"list" | "chat" | "context">("list");
  const [conversations, setConversations] = useState(mockConversations);
  const [selectedId, setSelectedId] = useState(mockConversations[0].id);
  const [conversationFilter, setConversationFilter] = useState<ConversationFilter>("all");
  const [conversationSearch, setConversationSearch] = useState("");
  const [stockSearch, setStockSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [selectedStockId, setSelectedStockId] = useState(mockStock[0].id);
  const [reservedPartIds, setReservedPartIds] = useState<string[]>([]);
  const [listings, setListings] = useState(mockListings);
  const [listingSearch, setListingSearch] = useState("");
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editingPrice, setEditingPrice] = useState("");
  const [showLegacyListings, setShowLegacyListings] = useState(false);
  const [notice, setNotice] = useState("");
  const [syncingAll, setSyncingAll] = useState(false);

  const selectedConversation = conversations.find((conversation) => conversation.id === selectedId) ?? conversations[0];
  const selectedStockItem = mockStock.find((item) => item.id === selectedStockId) ?? mockStock[0];

  const filteredConversations = useMemo(() => {
    const query = conversationSearch.trim().toLocaleLowerCase("bs");
    return conversations.filter((conversation) => {
      const matchesFilter =
        conversationFilter === "all" ||
        (conversationFilter === "unread" ? conversation.unread : conversation.channel === conversationFilter);
      const searchable = [
        conversation.name,
        conversation.phone,
        conversation.lastMessage,
        ...conversation.vins,
        conversation.unsavedVin ?? "",
      ].join(" ").toLocaleLowerCase("bs");
      return matchesFilter && (!query || searchable.includes(query));
    });
  }, [conversationFilter, conversationSearch, conversations]);

  const filteredStock = useMemo(() => {
    const query = stockSearch.trim().toLocaleLowerCase("bs");
    if (!query) return mockStock;
    return mockStock.filter((item) => `${item.name} ${item.oem} ${item.sku}`.toLocaleLowerCase("bs").includes(query));
  }, [stockSearch]);

  const filteredListings = useMemo(() => {
    const query = listingSearch.trim().toLocaleLowerCase("bs");
    return listings.filter((listing) =>
      !query || `${listing.name} ${listing.oem} ${listing.sku}`.toLocaleLowerCase("bs").includes(query),
    );
  }, [listingSearch, listings]);

  const unreadCount = conversations.filter((conversation) => conversation.unread).length;
  const syncErrorCount = listings.filter((listing) => listing.olxStatus === "error" || listing.catalogStatus === "error").length;
  const syncedCount = listings.filter((listing) => listing.catalogStatus === "synced").length;

  const selectConversation = (conversation: Conversation) => {
    setSelectedId(conversation.id);
    setMobileInboxView("chat");
    setDraft("");
    setNotice("");
    setConversations((current) => current.map((item) =>
      item.id === conversation.id ? { ...item, unread: false } : item,
    ));
  };

  const updateConversation = (id: string, changes: Partial<Conversation>) => {
    setConversations((current) => current.map((conversation) =>
      conversation.id === id ? { ...conversation, ...changes } : conversation,
    ));
  };

  const sendMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !selectedConversation) return;

    const message: ChatMessage = {
      id: `message-${Date.now()}`,
      author: "operator",
      channel: selectedConversation.channel,
      text,
      time: nowLabel(),
    };

    // Replace this mock send with the selected channel adapter (for example POST /api/viber/send-message).
    setConversations((current) => current.map((conversation) =>
      conversation.id === selectedConversation.id
        ? { ...conversation, messages: [...conversation.messages, message], lastMessage: text, time: "Upravo", status: "answered" }
        : conversation,
    ));
    setDraft("");
    setNotice("Poruka je simulirano poslana.");
  };

  const insertStockOffer = (item: StockItem) => {
    setSelectedStockId(item.id);
    setDraft(`Dostupan je ${item.name} (OEM ${item.oem}) po cijeni ${formatPrice(item.price)}. Stanje: ${item.quantity} kom. Lokacija: ${item.location}.`);
    setNotice("Ponuda je unesena u poruku. Provjerite tekst prije slanja.");
  };

  const toggleReservation = (item: StockItem) => {
    const reserved = reservedPartIds.includes(item.id);
    setReservedPartIds((current) =>
      reserved ? current.filter((id) => id !== item.id) : [...current, item.id],
    );
    setNotice(reserved ? "Privremena rezervacija je uklonjena." : `Artikal ${item.sku} je privremeno rezervisan.`);
    // Replace with POST /api/bookings when the reservation service is connected.
  };

  const createPosInvoice = () => {
    setNotice(`POS račun za ${selectedConversation.name} je pripremljen (demo).`);
    // Replace with the ERP POS invoice action when checkout is wired to live data.
  };

  const syncListing = (id: string) => {
    // Replace this simulated update with POST /api/olx/sync and the Viber catalog sync adapter.
    setListings((current) => current.map((listing) =>
      listing.id === id ? { ...listing, olxStatus: "active", catalogStatus: "synced", syncedAt: "Upravo" } : listing,
    ));
    setNotice("Oglas i stanje artikla su simulirano sinhronizovani.");
  };

  const syncAllListings = () => {
    setSyncingAll(true);
    window.setTimeout(() => {
      setListings((current) => current.map((listing) => ({
        ...listing,
        olxStatus: listing.olxStatus === "paused" || listing.olxStatus === "removed" ? listing.olxStatus : "active",
        catalogStatus: "synced",
        syncedAt: "Upravo",
      })));
      setSyncingAll(false);
      setNotice("Masovna sinhronizacija je završena.");
    }, 650);
    // Replace with a server-side bulk sync job rather than a browser-side loop.
  };

  const toggleListingPause = (id: string) => {
    setListings((current) => current.map((listing) =>
      listing.id === id ? { ...listing, olxStatus: listing.olxStatus === "active" || listing.olxStatus === "error" ? "paused" : "active" } : listing,
    ));
    setNotice("Status oglasa je ažuriran (demo).");
  };

  const saveListingPrice = (listing: MockListing) => {
    const nextPrice = Number(editingPrice);
    if (!Number.isFinite(nextPrice) || nextPrice < 0) {
      setNotice("Unesite ispravnu cijenu veću ili jednaku nuli.");
      return;
    }
    setListings((current) => current.map((item) =>
      item.id === listing.id ? { ...item, price: nextPrice } : item,
    ));
    setEditingPriceId(null);
    setNotice("Cijena je sačuvana lokalno (demo).");
  };

  const removeOlxListing = (id: string) => {
    setListings((current) => current.map((listing) =>
      listing.id === id ? { ...listing, olxStatus: "removed" } : listing,
    ));
    setNotice("Oglas je uklonjen iz aktivnih (simulacija).");
    // Replace with the marketplace's supported unpublish endpoint when OLX API access is configured.
  };

  const tabs: { id: ModuleTab; label: string; icon: typeof MessageCircle; count?: number }[] = [
    { id: "inbox", label: "Omnichannel inbox", icon: MessageCircle, count: unreadCount },
    { id: "listings", label: "Oglasnik & sinhronizacija", icon: ShoppingBag },
    { id: "integrations", label: "API konekcije", icon: Link2 },
  ];

  return (
    <div className="mx-auto max-w-[1600px] space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-medium text-slate-500">
            <span>Prodaja</span><span className="text-slate-300">/</span><span>Oglasi i poruke</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Listings & Inbox</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> DEMO OKRUŽENJE
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">Poruke kupaca, artikli i kanali prodaje na jednom mjestu.</p>
        </div>
        <div className="flex items-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-sm sm:self-auto">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Mock podaci aktivni
          <ChevronDown className="ml-1 h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
        </div>
      </div>

      <div className="module-tab-list flex gap-1 overflow-x-auto border-b border-slate-200" role="tablist" aria-label="Listings i Inbox moduli">
        {tabs.map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            id={`tab-${id}`}
            role="tab"
            aria-selected={activeTab === id}
            aria-controls={`panel-${id}`}
            onClick={() => { setActiveTab(id); setNotice(""); if (id === "inbox") setMobileInboxView("list"); }}
            className={`-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-xs font-medium transition-colors sm:px-4 sm:text-sm ${
              activeTab === id
                ? "border-slate-900 text-slate-950"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
            {!!count && count > 0 && <span className="rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">{count}</span>}
          </button>
        ))}
      </div>

      {notice && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          <span>{notice}</span>
          <button onClick={() => setNotice("")} aria-label="Zatvori obavijest" className="rounded p-0.5 hover:bg-blue-100"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {activeTab === "inbox" && (
        <div
          id="panel-inbox"
          role="tabpanel"
          aria-labelledby="tab-inbox"
          className="grid min-h-[min(680px,calc(100dvh-230px))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50 lg:min-h-[590px] lg:grid-cols-[250px_minmax(0,1fr)] 2xl:h-[min(710px,calc(100vh-265px))] 2xl:grid-cols-[250px_minmax(0,1fr)_275px]"
        >
          <aside className={`${mobileInboxView === "list" ? "flex" : "hidden"} min-h-0 flex-col border-b border-slate-200 lg:flex lg:border-r lg:border-b-0`}>
            <div className="border-b border-slate-100 p-3 sm:p-4">
              <div className="mb-3 flex items-center justify-between">
                <SectionHeading title="Razgovori" detail={`${conversations.length} aktivnih niti`} />
                <button aria-label="Novi razgovor" onClick={() => setNotice("Novi razgovor možete započeti kroz povezani kanal (demo).")} className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"><Plus className="h-4 w-4" /></button>
              </div>
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  type="search"
                  placeholder="Kupac, telefon ili VIN..."
                  aria-label="Pretraži razgovore"
                  value={conversationSearch}
                  onChange={(event) => setConversationSearch(event.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs outline-none transition focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100"
                />
              </label>
              <div className="mt-3 flex gap-1 overflow-x-auto pb-0.5">
                {([
                  ["all", "Sve"],
                  ["viber", "Viber"],
                  ["olx", "OLX"],
                  ["whatsapp", "WhatsApp"],
                  ["unread", "Nepročitano"],
                ] as [ConversationFilter, string][]).map(([filter, label]) => (
                  <button
                    key={filter}
                    onClick={() => setConversationFilter(filter)}
                    className={`shrink-0 rounded-md px-2 py-1.5 text-[10px] font-medium transition ${
                      conversationFilter === filter ? "bg-emerald-300 text-slate-950" : "text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {filteredConversations.map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => selectConversation(conversation)}
                  aria-current={selectedConversation.id === conversation.id ? "true" : undefined}
                  className={`mb-1 w-full rounded-lg border p-3 text-left transition ${
                    selectedConversation.id === conversation.id
                      ? "border-slate-300 bg-slate-50 shadow-sm"
                      : "border-transparent hover:border-slate-100 hover:bg-slate-50/70"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="relative mt-0.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                        {conversation.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}
                      </div>
                      <span className="absolute -bottom-1 -right-1"><ChannelMark channel={conversation.channel} small /></span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`truncate text-xs ${conversation.unread ? "font-semibold text-slate-900" : "font-medium text-slate-700"}`}>{conversation.name}</span>
                        <span className="shrink-0 text-[10px] text-slate-400">{conversation.time}</span>
                      </div>
                      <p className={`mt-1 truncate text-[11px] ${conversation.unread ? "font-medium text-slate-700" : "text-slate-500"}`}>{conversation.lastMessage}</p>
                      <div className="mt-2 flex items-center gap-1.5">
                        <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium ring-1 ring-inset ${conversationStatusClass[conversation.status]}`}>{conversationStatusLabel[conversation.status]}</span>
                        {conversation.unsavedVin && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-medium text-amber-700">VIN nesnimljen</span>}
                        {conversation.unread && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-600" aria-label="Nepročitano" />}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
              {filteredConversations.length === 0 && <p className="px-3 py-8 text-center text-xs text-slate-500">Nema razgovora za odabrane filtere.</p>}
            </div>
            <div className="border-t border-slate-100 px-4 py-3 text-[10px] text-slate-400">
              <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> 3 kanala povezana</span>
            </div>
          </aside>

          <section className={`${mobileInboxView === "chat" ? "flex" : "hidden"} min-h-0 flex-col lg:flex lg:min-h-0`}>
            <header className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-3 sm:gap-3 sm:px-4">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  aria-label="Nazad na razgovore"
                  onClick={() => setMobileInboxView("list")}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 lg:hidden"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                  {selectedConversation.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-sm font-semibold text-slate-900">{selectedConversation.name}</h2>
                    <ChannelMark channel={selectedConversation.channel} small />
                    <span className="hidden items-center gap-1 text-[10px] text-emerald-700 sm:inline-flex"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{selectedConversation.connection}</span>
                  </div>
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500"><Phone className="h-3 w-3" />{selectedConversation.phone}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  aria-label="Prikaži detalje kupca i lagera"
                  onClick={() => setMobileInboxView("context")}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-2 text-[11px] font-medium text-slate-600 2xl:hidden"
                >
                  <UserRound className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Detalji</span>
                </button>
                <button aria-label="Pozovi kupca" onClick={() => setNotice(`Poziv kupcu ${selectedConversation.phone} (demo).`)} className="hidden rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 sm:inline-flex"><Phone className="h-4 w-4" /></button>
                <button aria-label="Više opcija razgovora" onClick={() => setNotice("Dodatne opcije razgovora (demo).")} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><MoreHorizontal className="h-4 w-4" /></button>
              </div>
            </header>

            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-2">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-slate-500"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Privatni razgovor · {selectedConversation.channel === "viber" ? "Viber Live Session" : selectedConversation.connection}</span>
              <label className="flex items-center gap-2 text-[10px] text-slate-500">
                Status
                <select
                  aria-label="Status razgovora"
                  value={selectedConversation.status}
                  onChange={(event) => updateConversation(selectedConversation.id, { status: event.target.value as ConversationStatus })}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-700 outline-none focus:border-slate-400"
                >
                  {Object.entries(conversationStatusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50/40 px-3 py-4 sm:px-4 sm:py-5">
              <div className="mx-auto w-fit rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] text-slate-400 shadow-sm">Danas</div>
              {selectedConversation.messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              {selectedConversation.unsavedVin && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-amber-200 bg-amber-50 px-3.5 py-2.5">
                    <p className="text-xs text-amber-950">VIN prepoznat u poruci</p>
                    <p className="mt-1 font-mono text-[11px] text-amber-800">{selectedConversation.unsavedVin}</p>
                    <button
                      onClick={() => {
                        updateConversation(selectedConversation.id, {
                          vins: [...selectedConversation.vins, selectedConversation.unsavedVin!],
                          unsavedVin: undefined,
                        });
                        setNotice("VIN je spremljen u garažu kupca.");
                      }}
                      className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 hover:text-amber-950"
                    >
                      <Plus className="h-3 w-3" /> Spremi u garažu
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 bg-white p-3">
              <div className="mb-2 grid grid-cols-2 gap-1.5">
                <span className="col-span-2 text-[10px] font-medium text-slate-400">Brzi odgovor</span>
                {[
                  ["Imamo na stanju", "Imamo na stanju traženi artikal. Želite li da vam pošaljemo ponudu?"],
                  ["Nemamo na stanju", "Trenutno nemamo artikal na stanju. Mogu provjeriti rok nabavke."],
                  ["Cijena dostave", "Dostava iznosi 10 KM, a isporuka je u roku od 1–2 radna dana."],
                ].map(([label, message]) => (
                  <button key={label} onClick={() => setDraft(message)} className="min-h-8 rounded-lg border border-slate-200 px-2 py-1.5 text-[10px] leading-4 text-slate-600 hover:border-slate-300 hover:bg-slate-50">{label}</button>
                ))}
              </div>
              <form onSubmit={sendMessage}>
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                  placeholder="Napišite poruku..."
                  aria-label="Nova poruka"
                  rows={2}
                  className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <button type="button" aria-label="Dodaj prilog" onClick={() => setNotice("Dodavanje priloga biće dostupno nakon povezivanja API-ja.")} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><ImageIcon className="h-4 w-4" /></button>
                    <button type="button" onClick={() => setNotice("Dokument je pripremljen za izradu (demo).")} className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[10px] text-slate-500 hover:bg-slate-100"><FileText className="h-3.5 w-3.5" /> Ugovor / račun</button>
                  </div>
                  <button type="submit" disabled={!draft.trim()} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-300 px-3 text-xs font-medium text-slate-950 hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-40">
                    Pošalji <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
              </form>
            </div>
          </section>

          <aside className={`${mobileInboxView === "context" ? "block" : "hidden"} border-t border-slate-200 bg-slate-50/50 lg:col-span-2 2xl:col-span-1 2xl:block 2xl:overflow-y-auto 2xl:border-t-0 2xl:border-l`}>
            <div className="space-y-4 p-3 sm:p-4">
              <div className="flex items-start justify-between gap-2">
                <SectionHeading title="ERP kontekst" detail="Brzi uvid u kupca i lager" />
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setMobileInboxView("chat")} className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2 text-[10px] font-medium text-slate-600 2xl:hidden">
                    <ArrowLeft className="h-3.5 w-3.5" /> Chat
                  </button>
                  <button aria-label="Postavke ERP konteksta" onClick={() => setNotice("Postavke konteksta (demo).")} className="rounded-md p-1 text-slate-400 hover:bg-slate-200"><Settings2 className="h-4 w-4" /></button>
                </div>
              </div>

              <section className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><UserRound className="h-4 w-4" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-slate-800">{selectedConversation.name}</p>
                    <p className="text-[10px] text-slate-500">{selectedConversation.phone}</p>
                  </div>
                  <span className={`rounded-md px-1.5 py-1 text-[9px] font-semibold ${selectedConversation.b2b ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{selectedConversation.b2b ? "B2B" : "B2C"}</span>
                </div>
                <div className="mt-3 border-t border-slate-100 pt-2.5">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-slate-600">Garaža kupca</span>
                    <span className="text-[10px] text-slate-400">{selectedConversation.vins.length} VIN</span>
                  </div>
                  {selectedConversation.vins.length ? selectedConversation.vins.map((vin) => (
                    <div key={vin} className="mb-1 flex items-center gap-1.5 rounded-md bg-slate-50 px-2 py-1.5">
                      <Tag className="h-3 w-3 shrink-0 text-slate-400" />
                      <span className="truncate font-mono text-[9px] text-slate-600">{vin}</span>
                    </div>
                  )) : <p className="py-1 text-[10px] text-slate-400">Nema spremljenih VIN brojeva.</p>}
                </div>
              </section>

              <section>
                <div className="mb-2 flex items-center justify-between">
                  <SectionHeading title="Brza pretraga lagera" />
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-500">WMS</span>
                </div>
                <label className="relative mb-2 block">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    aria-label="Pretraži lager po OEM broju ili nazivu"
                    placeholder="OEM broj ili naziv..."
                    value={stockSearch}
                    onChange={(event) => setStockSearch(event.target.value)}
                    className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-2 text-[10px] outline-none focus:border-slate-400"
                  />
                </label>
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {filteredStock.map((item) => {
                    const reserved = reservedPartIds.includes(item.id);
                    return (
                      <div key={item.id} className={`rounded-xl border bg-white p-2.5 ${selectedStockId === item.id ? "border-slate-300 ring-1 ring-slate-200" : "border-slate-200"}`}>
                        <div className="flex gap-2">
                          <StockThumbnail item={item} />
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-[10px] font-semibold leading-4 text-slate-800">{item.name}</p>
                            <p className="mt-0.5 font-mono text-[9px] text-slate-400">{item.oem}</p>
                            <div className="mt-1 flex items-center justify-between gap-1">
                              <span className="text-[10px] font-semibold text-slate-800">{formatPrice(item.price)}</span>
                              <span className={`text-[9px] font-medium ${item.quantity > 0 ? "text-emerald-700" : "text-rose-600"}`}>{item.quantity > 0 ? `${item.quantity} kom.` : "Nema na stanju"}</span>
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-1 border-t border-slate-100 pt-2">
                          <span className="truncate text-[9px] text-slate-400">{item.location}</span>
                          <button
                            onClick={() => insertStockOffer(item)}
                            className="shrink-0 rounded-md bg-emerald-300 px-2 py-1 text-[9px] font-medium text-slate-950 hover:bg-emerald-200"
                          >
                            Umetni ponudu
                          </button>
                        </div>
                        <button
                          onClick={() => toggleReservation(item)}
                          disabled={item.quantity === 0 && !reserved}
                          className={`mt-1.5 flex w-full items-center justify-center gap-1 rounded-md border py-1 text-[9px] font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
                            reserved ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <PackageCheck className="h-3 w-3" />{reserved ? "Rezervisano · otkaži" : "Privremeno rezerviši"}
                        </button>
                      </div>
                    );
                  })}
                  {filteredStock.length === 0 && <p className="py-4 text-center text-[10px] text-slate-400">Nema artikala za pretragu.</p>}
                </div>
              </section>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => insertStockOffer(selectedStockItem)}
                  className="inline-flex min-h-9 items-center justify-center gap-1 rounded-lg bg-emerald-300 px-2 text-[10px] font-medium text-slate-950 hover:bg-emerald-200"
                >
                  <Send className="h-3 w-3" /> Pripremi ponudu
                </button>
                <button onClick={createPosInvoice} className="inline-flex min-h-9 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-medium text-slate-700 hover:bg-slate-50">
                  <WalletCards className="h-3 w-3" /> POS račun
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {activeTab === "listings" && (
        <div id="panel-listings" role="tabpanel" aria-labelledby="tab-listings" className="space-y-3 sm:space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
            <SummaryCard label="Aktivni oglasi" value={`${listings.filter((item) => item.olxStatus === "active").length}`} note="Na OLX marketplaceu" icon={ShoppingBag} tone="bg-blue-50 text-blue-700" />
            <SummaryCard label="Sinhronizovano sa lagerom" value={`${syncedCount} / ${listings.length}`} note="Viber katalog i stanje" icon={PackageCheck} tone="bg-emerald-50 text-emerald-700" />
            <div className="col-span-2 sm:col-span-1">
              <SummaryCard label="Greška / dopuna stanja" value={`${syncErrorCount}`} note="Artikli koji traže provjeru" icon={CircleAlert} tone="bg-amber-50 text-amber-700" />
            </div>
          </div>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50">
            <div className="flex flex-col gap-3 border-b border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Objavljeni artikli</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">Status oglasa i dostupnost prema trenutnom stanju lagera.</p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                <label className="relative w-full sm:w-auto">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={listingSearch}
                    onChange={(event) => setListingSearch(event.target.value)}
                    placeholder="Naziv, OEM ili SKU..."
                    aria-label="Pretraži oglase"
                    className="h-10 w-full rounded-lg border border-slate-200 pl-8 pr-2 text-xs outline-none focus:border-slate-400 sm:h-9 sm:w-52"
                  />
                </label>
                <button onClick={syncAllListings} disabled={syncingAll} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-300 px-3 text-xs font-semibold text-slate-950 hover:bg-emerald-200 disabled:opacity-60 sm:h-9 sm:w-auto">
                  <RefreshCw className={`h-3.5 w-3.5 ${syncingAll ? "animate-spin" : ""}`} />
                  {syncingAll ? "Sinhronizacija..." : "Sinhronizuj sve"}
                </button>
              </div>
            </div>

            <div className="hidden overflow-x-auto 2xl:block">
              <table className="w-full min-w-[1050px] border-collapse text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Artikal</th>
                    <th className="px-3 py-3 font-semibold">OEM / SKU</th>
                    <th className="px-3 py-3 text-right font-semibold">Cijena</th>
                    <th className="px-3 py-3 font-semibold">Lager</th>
                    <th className="px-3 py-3 font-semibold">OLX</th>
                    <th className="px-3 py-3 font-semibold">Viber katalog</th>
                    <th className="px-3 py-3 font-semibold">Zadnja sinhr.</th>
                    <th className="px-3 py-3 text-right font-semibold">Akcije</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredListings.map((listing) => (
                    <tr key={listing.id} className="transition-colors hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <StockThumbnail item={listing} />
                          <div>
                            <p className="max-w-48 font-medium leading-4 text-slate-800">{listing.name}</p>
                            <p className="mt-1 text-[10px] text-slate-400">{listing.location}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-mono text-[10px] text-slate-700">{listing.oem}</p>
                        <p className="mt-1 font-mono text-[10px] text-slate-400">{listing.sku}</p>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right">
                        {editingPriceId === listing.id ? (
                          <div className="flex items-center justify-end gap-1">
                            <input
                              aria-label={`Nova cijena za ${listing.name}`}
                              type="number"
                              min="0"
                              step="0.01"
                              value={editingPrice}
                              onChange={(event) => setEditingPrice(event.target.value)}
                              className="w-20 rounded border border-slate-300 px-1.5 py-1 text-right text-xs"
                            />
                            <button onClick={() => saveListingPrice(listing)} aria-label="Sačuvaj cijenu" className="rounded bg-emerald-50 p-1 text-emerald-700"><Check className="h-3.5 w-3.5" /></button>
                            <button onClick={() => setEditingPriceId(null)} aria-label="Odustani" className="rounded bg-slate-100 p-1 text-slate-500"><X className="h-3.5 w-3.5" /></button>
                          </div>
                        ) : <span className="font-semibold text-slate-800">{formatPrice(listing.price)}</span>}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`font-semibold ${listing.quantity > 0 ? "text-slate-800" : "text-rose-600"}`}>{listing.quantity}</span>
                        <span className="ml-1 text-[10px] text-slate-400">kom.</span>
                      </td>
                      <td className="px-3 py-3"><StatusPill status={listing.olxStatus} /></td>
                      <td className="px-3 py-3"><CatalogPill status={listing.catalogStatus} /></td>
                      <td className="whitespace-nowrap px-3 py-3 text-[10px] text-slate-500">{listing.syncedAt}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            title="Ručno sinhronizuj"
                            aria-label={`Ručno sinhronizuj ${listing.name}`}
                            onClick={() => syncListing(listing.id)}
                            className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-700"
                          ><RefreshCw className="h-3.5 w-3.5" /></button>
                          <button
                            title={listing.olxStatus === "paused" || listing.olxStatus === "removed" ? "Aktiviraj oglas" : "Pauziraj oglas"}
                            aria-label={listing.olxStatus === "paused" || listing.olxStatus === "removed" ? `Aktiviraj ${listing.name}` : `Pauziraj ${listing.name}`}
                            onClick={() => toggleListingPause(listing.id)}
                            className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:bg-amber-50 hover:text-amber-700"
                          ><Pause className="h-3.5 w-3.5" /></button>
                          <button
                            title="Uredi cijenu"
                            aria-label={`Uredi cijenu za ${listing.name}`}
                            onClick={() => { setEditingPriceId(listing.id); setEditingPrice(String(listing.price)); }}
                            className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                          ><Tag className="h-3.5 w-3.5" /></button>
                          <button
                            title="Ukloni sa OLX-a"
                            aria-label={`Ukloni ${listing.name} sa OLX-a`}
                            onClick={() => removeOlxListing(listing.id)}
                            className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700"
                          ><X className="h-3.5 w-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredListings.length === 0 && <p className="px-4 py-10 text-center text-xs text-slate-500">Nema oglasa za zadanu pretragu.</p>}
            </div>

            <div className="space-y-3 p-3 2xl:hidden">
              {filteredListings.map((listing) => (
                <article key={listing.id} className="rounded-xl border border-slate-200 bg-slate-50/40 p-3">
                  <div className="flex items-start gap-3">
                    <StockThumbnail item={listing} large />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold leading-5 text-slate-900">{listing.name}</h3>
                      <p className="mt-1 text-[11px] text-slate-500">{listing.location}</p>
                      <p className="mt-2 break-all font-mono text-[10px] leading-4 text-slate-500">OEM {listing.oem} <span className="px-1 text-slate-300">·</span> SKU {listing.sku}</p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-y border-slate-200 py-3 text-xs">
                    <div>
                      <p className="text-[10px] text-slate-500">Cijena</p>
                      {editingPriceId === listing.id ? (
                        <div className="mt-1 flex items-center gap-1">
                          <input
                            aria-label={`Nova cijena za ${listing.name}`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={editingPrice}
                            onChange={(event) => setEditingPrice(event.target.value)}
                            className="min-w-0 w-full rounded border border-slate-300 px-2 py-1.5 text-xs"
                          />
                          <button onClick={() => saveListingPrice(listing)} aria-label="Sačuvaj cijenu" className="rounded bg-emerald-50 p-1.5 text-emerald-700"><Check className="h-4 w-4" /></button>
                          <button onClick={() => setEditingPriceId(null)} aria-label="Odustani" className="rounded bg-slate-100 p-1.5 text-slate-500"><X className="h-4 w-4" /></button>
                        </div>
                      ) : <p className="mt-1 font-semibold text-slate-900">{formatPrice(listing.price)}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-500">Na lageru</p>
                      <p className={`mt-1 font-semibold ${listing.quantity > 0 ? "text-slate-900" : "text-rose-600"}`}>{listing.quantity} kom.</p>
                    </div>
                    <div>
                      <p className="mb-1 text-[10px] text-slate-500">OLX</p>
                      <StatusPill status={listing.olxStatus} />
                    </div>
                    <div>
                      <p className="mb-1 text-[10px] text-slate-500">Viber katalog</p>
                      <CatalogPill status={listing.catalogStatus} />
                    </div>
                    <div className="col-span-2 flex items-center gap-1.5 text-[10px] text-slate-500">
                      <Clock3 className="h-3 w-3" /> Zadnja sinhronizacija: {listing.syncedAt}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button onClick={() => syncListing(listing.id)} className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-700">
                      <RefreshCw className="h-3.5 w-3.5" /> Sinhronizuj
                    </button>
                    <button onClick={() => toggleListingPause(listing.id)} className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-700">
                      <Pause className="h-3.5 w-3.5" /> {listing.olxStatus === "paused" || listing.olxStatus === "removed" ? "Aktiviraj" : "Pauziraj"}
                    </button>
                    <button onClick={() => { setEditingPriceId(listing.id); setEditingPrice(String(listing.price)); }} className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-700">
                      <Tag className="h-3.5 w-3.5" /> Uredi cijenu
                    </button>
                    <button onClick={() => removeOlxListing(listing.id)} className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-700">
                      <X className="h-3.5 w-3.5" /> Ukloni OLX
                    </button>
                  </div>
                </article>
              ))}
              {filteredListings.length === 0 && <p className="px-2 py-8 text-center text-xs text-slate-500">Nema oglasa za zadanu pretragu.</p>}
            </div>

            <div className="flex flex-col gap-1 border-t border-slate-100 px-3 py-3 text-[10px] text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-4">
              <span>Prikazano {filteredListings.length} od {listings.length} artikala</span>
              <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" /> Posljednja provjera: prije 2 min</span>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <button
              aria-expanded={showLegacyListings}
              onClick={() => setShowLegacyListings((visible) => !visible)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
            >
              <span>
                <span className="block text-xs font-semibold text-slate-700">Postojeća ERP evidencija oglasa</span>
                <span className="mt-0.5 block text-[10px] text-slate-500">Sačuvani oglasi u ERP bazi · odvojeno od demo sinhronizacije</span>
              </span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${showLegacyListings ? "rotate-180" : ""}`} />
            </button>
            {showLegacyListings && <div className="border-t border-slate-200 p-4"><ListingsModule /></div>}
          </section>
        </div>
      )}

      {activeTab === "integrations" && (
        <div id="panel-integrations" role="tabpanel" aria-labelledby="tab-integrations" className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
            <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Status API i webhook konekcija</h2>
                <p className="mt-1 text-xs text-slate-500">Pregled komunikacijskih kanala i njihove spremnosti za povezivanje.</p>
              </div>
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1.5 text-[10px] font-semibold text-amber-800">
                <ShieldCheck className="h-3.5 w-3.5" /> Svi statusi su simulirani
              </span>
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              <IntegrationCard
                name="Viber Bot Webhook"
                description="Prijem i slanje poruka, katalog artikala"
                badge="SIMULIRANO · AKTIVNO"
                detail="HTTPS · Webhook dostupan"
                icon={<span className="text-lg font-bold">V</span>}
                color="bg-violet-100 text-violet-700"
                active
              />
              <IntegrationCard
                name="OLX Marketplace API"
                description="Oglasi, cijene i dostupnost artikala"
                badge="SIMULIRANO · SPREMNO"
                detail="Čeka pristupne podatke"
                icon={<span className="text-lg font-bold">O</span>}
                color="bg-sky-100 text-sky-700"
              />
              <IntegrationCard
                name="WhatsApp Business API"
                description="Razgovori i predlošci poruka"
                badge="SIMULIRANO · SPREMNO"
                detail="Čeka verifikaciju broja"
                icon={<MessageCircle className="h-5 w-5" />}
                color="bg-emerald-100 text-emerald-700"
              />
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
              <SectionHeading title="Događaji konekcije" detail="Zadnje aktivnosti u mock okruženju" />
              <div className="mt-4 space-y-4">
                {[
                  { title: "Webhook poruka primljena", detail: "Viber Bot · Amar Hadžić", time: "09:42", style: "bg-violet-100 text-violet-700", icon: <ArrowDownLeft className="h-3.5 w-3.5" /> },
                  { title: "Stanje artikala sinhronizovano", detail: "OLX Marketplace · 6 artikala", time: "09:38", style: "bg-blue-100 text-blue-700", icon: <RefreshCw className="h-3.5 w-3.5" /> },
                  { title: "WhatsApp session aktivna", detail: "WhatsApp Business · Auto servis Kordić", time: "09:18", style: "bg-emerald-100 text-emerald-700", icon: <ArrowUpRight className="h-3.5 w-3.5" /> },
                ].map(({ title, detail, time, style, icon }) => (
                  <div key={title} className="flex items-center gap-3">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${style}`}>{icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-slate-800">{title}</p>
                      <p className="mt-0.5 truncate text-[10px] text-slate-500">{detail}</p>
                    </div>
                    <span className="text-[10px] text-slate-400">{time}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-700"><Building2 className="h-4 w-4" /></span>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Spremno za povezivanje</h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Dodajte pristupne podatke kroz sigurne server-side environment varijable prije aktivacije produkcijskih adaptera.</p>
                </div>
              </div>
              <ul className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-[11px] text-slate-600">
                <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-600" /> Modularni kanal komunikacije</li>
                <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-600" /> Odvojene listing sync akcije</li>
                <li className="flex items-center gap-2"><Clock3 className="h-3.5 w-3.5 text-slate-400" /> Webhook URL i tokeni: nisu konfigurirani</li>
              </ul>
              <button onClick={() => setNotice("Konfiguracija integracija je dostupna administratoru (demo).")} className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50">
                <Settings2 className="h-3.5 w-3.5" /> Postavke integracija
              </button>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isOperator = message.author === "operator";
  return (
    <div className={`flex ${isOperator ? "justify-end" : "justify-start"}`}>
      <div className={`flex max-w-[82%] items-end gap-2 ${isOperator ? "flex-row-reverse" : ""}`}>
        {!isOperator && <ChannelMark channel={message.channel} small />}
        <div className={isOperator ? "text-right" : ""}>
          <div className={`rounded-2xl px-3.5 py-2.5 text-xs leading-5 ${
            isOperator ? "rounded-br-md bg-emerald-300 text-slate-950" : "rounded-bl-md border border-slate-200 bg-white text-slate-700"
          }`}>
            {message.text}
          </div>
          <div className={`mt-1 flex items-center gap-1 text-[9px] text-slate-400 ${isOperator ? "justify-end" : ""}`}>
            <span>{isOperator ? "Vi" : "Kupac"} · {message.time}</span>
            {isOperator && <CheckCheck className="h-3 w-3 text-blue-500" />}
          </div>
        </div>
      </div>
    </div>
  );
}

function IntegrationCard({ name, description, badge, detail, icon, color, active = false }: {
  name: string;
  description: string;
  badge: string;
  detail: string;
  icon: ReactNode;
  color: string;
  active?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>{icon}</span>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-semibold ${
          active ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"
        }`}>
          <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-blue-500"}`} />{badge}
        </span>
      </div>
      <h3 className="mt-4 text-sm font-semibold text-slate-900">{name}</h3>
      <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
        <span className="text-[10px] text-slate-500">{detail}</span>
        {active && <span className="text-[10px] font-medium text-emerald-700">Upravo aktivno</span>}
      </div>
    </div>
  );
}
