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

/** Label of a stored channel; orders from before tracking started have none. */
export const channelLabel = (c: string | null) => (c ? ((CHANNEL_LABEL as Record<string, string>)[c] ?? c) : "قبل التتبع");

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

/** Ready links for each place the shop is shared; the owner pastes them as they are. */
export function trackingLinks(site: string) {
  const u = (source: string, medium: string, campaign?: string) => `${site}/?utm_source=${source}&utm_medium=${medium}${campaign ? `&utm_campaign=${campaign}` : ""}`;
  return [
    { where: "البيو ديال إنستغرام", url: u("instagram", "bio") },
    { where: "الستوريات والبوستات ديال إنستغرام", url: u("instagram", "story") },
    { where: "البيو ديال تيك توك", url: u("tiktok", "bio") },
    { where: "صفحة فيسبوك", url: u("facebook", "page") },
    { where: "الستاتو ديال واتساب", url: u("whatsapp", "status") },
    { where: "إعلانات Meta (فيسبوك وإنستغرام)", url: u("facebook", "paid", "smiyat-l-i3lan") },
    { where: "إعلانات تيك توك", url: u("tiktok", "paid", "smiyat-l-i3lan") },
  ];
}
