// The shop's clock, in one place. Morocco went back to plain GMT on 2026-09-20 (decree 2.26.530).
// The time zone data in Node and Postgres can lag behind and still give "Africa/Casablanca" +01:00,
// an hour ahead, so the zone is named by its legal offset. Moroccan dates entered in forms use the same.
export const TIME_ZONE = "UTC";

/** "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm:ss" typed by an admin → the instant it means in Morocco. */
export const moroccanDate = (local: string) => new Date(`${local}${local.length <= 10 ? "T00:00:00" : ""}Z`);

/** An instant → the Moroccan "YYYY-MM-DD" (10) or "YYYY-MM-DDTHH:mm" (16) that form inputs expect. */
export const toMoroccanInput = (d: Date, length: 10 | 16) => d.toISOString().slice(0, length);
