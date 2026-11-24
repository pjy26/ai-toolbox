import { timingSafeEqual } from "crypto";

function secretMatches(provided: string, expected: string): boolean {
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function authorizedJob(req: Request): {
  ok: boolean;
  configured: boolean;
} {
  const cronSecret = process.env.CRON_SECRET;
  const nightlyToken = process.env.NIGHTLY_JOB_TOKEN;
  const accepted = [cronSecret, nightlyToken].filter((value): value is string =>
    Boolean(value),
  );
  if (accepted.length === 0) return { ok: false, configured: false };

  const authorization = req.headers.get("authorization");
  const bearer = authorization?.startsWith("Bearer ")
    ? authorization.slice(7)
    : null;
  const provided = [
    bearer,
    req.headers.get("x-cron-secret"),
    req.headers.get("x-nightly-job-token"),
  ].filter((value): value is string => Boolean(value));

  return {
    ok: provided.some((value) =>
      accepted.some((secret) => secretMatches(value, secret)),
    ),
    configured: true,
  };
}
