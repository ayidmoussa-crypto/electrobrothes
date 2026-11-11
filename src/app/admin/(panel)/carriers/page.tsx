import { CircleAlert, Plus, Truck } from "lucide-react";
import { deleteCarrier, renewWebhook, saveCarrier } from "@/app/actions/admin-carriers";
import { ActionForm } from "@/components/admin/ActionForm";
import { CarrierLogo } from "@/components/admin/CarrierLogo";
import { CopyLink } from "@/components/admin/CopyLink";
import { LogoField } from "@/components/admin/LogoField";
import { cloudinaryConfigured } from "@/lib/cloudinary";
import { inputClass, L, PageHeader, Panel } from "@/components/admin/ui";
import { Badge } from "@/components/ui/Badge";
import { requireAdmin } from "@/lib/admin";
import { adminTr, type Tr } from "@/lib/admin-lang";
import { adminLocale, type AdminLang } from "@/lib/admin-tr";
import { decryptCredentials, savedFields } from "@/lib/carrier/secrets";
import { CARRIER_LABEL, CARRIER_STATUSES, isCarrierStatus } from "@/lib/carrier/status";
import { db } from "@/lib/db";
import { siteUrl } from "@/lib/seo";
import { TIME_ZONE } from "@/lib/time";

type CarrierRow = Awaited<ReturnType<typeof db.carrier.findMany>>[number];

/** The add / edit form. Saved secrets are never sent back: the page only says which ones are saved. */
function CarrierForm({ c, tr, lang, uploads }: { c?: CarrierRow; tr: Tr; lang: AdminLang; uploads: boolean }) {
  const saved = savedFields(decryptCredentials(c?.credentials));
  const keep = tr("محفوظ · خليه خاوي باش يبقى", "Saved · leave empty to keep");
  const map = Object.entries((c?.statusMap ?? {}) as Record<string, string>);
  // Mapped names, then the names received but not mapped yet, then empty rows to add more.
  const rows = [...map.map(([from, to]) => ({ from, to })), ...(c?.unknownStatuses ?? []).filter((s) => !map.some(([f]) => f === s.toLowerCase())).map((from) => ({ from, to: "" })), ...Array.from({ length: 3 }, () => ({ from: "", to: "" }))];

  return (
    <ActionForm action={saveCarrier} submitLabel={c ? tr("حفظ", "Save") : tr("زيد الشركة", "Add company")} className="flex flex-col gap-4">
      {c ? <input type="hidden" name="id" value={c.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <L label={tr("سمية الشركة", "Company name")}>
          <input name="name" required maxLength={60} defaultValue={c?.name} placeholder="Ozon Express" className={inputClass} />
        </L>
        <L label={tr("صفحة التتبع ديالهم ({tracking} = رقم الطرد)", "Their tracking page ({tracking} = parcel number)")}>
          <input name="trackingUrl" type="url" dir="ltr" defaultValue={c?.trackingUrl ?? ""} placeholder="https://…/suivi?code={tracking}" className={`${inputClass} text-start`} />
        </L>
        <L label={tr("اللوغو (كيبان حدا الطلبات اللي خرجو معاها)", "Logo (shown next to the orders it carries)")} className="sm:col-span-2">
          <LogoField name={c?.name ?? ""} initial={c?.logoUrl ?? null} uploadsEnabled={uploads} />
        </L>
      </div>

      <fieldset className="rounded-xl border border-warm-200 p-3">
        <legend className="px-1 text-sm font-bold text-ink">{tr("الولوج للـ API ديالهم", "Their API access")}</legend>
        <p className="mb-3 text-xs text-warm-600">{tr("عمّر غير اللي عطاتك الشركة. كيتخزنو مشفّرين، وما كيبانوش من بعد.", "Fill in only what the company gave you. They are stored encrypted and never shown again.")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <L label={tr("رابط الـ API", "API address")} className="sm:col-span-2">
            <input name="apiBaseUrl" type="url" dir="ltr" defaultValue={c?.apiBaseUrl ?? ""} placeholder="https://api.…" className={`${inputClass} text-start`} />
          </L>
          <L label="API key / token">
            <input name="apiKey" type="password" autoComplete="new-password" dir="ltr" placeholder={saved.apiKey ? keep : ""} className={`${inputClass} text-start`} />
          </L>
          <L label={tr("اسم المستخدم", "Login")}>
            <input name="login" autoComplete="off" dir="ltr" placeholder={saved.login ? keep : ""} className={`${inputClass} text-start`} />
          </L>
          <L label={tr("كلمة السر", "Password")}>
            <input name="password" type="password" autoComplete="new-password" dir="ltr" placeholder={saved.password ? keep : ""} className={`${inputClass} text-start`} />
          </L>
        </div>
      </fieldset>

      <fieldset className="rounded-xl border border-warm-200 p-3">
        <legend className="px-1 text-sm font-bold text-ink">{tr("شنو كتصيفط الشركة", "What the company sends")}</legend>
        <p className="mb-3 text-xs text-warm-600">
          {tr("فين كاين رقم الطرد والحالة فالرسالة ديالهم (كتلقاه فالوثائق ديال الـ API). مثال:", "Where the parcel number and status sit in their message (see their API documents). Example:")}{" "}
          <span dir="ltr" className="font-mono">data.status</span>
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <L label={tr("خانة رقم الطرد", "Parcel number field")}>
            <input name="trackingField" required dir="ltr" defaultValue={c?.trackingField ?? "tracking"} className={`${inputClass} text-start font-mono`} />
          </L>
          <L label={tr("خانة الحالة", "Status field")}>
            <input name="statusField" required dir="ltr" defaultValue={c?.statusField ?? "status"} className={`${inputClass} text-start font-mono`} />
          </L>
          <L label={tr("خانة الملاحظة (اختياري)", "Note field (optional)")}>
            <input name="noteField" dir="ltr" defaultValue={c?.noteField ?? ""} className={`${inputClass} text-start font-mono`} />
          </L>
        </div>

        <h3 className="mt-4 text-sm font-bold text-ink">{tr("الحالات ديالهم ← الحالات ديالنا", "Their statuses → ours")}</h3>
        <p className="mb-2 text-xs text-warm-600">{tr("كتب الحالة كيف كتجي منهم (مثال: Livré) واختار شنو كتعني عندنا. الحالة اللي ما مربوطاش كتبان هنا باش تربطها.", "Type the status as they send it (e.g. Livré) and pick what it means here. A status not mapped yet shows up here so you can map it.")}</p>
        <ul className="flex flex-col gap-2">
          {rows.map((r, i) => (
            <li key={i} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <input name="mapFrom" defaultValue={r.from} dir="auto" aria-label={tr("الحالة ديالهم", "Their status")} className={inputClass} />
              <span aria-hidden="true" className="text-warm-500">
                {lang === "ar" ? "←" : "→"}
              </span>
              <select name="mapTo" defaultValue={r.to} aria-label={tr("الحالة ديالنا", "Our status")} className={inputClass}>
                <option value="">—</option>
                {CARRIER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {CARRIER_LABEL[s][lang]}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      </fieldset>

      <div className="flex flex-wrap gap-4">
        <label className="flex min-h-11 items-center gap-2 text-sm text-warm-800">
          <input type="checkbox" name="isActive" defaultChecked={c?.isActive ?? true} className="size-5 accent-ink" />
          {tr("خدامة", "Active")}
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm text-warm-800">
          <input type="checkbox" name="isDefault" defaultChecked={c?.isDefault ?? false} className="size-5 accent-ink" />
          {tr("الشركة الافتراضية للطلبات الجديدة", "Default company for new shipments")}
        </label>
      </div>
    </ActionForm>
  );
}

export default async function CarriersPage() {
  const [, { tr, lang }] = await Promise.all([requireAdmin(), adminTr()]);
  const carriers = await db.carrier.findMany({ orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] });
  const when = new Intl.DateTimeFormat(adminLocale(lang), { dateStyle: "medium", timeStyle: "short", timeZone: TIME_ZONE });
  const hook = (token: string) => `${siteUrl()}/api/webhooks/carrier/${token}`;
  const uploads = cloudinaryConfigured();

  return (
    <>
      <PageHeader
        title={tr("شركات التوصيل", "Delivery companies")}
        description={tr("زيد أي شركة كتخدم معاها، باش تبدّل الحالة ديال الطلبات بوحدها ملي كيتحرك الطرد.", "Add any company you work with, so orders update on their own as parcels move.")}
      />

      <Panel className="mb-6">
        <h2 className="mb-2 flex items-center gap-2 text-base">
          <Truck className="size-5" aria-hidden="true" />
          {tr("كيفاش كيخدم التتبع الفوري", "How live tracking works")}
        </h2>
        <ol className="list-decimal space-y-1 ps-5 text-sm text-warm-800">
          <li>{tr("زيد الشركة هنا، وعمّر الولوج اللي عطاوك.", "Add the company here with the access they gave you.")}</li>
          <li>{tr("نسخ «رابط الاستقبال» وعطيه للشركة (كيسميوه webhook ولا callback URL).", "Copy the “receiving link” and give it to the company (they call it a webhook or callback URL).")}</li>
          <li>{tr("ملي يتحرك الطرد، الشركة كتصيفط لهاد الرابط، والطلب كيتبدل بوحدو: الحالة، المخزون، ورسائل واتساب.", "When a parcel moves, the company calls this link and the order updates itself: status, stock and WhatsApp messages.")}</li>
          <li>{tr("ربط الحالات ديالهم بالحالات ديالنا. أي حالة جديدة كتبان ليك باش تربطها.", "Map their statuses to ours. Any new status shows up for you to map.")}</li>
        </ol>
        <p className="mt-2 text-xs text-warm-600">{tr("رقم التتبع خاصو يكون مكتوب فالطلب باش نعرفو أي طلب هذا.", "The tracking number must be on the order so the parcel can be matched to it.")}</p>
      </Panel>

      <div className="flex flex-col gap-6">
        {carriers.map((c) => (
          <Panel key={c.id}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <CarrierLogo name={c.name} logoUrl={c.logoUrl} className="size-10" />
              <h2 className="text-lg">{c.name}</h2>
              {c.isDefault ? <Badge tone="accent">{tr("الافتراضية", "Default")}</Badge> : null}
              <Badge tone={c.isActive ? "success" : "neutral"}>{c.isActive ? tr("خدامة", "Active") : tr("متوقفة", "Off")}</Badge>
            </div>

            <CopyLink label={tr("رابط الاستقبال (عطيه للشركة)", "Receiving link (give it to the company)")} url={hook(c.webhookToken)} />
            <p className="mt-2 text-xs text-warm-600">
              {c.lastEventAt ? tr(`آخر تحديث وصل: ${when.format(c.lastEventAt)}`, `Last update received: ${when.format(c.lastEventAt)}`) : tr("مازال ما وصل حتى تحديث من هاد الشركة.", "No update received from this company yet.")}
            </p>
            {c.lastError ? (
              <p role="alert" className="mt-2 flex items-start gap-2 rounded-lg bg-warning-soft p-2.5 text-xs font-semibold text-warning-text">
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  {c.lastError.split("\n").map((line) => {
                    const [tracking, reason, status] = line.split("|");
                    const step = status && isCarrierStatus(status) ? CARRIER_LABEL[status][lang] : status;
                    return (
                      <span key={line} className="block">
                        <bdi dir="ltr">{tracking}</bdi>:{" "}
                        {reason === "no_order"
                          ? tr("ما كاين حتى طلب بهاد رقم التتبع.", "no order has this tracking number.")
                          : tr(`«${step}» ما كتناسبش الحالة ديال الطلب.`, `“${step}” does not fit the order's status.`)}
                      </span>
                    );
                  })}
                </span>
              </p>
            ) : null}
            {c.unknownStatuses.length ? (
              <p className="mt-2 rounded-lg bg-yellow-50 p-2.5 text-xs text-yellow-900">
                {tr("حالات وصلات وما مربوطاش:", "Statuses received but not mapped:")} <b dir="auto">{c.unknownStatuses.join(" · ")}</b>
              </p>
            ) : null}

            <details className="mt-4 rounded-xl border border-warm-200 bg-white/50 p-3" open={!c.lastEventAt && !c.credentials}>
              <summary className="cursor-pointer text-sm font-bold text-ink">{tr("تعديل الإعدادات", "Edit settings")}</summary>
              <div className="mt-3">
                <CarrierForm c={c} tr={tr} lang={lang} uploads={uploads} />
              </div>
            </details>

            <div className="mt-4 flex flex-wrap gap-2 border-t border-warm-200 pt-3">
              <ActionForm action={renewWebhook} submitLabel={tr("بدّل رابط الاستقبال", "Replace receiving link")} variant="outline" confirm={tr("الرابط القديم غادي يوقف دغيا. بدّلو؟", "The old link stops working at once. Replace it?")}>
                <input type="hidden" name="id" value={c.id} />
              </ActionForm>
              <ActionForm action={deleteCarrier} submitLabel={tr("حيد الشركة", "Remove company")} variant="ghost" confirm={tr(`نحيدو ${c.name}؟ الطلبات وأرقام التتبع كيبقاو.`, `Remove ${c.name}? Orders and tracking numbers stay.`)}>
                <input type="hidden" name="id" value={c.id} />
              </ActionForm>
            </div>
          </Panel>
        ))}

        <Panel>
          <h2 className="mb-3 flex items-center gap-2 text-base">
            <Plus className="size-5" aria-hidden="true" />
            {tr("زيد شركة توصيل", "Add a delivery company")}
          </h2>
          <CarrierForm tr={tr} lang={lang} uploads={uploads} />
        </Panel>
      </div>
    </>
  );
}
