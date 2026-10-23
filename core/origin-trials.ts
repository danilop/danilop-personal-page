type OriginTrial = {
  browser: "chrome" | "edge";
  feature: string;
  token: string;
  expires: string;
};
const DAY = 86_400_000;

/** Tokens to emit: expired ones are left out so pages carry no dead tokens. */
export const activeOriginTrials = (trials: OriginTrial[], now = Date.now()) =>
  trials.filter((t) => Date.parse(t.expires) + DAY > now);

/** Build warnings for tokens that expire within 30 days or have expired. */
export function originTrialWarnings(trials: OriginTrial[], now = Date.now()) {
  return trials.flatMap((t) => {
    const days = Math.ceil((Date.parse(t.expires) + DAY - now) / DAY);
    const name = `${t.browser} ${t.feature} origin-trial token`;
    if (days <= 0) return [`${name} expired on ${t.expires}; it is omitted.`];
    if (days <= 30)
      return [`${name} expires on ${t.expires} (${days} days); renew it.`];
    return [];
  });
}
