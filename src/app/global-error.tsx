"use client";

import { useEffect } from "react";
import { fontClasses } from "./fonts";
import "./globals.css";

/**
 * The last safety net: the root layout itself failed, so this page brings its own <html> and <body>.
 * Plain markup and both languages, because nothing else (translations, menus, providers) can be trusted here.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en" className={`${fontClasses} h-full antialiased`}>
      <body className="grid min-h-full place-items-center bg-ink px-4 text-center text-white">
        <main role="alert" className="max-w-md">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-yellow-500 text-3xl text-ink" aria-hidden="true">
            ⚡
          </span>
          <h1 className="mt-6 text-2xl text-white">Something went wrong</h1>
          <p className="mt-2 text-warm-300">We could not load the site. Please try again in a moment.</p>
          <h2 className="mt-6 text-xl text-white" dir="rtl" lang="ar">
            حدث خطأ غير متوقع
          </h2>
          <p className="mt-2 text-warm-300" dir="rtl" lang="ar">
            لم نتمكن من تحميل الموقع. حاول مرة أخرى بعد لحظات.
          </p>
          {error.digest ? (
            <p className="mt-4 text-xs text-warm-400" dir="ltr">
              {error.digest}
            </p>
          ) : null}
          <button type="button" onClick={reset} className="mt-8 inline-flex min-h-12 cursor-pointer items-center justify-center rounded-full bg-yellow-500 px-8 font-bold text-ink hover:bg-yellow-600 active:bg-yellow-700 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-yellow-300">
            Try again · إعادة المحاولة
          </button>
        </main>
      </body>
    </html>
  );
}
