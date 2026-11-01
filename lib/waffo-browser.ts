"use client";

export async function openWaffoCheckout(planId: string, locale: "en" | "zh") {
  const response = await fetch("/api/pay/waffo/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ planId, locale }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Checkout is temporarily unavailable.");
  const destination = result.checkoutUrl || result.portalUrl;
  if (typeof destination !== "string") throw new Error("Checkout did not return a destination.");
  // Same-tab navigation avoids popup blockers after the asynchronous request.
  window.location.href = destination;
}

export async function openWaffoPortal() {
  const response = await fetch("/api/pay/waffo/portal", { method: "POST" });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || typeof result.portalUrl !== "string") {
    throw new Error(result.error || "The membership portal is temporarily unavailable.");
  }
  window.location.href = result.portalUrl;
}
