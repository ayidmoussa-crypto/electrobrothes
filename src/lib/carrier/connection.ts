import "server-only";

// Express Relais has an API (its FAQ says so) but no public documentation, and the login is not set yet.
// Until both arrive, shipments are recorded by hand through lib/shipments.ts, the path the API will use too.
export const CARRIER_NAME = "Express Relais";
export const CARRIER_TRACKING_PAGE = "https://expressrelais.ma/suivi-de-colis/";

export const carrierHasLogin = () => Boolean(process.env.ER_BASE_URL && process.env.ER_LOGIN && process.env.ER_PASSWORD);
