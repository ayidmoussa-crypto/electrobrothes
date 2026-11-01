/* eslint-disable no-restricted-syntax -- next/og renders outside the browser: CSS variables are unavailable, so the brand tokens are inlined. */
import { ImageResponse } from "next/og";

// Default share image for every page (product pages override it with the product photo).
export const alt = "ElectroBrothers — Genuine electronics, cash on delivery in Morocco";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "#111111", color: "#FFFFFF" }}>
        <svg width="220" height="187" viewBox="400 465 1090 925">
          <path fill="#FFFFFF" d="M519 631H965L870 766H660L643 867H813L713 997H623L606 1099H856L818 1238H417Z" />
          <path
            fill="#FFFFFF"
            fillRule="evenodd"
            d="M1100 631L1290 630C1420 630 1480 700 1472 785C1465 850 1420 900 1360 918C1430 940 1462 990 1453 1060C1440 1160 1350 1238 1210 1238H920L1200 874L1020 869ZM1170 759H1255C1295 759 1312 785 1306 815C1300 850 1270 869 1215 869H1153ZM1128 983H1215C1270 983 1295 1005 1285 1045C1275 1085 1245 1103 1195 1103H1110Z"
          />
          <path fill="#F1BC2A" d="M1151 479L1020 869L1200 874L815 1377L935 997H752Z" />
        </svg>
        <div style={{ marginTop: 40, fontSize: 84, fontWeight: 800, letterSpacing: -2 }}>ElectroBrothers</div>
        <div style={{ marginTop: 16, fontSize: 40, color: "#C9C5BC" }}>Genuine electronics · Cash on delivery in Morocco</div>
        <div style={{ marginTop: 40, display: "flex" }}>
          <div style={{ background: "#FFD000", color: "#111111", fontSize: 32, fontWeight: 700, padding: "14px 28px", borderRadius: 12 }}>Order now, pay at the door</div>
        </div>
      </div>
    ),
    size,
  );
}
