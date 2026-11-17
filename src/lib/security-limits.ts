// Login limits: an email is blocked after 5 failures in 15 minutes, an IP after 10. Pure, so it is tested.
export const LOGIN_LIMITS = { email: 5, ip: 10, windowSeconds: 900 } as const;

export const overLimit = (byEmail: number, byIp: number) => byEmail > LOGIN_LIMITS.email || byIp > LOGIN_LIMITS.ip;

/** The first attempt over a limit: the counter equals limit + 1 only once per window, so the alert goes once. */
export const firstOverLimit = (byEmail: number, byIp: number) => byEmail === LOGIN_LIMITS.email + 1 || byIp === LOGIN_LIMITS.ip + 1;
