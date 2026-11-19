"use client";

import { Check, ChevronDown, CircleAlert, CircleCheck, Copy, Gift, Headset, LoaderCircle, SendHorizontal } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { markSupportSolved, sendSupportMessage } from "@/app/actions/support";
import { buttonClass } from "@/components/ui/button";
import type { SupportView } from "@/lib/support/customer";
import { MAX_MESSAGE_LENGTH, STATUS_TONE } from "@/lib/support/rules";
import { Badge } from "@/components/ui/Badge";

function Thumb({ src }: { src: string | null }) {
  return (
    <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-warm-100">
      {src ? <Image src={src} alt="" fill sizes="48px" unoptimized={src.endsWith(".svg")} className="object-contain p-1" /> : null}
    </span>
  );
}

/** The thank-you coupon: a personal code the customer can copy, on ink so it reads as a gift, not a chat line. */
function RewardCard({ reward }: { reward: NonNullable<SupportView["reward"]> }) {
  const t = useTranslations("support");
  const locale = useLocale();
  const [copied, setCopied] = useState(false);
  const until = new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "en-GB", { dateStyle: "long", timeZone: "Africa/Casablanca" }).format(new Date(reward.expiresAt));
  const copy = () => {
    navigator.clipboard
      ?.writeText(reward.code)
      .then(() => setCopied(true))
      .catch(() => setCopied(false));
  };
  return (
    <section aria-labelledby="reward-title" className="rounded-2xl bg-ink p-5 text-white">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-yellow-500 text-ink">
          <Gift className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h2 id="reward-title" className="text-base text-white">
            {t("rewardTitle")}
          </h2>
          <p className="text-sm text-warm-300">{t("rewardText", { percent: reward.percent })}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <p className="rounded-lg border border-dashed border-yellow-500 px-4 py-2 font-mono text-lg font-extrabold tracking-wider text-yellow-500" dir="ltr">
          {reward.code}
        </p>
        <button type="button" onClick={copy} className={buttonClass()}>
          {copied ? <Check className="size-5" aria-hidden="true" /> : <Copy className="size-5" aria-hidden="true" />}
          {copied ? t("rewardCopied") : t("rewardCopy")}
        </button>
      </div>
      <p className="mt-3 text-xs text-warm-300">{t("rewardTerms", { date: until })}</p>
    </section>
  );
}

type Ticket = SupportView["tickets"][number];
type Message = Ticket["messages"][number];

function Bubble({ m, label }: { m: Pick<Message, "role" | "text">; label: string }) {
  const mine = m.role === "customer";
  const tone = mine ? "bg-ink text-white" : m.role === "owner" ? "border border-yellow-200 bg-yellow-50 text-warm-900" : "bg-warm-100 text-warm-800";
  return (
    <li className={`flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`}>
      <span className="px-1 text-xs font-semibold text-warm-600">{label}</span>
      <p className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-line ${tone}`}>{m.text}</p>
    </li>
  );
}

/** The customer's side of the support chat: pick the product, describe the problem, follow the steps. */
export function SupportChat({ token, data }: { token: string; data: SupportView }) {
  const t = useTranslations("support");
  const router = useRouter();
  const [itemId, setItemId] = useState(data.items[0]?.id ?? "");
  const [text, setText] = useState("");
  // The customer's message, shown at once until the server's copy arrives with the refreshed page.
  const [sent, setSent] = useOptimistic<string | null, string>(null, (_, value) => value);
  const [error, setError] = useState<string | null>(null);
  const [solvedNow, setSolvedNow] = useState(false);
  const [pending, start] = useTransition();
  const end = useRef<HTMLDivElement>(null);

  const active = data.tickets.find((tk) => tk.itemId === itemId && (tk.status === "OPEN" || tk.status === "ESCALATED"));
  const past = data.tickets.filter((tk) => tk !== active && tk.status !== "OPEN" && tk.status !== "ESCALATED");
  const messages = active?.messages ?? [];
  const label = (role: Message["role"]) => (role === "customer" ? t("you") : role === "owner" ? t("owner") : t("ai"));
  const locale = useLocale();
  const dateFmt = new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : "en-GB", { dateStyle: "medium", timeZone: "Africa/Casablanca" });

  // A block body on purpose: newer browsers return a promise from scrollIntoView, and React would call it as a cleanup.
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [messages.length, sent, pending]);

  const send = () => {
    const value = text.trim();
    if (!value || pending) return;
    setError(null);
    setSolvedNow(false);
    setText("");
    start(async () => {
      setSent(value);
      const res = await sendSupportMessage(token, { itemId, text: value }).catch(() => ({ error: "send" as const }));
      if (res.error) {
        setError(res.error === "invalid" ? "send" : res.error);
        if (res.error !== "too_long_conversation") setText(value);
      }
      router.refresh();
    });
  };

  const solved = () => {
    if (!active || pending) return;
    start(async () => {
      const res = await markSupportSolved(token, active.id).catch(() => ({ error: "send" as const }));
      if (res.error) setError(res.error === "closed" ? "closed" : "send");
      else setSolvedNow(true);
      router.refresh();
    });
  };

  return (
    <div className="mt-2 flex flex-col gap-5">
      <div>
        <p className="font-semibold text-ink">{t("hello", { name: data.firstName })}</p>
        <p className="mt-1 text-warm-600">{t("intro")}</p>
      </div>

      {/* Desktop: the chat on the main side, the products, the gift and past chats in a column beside it.
          Phones: products, gift, chat, then the past chats. */}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-flow-dense lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section aria-labelledby="support-products" className="rounded-2xl border border-warm-200 bg-white p-4 lg:col-start-2">
        <h2 id="support-products" className="mb-3 text-sm text-ink">
          {data.items.length > 1 ? t("pick") : t("product")}
        </h2>
        {data.items.length > 1 ? (
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">{t("pick")}</legend>
            {data.items.map((i) => (
              <label
                key={i.id}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-warm-200 bg-white p-2.5 transition-colors hover:border-warm-300 has-checked:border-ink has-checked:bg-warm-50"
              >
                <input type="radio" name="item" value={i.id} checked={itemId === i.id} onChange={() => setItemId(i.id)} className="size-4 shrink-0 accent-ink" />
                <Thumb src={i.image} />
                <span className="min-w-0 text-sm font-semibold text-ink">
                  {i.name}
                  {i.option ? <span className="font-normal text-warm-600"> · {i.option}</span> : null}
                </span>
              </label>
            ))}
          </fieldset>
        ) : data.items[0] ? (
          <div className="flex items-center gap-3">
            <Thumb src={data.items[0].image} />
            <span className="min-w-0 text-sm font-semibold text-ink">
              {data.items[0].name}
              {data.items[0].option ? <span className="font-normal text-warm-600"> · {data.items[0].option}</span> : null}
            </span>
          </div>
        ) : null}
      </section>

      {data.reward ? (
        <div className="lg:col-start-2">
          <RewardCard reward={data.reward} />
        </div>
      ) : null}

      <div className="flex flex-col gap-4 lg:col-start-1 lg:row-span-4 lg:row-start-1">
      <section aria-label={t("title")} className="flex flex-col rounded-2xl border border-warm-200 bg-white">
        <ol aria-live="polite" className="flex max-h-[65vh] min-h-72 flex-col gap-4 overflow-y-auto p-4">
          {!messages.length && !sent ? (
            <li className="m-auto flex flex-col items-center gap-2 py-6 text-center text-sm text-warm-600">
              <Headset className="size-8 text-warm-500" aria-hidden="true" />
              {t("placeholder")}
            </li>
          ) : null}
          {messages.map((m) => (
            <Bubble key={m.id} m={m} label={label(m.role)} />
          ))}
          {sent ? <Bubble m={{ role: "customer", text: sent }} label={t("you")} /> : null}
          {pending && sent && active?.status !== "ESCALATED" ? (
            <li className="flex items-center gap-2 text-sm text-warm-600">
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              {t("thinking")}
            </li>
          ) : null}
          <div ref={end} />
        </ol>

        {active?.status === "ESCALATED" ? (
          // A notice from the shop, not a chat message: on ink, with the team's icon.
          <div role="status" className="mx-4 mb-3 flex items-start gap-3 rounded-xl bg-ink p-4 text-white">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-yellow-500 text-ink">
              <Headset className="size-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-sm font-bold">{t("escalatedTitle")}</span>
              <span className="mt-0.5 block text-sm text-warm-300">{t("escalated")}</span>
            </span>
          </div>
        ) : null}
        {solvedNow && !active ? (
          <p className="mx-4 mb-3 flex items-center gap-2 rounded-lg bg-success-soft p-3 text-sm font-medium text-success">
            <CircleCheck className="size-4 shrink-0" aria-hidden="true" />
            {t("solvedDone")}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="mx-4 mb-3 flex items-center gap-2 rounded-lg bg-danger-soft p-3 text-sm font-medium text-danger">
            <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
            {t(`errors.${error}` as "errors.send")}
          </p>
        ) : null}

        <form
          className="flex items-end gap-2 border-t border-warm-200 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <label htmlFor="support-text" className="sr-only">
            {t("placeholder")}
          </label>
          <textarea
            id="support-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            maxLength={MAX_MESSAGE_LENGTH}
            rows={2}
            placeholder={t("placeholder")}
            className="min-h-12 flex-1 resize-none rounded-lg border border-warm-200 bg-warm-100 px-3 py-2.5 text-base text-warm-800 placeholder:text-warm-400 hover:border-warm-300"
          />
          <button type="submit" disabled={pending || !text.trim()} className={buttonClass({ size: "icon" })} aria-label={t("send")} title={t("send")}>
            {pending ? <LoaderCircle className="size-5 animate-spin" aria-hidden="true" /> : <SendHorizontal className="size-5 rtl:-scale-x-100" aria-hidden="true" />}
          </button>
        </form>
      </section>

      {active && active.messages.some((m) => m.role !== "customer") ? (
        <div className="flex flex-col gap-3 rounded-xl border border-success/30 bg-success-soft p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-ink">{t("solvedAsk")}</p>
          <button type="button" onClick={solved} disabled={pending} className={buttonClass({ variant: "dark", className: "shrink-0" })}>
            <CircleCheck className="size-5 text-yellow-500" aria-hidden="true" />
            {t("solved")}
          </button>
        </div>
      ) : null}
      <p className="text-xs text-warm-500">{t("note")}</p>
      </div>

      {past.length ? (
        <section aria-labelledby="support-history" className="rounded-2xl border border-warm-200 bg-white p-4 lg:col-start-2">
          <h2 id="support-history" className="mb-3 text-sm text-ink">
            {t("history")}
          </h2>
          <ul className="flex flex-col gap-2">
            {past.map((tk) => (
              <li key={tk.id}>
                <details className="group rounded-xl bg-warm-50 ring-1 ring-warm-200">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-3">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-ink">{tk.productName}</span>
                      <span className="block text-xs text-warm-600">{dateFmt.format(new Date(tk.createdAt))}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <Badge tone={STATUS_TONE[tk.status]}>{t(`status.${tk.status}`)}</Badge>
                      <ChevronDown className="size-4 text-warm-600 transition-transform group-open:rotate-180" aria-hidden="true" />
                    </span>
                  </summary>
                  <ol className="flex flex-col gap-3 border-t border-warm-200 p-3">
                    {tk.messages.map((m) => (
                      <Bubble key={m.id} m={m} label={label(m.role)} />
                    ))}
                  </ol>
                </details>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      </div>
    </div>
  );
}
