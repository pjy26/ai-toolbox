import test from "node:test";
import assert from "node:assert/strict";
import robots from "../app/robots";
import sitemap from "../app/sitemap";

const nextConfig = require("../next.config.js");

test("public discovery includes only public pages and excludes account surfaces", () => {
  const result = robots();
  const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;
  assert.equal(rules?.userAgent, "*");
  assert.equal(rules?.allow, "/");
  const disallowed = Array.isArray(rules?.disallow) ? rules.disallow : [rules?.disallow];
  for (const path of ["/admin", "/api/", "/chat", "/settings", "/reset-password"]) {
    assert.ok(disallowed.includes(path));
  }
  const sitemapUrl = Array.isArray(result.sitemap) ? result.sitemap[0] : (result.sitemap || "");
  assert.match(sitemapUrl, /^https:\/\//);

  const entries = sitemap();
  const urls = entries.map((entry) => new URL(entry.url).pathname);
  assert.deepEqual(new Set(urls), new Set(["/", "/pricing", "/contact", "/privacy", "/terms", "/cancellation", "/content-policy"]));
  assert.equal(urls.length, new Set(urls).size);
  for (const entry of entries) {
    assert.equal(new URL(entry.url).protocol, "https:");
    assert.ok(entry.lastModified instanceof Date);
  }
});

test("every route receives baseline browser security headers", async () => {
  const [rule] = await nextConfig.headers();
  assert.equal(rule.source, "/(.*)");
  const headers = Object.fromEntries(rule.headers.map(({ key, value }: { key: string; value: string }) => [key, value]));
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.equal(headers["X-Frame-Options"], "DENY");
  assert.equal(headers["Referrer-Policy"], "strict-origin-when-cross-origin");
  assert.match(headers["Content-Security-Policy"], /frame-ancestors 'none'/);
  assert.match(headers["Permissions-Policy"], /camera=\(\)/);
});
