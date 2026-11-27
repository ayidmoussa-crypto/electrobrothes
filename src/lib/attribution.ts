// Where a buyer came from: Instagram, TikTok, Google search... Pure, so every rule is tested.
// The proxy reads each page visit and keeps the latest known channel in a cookie for 30 days;
// the order takes it at checkout. A visit with no clue ("direct") never replaces a known channel.

export const CHANNEL_LABEL = {
  INSTAGRAM: "إنستغرام",
  TIKTOK: "تيك توك",
  FACEBOOK: "فيسبوك",
  YOUTUBE: "يوتيوب",
  SEO: "Google (SEO)",
  GOOGLE_ADS: "إعلانات Google",
  META_ADS: "إعلانات Meta",
  TIKTOK_ADS: "إعلانات تيك توك",
  WHATSAPP: "واتساب",
  PHONE: "مكالمة",
  EMAIL: "البريد",
  REFERRAL: "مواقع أخرى",
  DIRECT: "مباشر",
  OTHER: "أخرى",
} as const;

export type Channel = keyof typeof CHANNEL_LABEL;
export type Touch = { channel: Channel; detail: string | null };

export const CHANNEL_COOKIE = "eb_ch";
export const CHANNEL_MAX_AGE = 30 * 24 * 3600;

export const CHANNEL_LABEL_EN: Record<Channel, string> = {
  INSTAGRAM: "Instagram",
  TIKTOK: "TikTok",
  FACEBOOK: "Facebook",
  YOUTUBE: "YouTube",
  SEO: "Google (SEO)",
  GOOGLE_ADS: "Google Ads",
  META_ADS: "Meta ads",
  TIKTOK_ADS: "TikTok ads",
  WHATSAPP: "WhatsApp",
  PHONE: "Phone call",
  EMAIL: "Email",
  REFERRAL: "Other sites",
  DIRECT: "Direct",
  OTHER: "Other",
};

/**
 * A sale made at the shop's counter. Set only by the admin form and kept out of CHANNEL_LABEL on purpose:
 * the visitor's cookie is checked against that list, so nobody online can pass as a shop sale.
 */
export const SHOP_CHANNEL = "SHOP";
export const isShopSale = (o: { channel: string | null }) => o.channel === SHOP_CHANNEL;

/** Label of a stored channel; orders from before tracking started have none. */
export const channelLabel = (c: string | null, lang: "ar" | "en" = "ar") =>
  c === SHOP_CHANNEL ? (lang === "en" ? "Shop" : "المحل") : c ? ((lang === "en" ? CHANNEL_LABEL_EN : (CHANNEL_LABEL as Record<string, string>))[c as Channel] ?? c) : lang === "en" ? "Before tracking" : "قبل التتبع";

const PAID = /^(cpc|ppc|paid|paid_?social|paidsocial|ads?|cpm|display|sponsored)$/;
const SEARCH = /(^|\.)(google|bing|yahoo|duckduckgo|yandex|ecosia|qwant|baidu|brave)\./;

/** Lowercase, safe for a cookie and a database column. */
const clean = (s: string | null | undefined) => {
  const v = (s ?? "").toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return v || null;
};

function fromName(name: string, paid: boolean): Channel | null {
  if (/^(ig|insta|instagram)/.test(name)) return paid ? "META_ADS" : "INSTAGRAM";
  if (/^(fb|facebook|meta)/.test(name)) return paid ? "META_ADS" : "FACEBOOK";
  if (/^(tt|tiktok)/.test(name)) return paid ? "TIKTOK_ADS" : "TIKTOK";
  if (/^(yt|youtube)/.test(name)) return paid ? "GOOGLE_ADS" : "YOUTUBE";
  if (/^google/.test(name)) return paid ? "GOOGLE_ADS" : "SEO";
  if (/^(wa|whatsapp)/.test(name)) return "WHATSAPP";
  if (/^(email|newsletter|mail)/.test(name)) return "EMAIL";
  return null;
}

function hostOf(url: string | null) {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * What one page visit says about where the visitor came from. Null when the visit comes from the shop
 * itself (moving between pages says nothing new).
 */
export function detectTouch(url: URL, referrer: string | null, ownHost: string): Touch | null {
  const q = (k: string) => url.searchParams.get(k);
  const source = clean(q("utm_source"));
  const medium = clean(q("utm_medium")) ?? "";
  const campaign = clean(q("utm_campaign"));
  const paid = PAID.test(medium);

  if (source) return { channel: fromName(source, paid) ?? (paid ? "OTHER" : "REFERRAL"), detail: campaign ?? (fromName(source, paid) ? null : source) };
  if (q("gclid") || q("gbraid") || q("wbraid")) return { channel: "GOOGLE_ADS", detail: null };
  if (q("ttclid")) return { channel: "TIKTOK_ADS", detail: null };

  const host = hostOf(referrer);
  const own = ownHost.toLowerCase().replace(/^www\./, "");
  if (host && (host === own || host.endsWith(`.${own}`))) return null;
  if (host) {
    if (/(^|\.)instagram\.com$/.test(host)) return { channel: "INSTAGRAM", detail: null };
    if (/(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com)$/.test(host)) return { channel: "FACEBOOK", detail: null };
    if (/(^|\.)tiktok\.com$/.test(host)) return { channel: "TIKTOK", detail: null };
    if (/(^|\.)(youtube\.com|youtu\.be)$/.test(host)) return { channel: "YOUTUBE", detail: null };
    if (/(^|\.)(whatsapp\.com|wa\.me)$/.test(host)) return { channel: "WHATSAPP", detail: null };
    if (/(^|\.)(googleadservices\.com|doubleclick\.net)$/.test(host)) return { channel: "GOOGLE_ADS", detail: null };
    if (/(^|\.)(mail|outlook|webmail)\./.test(host)) return { channel: "EMAIL", detail: null };
    const engine = host.match(SEARCH);
    if (engine) return { channel: "SEO", detail: engine[2] };
  }
  // Meta adds fbclid to every link leaving Facebook or Instagram; the referrer usually tells which.
  if (q("fbclid")) return { channel: "FACEBOOK", detail: null };
  if (host) return { channel: "REFERRAL", detail: clean(host) };
  return { channel: "DIRECT", detail: null };
}

export const encodeTouch = (t: Touch) => (t.detail ? `${t.channel}:${t.detail}` : t.channel);

export function decodeTouch(raw: string | undefined | null): Touch | null {
  if (!raw) return null;
  const [channel, detail] = raw.split(":", 2);
  if (!(channel in CHANNEL_LABEL)) return null;
  return { channel: channel as Channel, detail: clean(detail) };
}

/** The cookie value to write after a visit, or null to leave it as it is. */
export function nextTouch(current: Touch | null, visit: Touch | null): Touch | null {
  if (!visit) return null;
  if (visit.channel === "DIRECT") return current ? null : visit;
  return current && current.channel === visit.channel && current.detail === visit.detail ? null : visit;
}

/** An order the owner typed in: the conversation's app is the channel. */
export function channelOfManualSource(source: string): Channel {
  return source === "WHATSAPP" || source === "PHONE" || source === "INSTAGRAM" || source === "FACEBOOK" || source === "TIKTOK" ? source : "OTHER";
}

/**
 * Short links for bios and stories, where a long link looks untidy: /ig counts the visit as Instagram, then
 * opens the home page with a clean address. The proxy reads them; ads keep their full utm links.
 */
export const SHORT_LINKS: Record<string, Channel> = { ig: "INSTAGRAM", tt: "TIKTOK", fb: "FACEBOOK", wa: "WHATSAPP" };

/** The channel of a short link path like "/ig" (any case, with or without a trailing slash), else null. */
export function shortLinkTouch(pathname: string): Touch | null {
  const key = pathname.toLowerCase().replace(/^\/|\/$/g, "");
  return Object.hasOwn(SHORT_LINKS, key) ? { channel: SHORT_LINKS[key], detail: null } : null;
}

/** Ready links for each place the shop is shared; the owner pastes them as they are. */
export function trackingLinks(site: string, lang: "ar" | "en" = "ar") {
  const tr = (ar: string, en: string) => (lang === "en" ? en : ar);
  const u = (source: string, medium: string, campaign?: string) => `${site}/?utm_source=${source}&utm_medium=${medium}${campaign ? `&utm_campaign=${campaign}` : ""}`;
  const short = (key: string) => `${site.replace(/^https?:\/\//, "")}/${key}`;
  return [
    { where: tr("البيو والستوريات ديال إنستغرام", "Instagram bio and stories"), url: short("ig") },
    { where: tr("البيو ديال تيك توك", "TikTok bio"), url: short("tt") },
    { where: tr("صفحة فيسبوك", "Facebook page"), url: short("fb") },
    { where: tr("الستاتو ديال واتساب", "WhatsApp status"), url: short("wa") },
    { where: tr("إعلانات Meta (فيسبوك وإنستغرام)", "Meta ads (Facebook and Instagram)"), url: u("facebook", "paid", "smiyat-l-i3lan") },
    { where: tr("إعلانات تيك توك", "TikTok ads"), url: u("tiktok", "paid", "smiyat-l-i3lan") },
  ];
}
