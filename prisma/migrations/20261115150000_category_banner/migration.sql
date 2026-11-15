-- Pictures chosen for each category page's banner.
ALTER TABLE "Category" ADD COLUMN "bannerImages" TEXT[] DEFAULT ARRAY[]::TEXT[];
