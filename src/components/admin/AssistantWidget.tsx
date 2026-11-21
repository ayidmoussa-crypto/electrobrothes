"use client";

import { Bot, Check, ImagePlus, LoaderCircle, RotateCcw, Send, TriangleAlert, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cancelAssistantAction, confirmAssistantAction, undoAssistantAction, type AssistantActionState } from "@/app/actions/admin-assistant";
import { buttonClass } from "@/components/ui/button";
import type { AssistantCard, AssistantChoice, AssistantReply, AssistantUsageView } from "@/lib/assistant/rules";
import { overBudget } from "@/lib/assistant/rules";
import { useAdminTr } from "./AdminLang";
import { announcePanel, PANEL_EVENT, PANEL_PLACE, type Placement } from "./NotificationsButton";

type Message = {
  id: number;
  role: "user" | "assistant";
  text: string;
  /** Sent to the server but never shown, such as the id behind a product button. */
  hidden?: string;
  /** Written by a button or a default, not typed by the admin. */
  auto?: boolean;
  /** Data URLs, for display. */
  images?: string[];
  cards?: AssistantCard[];
  choices?: { question: string; options: AssistantChoice[] } | null;
  error?: boolean;
};

const MAX_IMAGES = 3;
const MAX_IMAGE_SIDE = 1280;

/** Photos go to the server as JPEG at most 1280px: phone originals are slow and cost more for no gain. */
async function shrink(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.82);
}

const dollars = (micros: number) => `$${(micros / 1_000_000).toFixed(micros > 0 && micros < 10_000 ? 4 : 2)}`;

const cardNote = (c: AssistantCard) => `[${c.summary} — ${{ PENDING: "كيتسنى التأكيد", APPLIED: "تأكد وتسجل", CANCELLED: "تلغى", EXPIRED: "سالا وقتو", UNDONE: "تراجع عليه الأدمن" }[c.status]}]`;

/** What Claude sees of past turns. Only the latest photo is sent again, so a follow-up can still use it. */
function toRequest(messages: Message[]) {
  const lastPhoto = messages.findLast((m) => m.role === "user" && m.images?.length)?.id;
  // A card answers everything before it: those requests must not be proposed again.
  const lastCard = messages.findLastIndex((m) => m.cards?.length);
  return messages.flatMap((m, i) => {
    if (m.error) return [];
    const notes = (m.cards ?? []).map(cardNote).join("\n");
    const text = [m.text, m.hidden, notes].filter(Boolean).join("\n");
    if (!text) return [];
    return [{ role: m.role, text, closed: i <= lastCard, auto: m.auto, ...(m.id === lastPhoto ? { images: m.images!.map((url) => url.slice(url.indexOf(",") + 1)) } : {}) }];
  });
}

function UsageMeter({ usage }: { usage: AssistantUsageView }) {
  const cap = usage.capCents * 10_000;
  const percent = cap ? Math.min(100, Math.round((usage.spentMicros / cap) * 100)) : 100;
  const { tr, ar } = useAdminTr();
  return (
    <div className="px-4 pb-2.5" title={tr("استهلاك Claude API هاد الشهر", "Claude API spend this month")}>
      <div className="flex justify-between text-xs text-warm-300" dir="ltr">
        <span>
          {dollars(usage.spentMicros)} / {dollars(cap)}
        </span>
        <span dir={ar ? "rtl" : "ltr"}>{tr("هاد الشهر", "This month")}</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={tr("استهلاك الميزانية الشهرية", "Monthly budget spent")}>
        <div className={`h-full rounded-full ${overBudget(usage.spentMicros, usage.capCents) ? "bg-danger" : "bg-yellow-500"}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function ProposalCard({ card, onChange }: { card: AssistantCard; onChange: (status: AssistantCard["status"]) => void }) {
  const [busy, setBusy] = useState<"confirm" | "cancel" | "undo" | null>(null);
  const [error, setError] = useState("");
  const router = useRouter();
  const { tr } = useAdminTr();

  const act = async (kind: "confirm" | "cancel" | "undo", action: (s: AssistantActionState, fd: FormData) => Promise<AssistantActionState>, next: AssistantCard["status"]) => {
    setBusy(kind);
    setError("");
    const fd = new FormData();
    fd.set("id", card.id);
    try {
      const result = await action({}, fd);
      if (result.ok) {
        onChange(next);
        router.refresh();
      } else {
        setError(result.message ?? tr("وقع مشكل.", "Something went wrong."));
      }
    } catch {
      setError(tr("ما قدرناش نوصلو للسيرفر. عاود جرب.", "Could not reach the server. Try again."));
    } finally {
      setBusy(null);
    }
  };

  const spinner = <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />;
  const smallGhost = "inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-warm-800 transition-colors hover:bg-warm-100 disabled:opacity-50";

  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-warm-200 bg-white text-warm-800 shadow-sm">
      <div className="flex items-start gap-3 p-3">
        {card.image ? (
          <span className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-warm-100">
            <Image src={card.image} alt="" fill sizes="56px" unoptimized className="object-contain p-1" />
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-ink">{card.title}</p>
          <dl className="mt-1 space-y-0.5 text-sm">
            {card.rows.map((r) => (
              <div key={r.label} className="flex gap-2">
                <dt className="shrink-0 text-warm-600">{r.label}:</dt>
                <dd className="min-w-0 font-semibold break-words" dir="auto">
                  {r.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {card.warning && card.status === "PENDING" ? (
        <p role="alert" className="flex items-center gap-1.5 border-t border-warm-200 bg-warning-soft px-3 py-2 text-sm font-semibold text-warning-text">
          <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
          {card.warning}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-warm-200 bg-warm-50 p-2">
        {card.status === "PENDING" ? (
          <>
            <button type="button" disabled={!!busy} onClick={() => act("confirm", confirmAssistantAction, "APPLIED")} className={buttonClass({ variant: "primary" })}>
              {busy === "confirm" ? spinner : <Check className="size-4" aria-hidden="true" />}
              {tr("تأكيد", "Confirm")}
            </button>
            <button type="button" disabled={!!busy} onClick={() => act("cancel", cancelAssistantAction, "CANCELLED")} className={smallGhost}>
              {busy === "cancel" ? spinner : null}
              {tr("إلغاء", "Cancel")}
            </button>
          </>
        ) : null}
        {card.status === "APPLIED" ? (
          <>
            <span className="flex items-center gap-1 px-1 text-sm font-semibold text-success" role="status">
              <Check className="size-4" aria-hidden="true" />
              {tr("تسجل", "Saved")}
            </span>
            <button type="button" disabled={!!busy} onClick={() => act("undo", undoAssistantAction, "UNDONE")} className={smallGhost}>
              {busy === "undo" ? spinner : <RotateCcw className="size-4" aria-hidden="true" />}
              {tr("تراجع", "Undo")}
            </button>
          </>
        ) : null}
        {card.status === "CANCELLED" ? <span className="px-1 text-sm text-warm-600">{tr("تلغى", "Cancelled")}</span> : null}
        {card.status === "UNDONE" ? <span className="px-1 text-sm text-warm-600">{tr("تراجعتي عليه", "Undone")}</span> : null}
        {card.status === "EXPIRED" ? <span className="px-1 text-sm text-warm-600">{tr("سالا وقتو", "Expired")}</span> : null}
      </div>
      {error ? (
        <p role="alert" className="bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** The assistant's button sits in the side rail (desktop) or the phone's top bar; its panel opens beside it. */
export function AssistantWidget({ placement }: { placement: Placement }) {
  const [open, setOpen] = useState(false);
  const panelId = `assistant-${placement}`;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [usage, setUsage] = useState<AssistantUsageView | null>(null);
  const [notice, setNotice] = useState("");
  const nextId = useRef(1);
  const list = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const { tr } = useAdminTr();

  const blocked = usage ? overBudget(usage.spentMicros, usage.capCents) : false;

  useEffect(() => {
    if (!open) return;
    textarea.current?.focus();
    fetch("/api/admin/assistant")
      .then((r) => (r.ok ? r.json() : null))
      .then((u: AssistantUsageView | null) => u && setUsage(u))
      .catch(() => {});
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Opening the notifications closes the assistant, and the other way round.
  useEffect(() => {
    const other = (e: Event) => (e as CustomEvent<string>).detail !== panelId && setOpen(false);
    window.addEventListener(PANEL_EVENT, other);
    return () => window.removeEventListener(PANEL_EVENT, other);
  }, [panelId]);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [messages, sending, open]);

  const addFiles = async (files: FileList | null) => {
    setNotice("");
    const chosen = [...(files ?? [])].slice(0, MAX_IMAGES - photos.length);
    try {
      const shrunk = await Promise.all(chosen.map(shrink));
      setPhotos((p) => [...p, ...shrunk]);
    } catch {
      setNotice(tr("ما قدرناش نقراو هاد الصورة. جرب JPG ولا PNG.", "Could not read this image. Try JPG or PNG."));
    }
    if (fileInput.current) fileInput.current.value = "";
  };

  const send = async (text: string, images: string[], button?: { hidden?: string }) => {
    const typed = text.trim();
    const clean = typed || (images.length ? tr("شوف هاد الصورة", "Look at this photo") : "");
    if (!clean || sending) return;
    const userMessage: Message = { id: nextId.current++, role: "user", text: clean, hidden: button?.hidden, auto: !!button || !typed, images: images.length ? images : undefined };
    const next = [...messages, userMessage];
    setMessages(next);
    setInput("");
    setPhotos([]);
    setNotice("");
    setSending(true);
    let added: Message;
    try {
      const res = await fetch("/api/admin/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: toRequest(next) }),
      });
      const data = (await res.json().catch(() => null)) as (AssistantReply & { error?: string }) | null;
      if (!res.ok || !data || data.error) {
        added = { id: nextId.current++, role: "assistant", text: res.status === 401 ? tr("سالات الجلسة. دخل من جديد.", "Your session ended. Log in again.") : (data?.error ?? tr("وقع مشكل. عاود جرب.", "Something went wrong. Try again.")), error: true };
      } else {
        added = { id: nextId.current++, role: "assistant", text: data.reply, cards: data.cards, choices: data.choices };
        setUsage(data.usage);
      }
    } catch {
      added = { id: nextId.current++, role: "assistant", text: tr("ما قدرناش نوصلو للسيرفر. عاود جرب.", "Could not reach the server. Try again."), error: true };
    }
    setMessages((m) => [...m, added]);
    setSending(false);
  };

  const setCardStatus = (messageId: number, cardId: string, status: AssistantCard["status"]) =>
    setMessages((all) => all.map((m) => (m.id === messageId ? { ...m, cards: m.cards?.map((c) => (c.id === cardId ? { ...c, status } : c)) } : m)));

  const lastId = messages.at(-1)?.id;

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={() => {
          if (!open) announcePanel(panelId);
          setOpen(!open);
        }}
        aria-expanded={open}
        aria-label={open ? tr("سد المساعد الذكي", "Close the assistant") : tr("حل المساعد الذكي", "Open the assistant")}
        title={tr("المساعد الذكي", "Assistant")}
        className={`grid ${placement === "rail" ? "size-12" : "size-10"} cursor-pointer place-items-center rounded-full bg-yellow-500 text-ink shadow-md shadow-ink/15 transition-colors hover:bg-yellow-600 active:bg-yellow-700`}
      >
        {open ? <X className="size-5" aria-hidden="true" /> : <Bot className="size-5" aria-hidden="true" />}
      </button>

      {open ? (
        <section
          role="dialog"
          aria-label={tr("المساعد الذكي", "Assistant")}
          className={`${PANEL_PLACE[placement]} flex flex-col overflow-hidden rounded-3xl border border-warm-200 bg-warm-50 shadow-2xl shadow-ink/30 ${placement === "rail" ? "h-[min(40rem,calc(100dvh-3rem))]" : ""}`}
        >
          <header className="bg-ink text-white">
            <div className="flex items-center gap-2 px-4 py-3">
              <span className="grid size-8 place-items-center rounded-full bg-yellow-500 text-ink">
                <Bot className="size-4.5" aria-hidden="true" />
              </span>
              <p className="min-w-0 flex-1 font-extrabold">{tr("المساعد الذكي", "Assistant")}</p>
              <Link href="/admin/assistant" className="rounded-md px-1 text-xs text-warm-300 underline underline-offset-2 hover:text-white">
                {tr("السجل", "Log")}
              </Link>
            </div>
            {usage ? <UsageMeter usage={usage} /> : null}
          </header>

          <div ref={list} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3" aria-live="polite">
            {messages.length === 0 ? (
              <div className="rounded-xl bg-white p-3 text-sm text-warm-800">
                <p className="font-semibold">{tr("صور منتج ولا كتب ليا شنو بغيتي فالمنتجات:", "Send a product photo or tell me what to change in the products:")}</p>
                <ul className="mt-1 space-y-0.5 text-warm-600">
                  <li>{tr("المخزون: «جبت منو 20 كحل» · «سالا الأبيض»", "Stock: “got 20 black ones” · “white is sold out”")}</li>
                  <li>{tr("الثمن: «QCY T13 دير ليه 230» · «تخفيض من 300 ل 250»", "Price: “set QCY T13 to 230” · “discount from 300 to 250”")}</li>
                  <li>{tr("لون جديد: «زيد ليه الأزرق، جاني منو 10»", "New colour: “add blue, I got 10”")}</li>
                  <li>{tr("النصوص: «بدل العنوان ديال Anker Zolo» · «حسّن الوصف»", "Texts: “change the Anker Zolo title” · “improve the description”")}</li>
                  <li>{tr("منتج جديد: صور ليا المنتج", "New product: send me a photo of it")}</li>
                </ul>
                <p className="mt-2 text-xs text-warm-600">{tr("ما كنبدل والو حتى تضغط «تأكيد».", "Nothing changes until you press “Confirm”.")}</p>
              </div>
            ) : null}

            {messages.map((m) => (
              <div key={m.id} className={m.role === "user" ? "flex flex-col items-start" : "flex flex-col items-stretch"}>
                {m.images?.length ? (
                  <div className="mb-1 flex gap-1">
                    {m.images.map((src, i) => (
                      <span key={i} className="relative size-20 overflow-hidden rounded-lg bg-warm-100">
                        <Image src={src} alt={tr("الصورة اللي صيفطتي", "The photo you sent")} fill sizes="80px" unoptimized className="object-cover" />
                      </span>
                    ))}
                  </div>
                ) : null}
                <p
                  dir="auto"
                  className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                    m.role === "user" ? "bg-ink text-white" : m.error ? "self-end bg-danger-soft text-danger" : "self-end bg-white text-warm-800"
                  }`}
                >
                  {m.text}
                </p>
                {m.cards?.map((card) => (
                  <ProposalCard key={card.id} card={card} onChange={(s) => setCardStatus(m.id, card.id, s)} />
                ))}
                {m.choices ? (
                  <div className="mt-2 rounded-xl border border-warm-200 bg-white p-2">
                    <p className="px-1 pb-2 text-sm font-semibold text-ink">{m.choices.question}</p>
                    <div className="flex flex-col gap-1.5">
                      {m.choices.options.map((o) => (
                        <button
                          key={o.productId}
                          type="button"
                          disabled={sending || m.id !== lastId}
                          onClick={() => send(o.name, [], { hidden: `product_id: ${o.productId}` })}
                          className="flex min-h-14 cursor-pointer items-center gap-2 rounded-lg border border-warm-200 p-1.5 text-start transition-colors hover:bg-yellow-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <span className="relative size-11 shrink-0 overflow-hidden rounded-md bg-warm-100">
                            {o.image ? <Image src={o.image} alt="" fill sizes="44px" unoptimized className="object-contain p-0.5" /> : null}
                          </span>
                          <span className="min-w-0 text-sm">
                            <span className="block font-semibold text-ink" dir="auto">
                              {o.name}
                            </span>
                            <span className="block truncate text-xs text-warm-600">{[o.brand, ...o.colors].join(" · ")}</span>
                          </span>
                        </button>
                      ))}
                      <button
                        type="button"
                        disabled={sending || m.id !== lastId}
                        onClick={() => send(tr("حتى واحد ما هو هادا، المنتج ما كاينش فالمتجر", "None of these: the product is not in the shop"), [], {})}
                        className="min-h-11 cursor-pointer rounded-lg px-2 text-sm font-semibold text-warm-800 transition-colors hover:bg-warm-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {tr("حتى واحد ما هو هادا", "None of these")}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}

            {sending ? (
              <p className="flex items-center justify-end gap-2 text-sm text-warm-600" role="status">
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                {tr("كنقلب…", "Searching…")}
              </p>
            ) : null}
          </div>

          <form
            className="border-t border-warm-200 bg-white p-2"
            onSubmit={(e) => {
              e.preventDefault();
              send(input, photos);
            }}
          >
            {photos.length ? (
              <div className="mb-2 flex gap-1.5">
                {photos.map((src, i) => (
                  <span key={i} className="relative size-14 overflow-hidden rounded-lg bg-warm-100">
                    <Image src={src} alt="" fill sizes="56px" unoptimized className="object-cover" />
                    <button
                      type="button"
                      onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                      aria-label={tr("حيد الصورة", "Remove photo")}
                      className="absolute end-0 top-0 grid size-6 cursor-pointer place-items-center rounded-bl-lg bg-ink text-white"
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            {notice ? (
              <p role="alert" className="mb-2 rounded-lg bg-danger-soft px-2 py-1 text-xs text-danger">
                {notice}
              </p>
            ) : null}
            {blocked ? (
              <p className="mb-2 rounded-lg bg-warning-soft px-2 py-1 text-xs text-warning-text">
                {tr("وصلنا للسقف الشهري.", "The monthly cap is reached.")}{" "}
                <Link href="/admin/settings" className="underline underline-offset-2">
                  {tr("زيد فيه من الإعدادات", "Raise it in Settings")}
                </Link>
              </p>
            ) : null}
            <div className="flex items-end gap-1.5">
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                multiple
                hidden
                aria-label={tr("زيد صورة", "Add a photo")}
                onChange={(e) => addFiles(e.target.files)}
              />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={photos.length >= MAX_IMAGES || blocked}
                aria-label={tr("زيد صورة", "Add a photo")}
                title={tr("زيد صورة", "Add a photo")}
                className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-lg text-warm-800 transition-colors hover:bg-warm-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ImagePlus className="size-5" aria-hidden="true" />
              </button>
              <textarea
                ref={textarea}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    send(input, photos);
                  }
                }}
                rows={1}
                maxLength={3500}
                disabled={blocked}
                dir="auto"
                placeholder={tr("كتب هنا…", "Type here…")}
                aria-label={tr("رسالتك للمساعد", "Your message to the assistant")}
                className="max-h-28 min-h-11 flex-1 resize-none rounded-lg bg-warm-100 px-3 py-2.5 text-base text-warm-800 placeholder:text-warm-400 disabled:cursor-not-allowed"
              />
              <button
                type="submit"
                disabled={sending || blocked || (!input.trim() && !photos.length)}
                aria-label={tr("صيفط", "Send")}
                title={tr("صيفط", "Send")}
                className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-lg bg-yellow-500 text-ink transition-colors hover:bg-yellow-600 active:bg-yellow-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="size-5 rtl:-scale-x-100" aria-hidden="true" />
              </button>
            </div>
          </form>
        </section>
      ) : null}
    </>
  );
}
