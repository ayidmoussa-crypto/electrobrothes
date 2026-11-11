import { ShieldCheck, ShieldOff } from "lucide-react";
import { cancel2faSetup, confirm2faSetup, disable2fa, regenerateBackupCodes, start2faSetup } from "@/app/actions/admin-2fa";
import { ActionForm } from "@/components/admin/ActionForm";
import { TwoFactorCodeForm } from "@/components/admin/TwoFactorForm";
import { inputClass, L, PageHeader, Panel } from "@/components/admin/ui";
import { Badge } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/button";
import { requireAdmin } from "@/lib/admin";
import { adminTr } from "@/lib/admin-lang";
import { adminLocale } from "@/lib/admin-tr";
import { db } from "@/lib/db";
import { TIME_ZONE } from "@/lib/time";
import { groupKey, openTotpSecret, otpauthUrl } from "@/lib/totp";

/** The owner's account: two-step login with an authenticator app (optional). */
export default async function AccountPage() {
  const [me, { tr, lang }] = await Promise.all([requireAdmin(), adminTr()]);
  const user = await db.adminUser.findUniqueOrThrow({
    where: { id: me.id },
    select: { email: true, totpSecret: true, totpEnabledAt: true, totpBackupCodes: true },
  });
  const enabled = !!user.totpEnabledAt;
  // A setup in progress: the key is shown to the owner only, on this page, until confirmed.
  const pendingKey = enabled ? null : openTotpSecret(user.totpSecret);
  const date = new Intl.DateTimeFormat(adminLocale(lang), { dateStyle: "medium", timeZone: TIME_ZONE });

  return (
    <>
      <PageHeader title={tr("الحساب ديالي", "My account")} description={user.email} />

      <Panel title={tr("التحقق بخطوتين", "Two-step login")}>
        <div className="flex flex-col gap-4">
          <p className="flex flex-wrap items-center gap-2 text-sm text-warm-800">
            {enabled ? (
              <>
                <ShieldCheck className="size-5 text-success" aria-hidden="true" />
                <Badge tone="success">{tr("مفعّل", "On")}</Badge>
                {tr(`من ${date.format(user.totpEnabledAt!)}`, `since ${date.format(user.totpEnabledAt!)}`)} ·{" "}
                {tr(`${user.totpBackupCodes.length} رموز احتياطية باقية`, `${user.totpBackupCodes.length} backup codes left`)}
              </>
            ) : (
              <>
                <ShieldOff className="size-5 text-warm-600" aria-hidden="true" />
                <Badge tone="neutral">{tr("مطفي", "Off")}</Badge>
                {tr("الدخول بكلمة السر فقط.", "Password only.")}
              </>
            )}
          </p>
          <p className="max-w-prose text-sm text-warm-600">
            {tr(
              "من بعد كلمة السر، اللوحة كتطلب رمز ديال 6 أرقام كيتبدل كل 30 ثانية فتطبيق فهاتفك (Google Authenticator ولا Microsoft Authenticator). إلا شي حد عرف كلمة السر، ما يقدرش يدخل بلا الهاتف.",
              "After the password, the panel asks for a 6-digit code that changes every 30 seconds in an app on your phone (Google Authenticator or Microsoft Authenticator). Someone who learns the password still can't get in without the phone.",
            )}
          </p>

          {enabled ? (
            <div className="grid gap-6 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <h3 className="text-base font-bold text-ink">{tr("رموز احتياطية جداد", "New backup codes")}</h3>
                <p className="text-sm text-warm-600">{tr("القدام كيوقفو كاملين.", "All the old ones stop working.")}</p>
                <TwoFactorCodeForm action={regenerateBackupCodes} submitLabel={tr("صايب رموز جداد", "Make new codes")} />
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="text-base font-bold text-ink">{tr("إطفاء التحقق بخطوتين", "Turn two-step login off")}</h3>
                <ActionForm action={disable2fa} submitLabel={tr("إطفاء", "Turn off")} variant="outline" confirm={tr("نطفيو التحقق بخطوتين؟", "Turn two-step login off?")}>
                  <L label={tr("رمز من التطبيق ولا رمز احتياطي", "A code from the app, or a backup code")}>
                    <input name="code" required autoComplete="one-time-code" maxLength={20} dir="ltr" className={`${inputClass} max-w-48 text-center tracking-widest`} />
                  </L>
                </ActionForm>
              </div>
            </div>
          ) : pendingKey ? (
            <ol className="flex max-w-prose list-decimal flex-col gap-4 ps-5 text-sm text-warm-800">
              <li>
                {tr("فهاتفك، حل تطبيق المصادقة وزيد حساب جديد.", "On your phone, open the authenticator app and add an account.")}
                <a href={otpauthUrl(pendingKey, user.email)} className="mt-2 flex w-fit text-sm font-semibold text-ink underline underline-offset-4">
                  {tr("ولا، إلا كنتي فاتح اللوحة من الهاتف: اضغط هنا", "Or, if this page is open on the phone: tap here")}
                </a>
              </li>
              <li>
                {tr("اختار «إدخال مفتاح الإعداد» وكتب هاد المفتاح (نوع: حسب الوقت):", "Choose \"Enter a setup key\" and type this key (type: time-based):")}
                <code className="mt-2 block w-fit rounded-lg bg-warm-100 px-3 py-2 font-mono text-base break-all text-ink select-all" dir="ltr">
                  {groupKey(pendingKey)}
                </code>
                <span className="mt-1 block text-xs text-warm-600">{tr("ما تعطي هاد المفتاح لحتى واحد.", "Never share this key.")}</span>
              </li>
              <li>
                {tr("كتب الرمز اللي بان فالتطبيق باش يتفعّل:", "Type the code the app shows to turn it on:")}
                <div className="mt-2">
                  <TwoFactorCodeForm action={confirm2faSetup} submitLabel={tr("تفعيل", "Turn on")} />
                </div>
              </li>
              <li className="list-none">
                <form action={cancel2faSetup}>
                  <button type="submit" className={buttonClass({ variant: "ghost" })}>
                    {tr("إلغاء", "Cancel")}
                  </button>
                </form>
              </li>
            </ol>
          ) : (
            <form action={start2faSetup}>
              <button type="submit" className={buttonClass()}>
                <ShieldCheck className="size-5" aria-hidden="true" />
                {tr("فعّل التحقق بخطوتين", "Turn on two-step login")}
              </button>
            </form>
          )}
        </div>
      </Panel>
    </>
  );
}
