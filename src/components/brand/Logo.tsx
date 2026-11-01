// Vector trace of brand/logobrand.pdf (the PDF only holds a raster image).
// Letters use currentColor so the mark works on white (text-logo-dark) and on black (text-white).
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="400 465 1090 925" className={className} aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M519 631H965L870 766H660L643 867H813L713 997H623L606 1099H856L818 1238H417Z"
      />
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M1100 631L1290 630C1420 630 1480 700 1472 785C1465 850 1420 900 1360 918C1430 940 1462 990 1453 1060C1440 1160 1350 1238 1210 1238H920L1200 874L1020 869ZM1170 759H1255C1295 759 1312 785 1306 815C1300 850 1270 869 1215 869H1153ZM1128 983H1215C1270 983 1295 1005 1285 1045C1275 1085 1245 1103 1195 1103H1110Z"
      />
      <path className="fill-logo-gold" d="M1151 479L1020 869L1200 874L815 1377L935 997H752Z" />
    </svg>
  );
}
