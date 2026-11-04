import { getLocale, getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/Logo";
import { getPathname, Link } from "@/i18n/navigation";
import { getCategories } from "@/lib/catalog";
import { CartButton } from "./CartButton";
import { CategoryNav } from "./CategoryNav";
import { HeaderShell } from "./HeaderShell";
import { MobileMenu } from "./MobileMenu";
import { SearchBox, SearchToggleButton } from "./SearchBox";

export async function Header() {
  const [t, locale, categories] = await Promise.all([getTranslations("header"), getLocale(), getCategories()]);
  const navItems = categories.map((c) => ({ href: `/category/${c.slug}`, label: locale === "ar" ? c.nameAr : c.nameEn, image: c.image }));
  const otherLocale = locale === "ar" ? "en" : "ar";

  return (
    <HeaderShell>
      <div className="mx-auto flex max-w-7xl items-center gap-x-2 px-3 py-3 md:gap-x-4 md:px-4">
        {/* Phones: the menu button leads the bar (its drawer slides out from this same edge); the logo closes it. */}
        <MobileMenu items={navItems} />

        {/* The smallest phones make room for the open search by folding the logo away. */}
        <Link href="/" aria-label={t("home")} className="flex shrink-0 items-center gap-2 rounded-md max-md:order-3 group-data-[search=open]/header:max-[359px]:hidden">
          {/* Logo only: the link's aria-label carries the brand name for screen readers. */}
          <Logo className="h-10 w-auto text-white" />
        </Link>

        {/* GET form to /search (works without JS and for shopping agents) + instant suggestions. */}
        <SearchBox action={getPathname({ href: "/search", locale })} />

        {/* Phones: search icon and cart. The language switch and categories live in the side menu there. */}
        <nav className="ms-auto flex shrink-0 items-center gap-1 max-md:order-2 md:ms-0">
          <Link
            href="/"
            locale={otherLocale}
            className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-warm-300 transition-colors hover:text-yellow-500 max-md:hidden"
          >
            {t("switchLanguage")}
          </Link>
          <SearchToggleButton />
          <CartButton />
        </nav>
      </div>
      <CategoryNav items={navItems} label={t("categoriesNav")} />
    </HeaderShell>
  );
}
