const args = process.argv.slice(2);
const baseArg = args.find((arg) => arg.startsWith("--base-url="));
const baseUrl = new URL(baseArg?.slice("--base-url=".length) || process.env.LAUNCH_CHECK_URL || "https://www.amarapjy.xyz");
if (baseUrl.protocol !== "https:" && baseUrl.hostname !== "localhost" && baseUrl.hostname !== "127.0.0.1") {
  throw new Error("Launch checks require HTTPS (except for localhost).");
}

const checks = [];
function check(name, condition, detail = "") {
  checks.push({ name, passed: Boolean(condition), detail });
}

async function request(path, options = {}) {
  const response = await fetch(new URL(path, baseUrl), {
    redirect: "manual",
    signal: AbortSignal.timeout(20_000),
    ...options,
  });
  return response;
}

const publicPages = ["/", "/login", "/pricing", "/privacy", "/terms", "/content-policy", "/cancellation", "/contact", "/reset-password"];
for (const path of publicPages) {
  try {
    const response = await request(path);
    check(`Public page ${path}`, response.status === 200, `HTTP ${response.status}`);
  } catch (error) {
    check(`Public page ${path}`, false, error instanceof Error ? error.message : String(error));
  }
}

try {
  const response = await request("/chat");
  const location = response.headers.get("location") || "";
  check("Chat requires authentication", [301, 302, 303, 307, 308].includes(response.status) && new URL(location, baseUrl).pathname === "/login", `HTTP ${response.status}`);
  await response.body?.cancel();
} catch (error) {
  check("Chat requires authentication", false, error instanceof Error ? error.message : String(error));
}

try {
  const response = await request("/api/account/export");
  check("Account export requires authentication", response.status === 401, `HTTP ${response.status}`);
  await response.body?.cancel();
} catch (error) {
  check("Account export requires authentication", false, error instanceof Error ? error.message : String(error));
}

try {
  const response = await request("/robots.txt");
  const body = await response.text();
  check("Robots discovery", response.status === 200 && body.includes("Sitemap:") && body.includes("Disallow: /admin"), `HTTP ${response.status}`);
} catch (error) {
  check("Robots discovery", false, error instanceof Error ? error.message : String(error));
}

try {
  const response = await request("/sitemap.xml");
  const body = await response.text();
  check("Sitemap discovery", response.status === 200 && body.includes("<urlset") && body.includes("/pricing"), `HTTP ${response.status}`);
} catch (error) {
  check("Sitemap discovery", false, error instanceof Error ? error.message : String(error));
}

try {
  const response = await request("/opengraph-image");
  check("Social sharing image", response.status === 200 && response.headers.get("content-type")?.startsWith("image/png"), `HTTP ${response.status}`);
  await response.body?.cancel();
} catch (error) {
  check("Social sharing image", false, error instanceof Error ? error.message : String(error));
}

try {
  const response = await request("/");
  const headers = response.headers;
  check("MIME sniffing protection", headers.get("x-content-type-options") === "nosniff");
  check("Clickjacking protection", headers.get("x-frame-options") === "DENY" && headers.get("content-security-policy")?.includes("frame-ancestors 'none'"));
  check("Referrer policy", headers.get("referrer-policy") === "strict-origin-when-cross-origin");
  await response.body?.cancel();
} catch (error) {
  check("Security headers", false, error instanceof Error ? error.message : String(error));
}

for (const { name, passed, detail } of checks) {
  console.log(`${passed ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}
const failed = checks.filter(({ passed }) => !passed).length;
console.log(`\n${checks.length - failed}/${checks.length} launch checks passed for ${baseUrl.origin}`);
// Undici keep-alive sockets must not keep this one-shot CLI alive on Windows.
process.exit(failed ? 1 : 0);
