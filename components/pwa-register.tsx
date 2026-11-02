"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Development must stay network-first and free of stale offline assets.
    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistration("/").then((registration) => {
        if (!registration) return;
        const workers = [registration.active, registration.waiting, registration.installing];
        const isAmaraWorker = workers.some((worker) => worker?.scriptURL === `${window.location.origin}/sw.js`);
        if (isAmaraWorker) void registration.unregister().catch(() => {});
      }).catch(() => {});
      return;
    }

    let registration: ServiceWorkerRegistration | undefined;

    const register = async () => {
      try {
        registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        // Check for a new worker without reloading or interrupting an active chat.
        await registration.update();
      } catch {
        // PWA support is optional; the online app remains fully functional.
      }
    };

    const onPageShow = () => {
      void registration?.update().catch(() => {});
    };

    if (document.readyState === "complete") {
      void register();
    } else {
      window.addEventListener("load", register, { once: true });
    }
    window.addEventListener("pageshow", onPageShow);

    return () => {
      window.removeEventListener("load", register);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  return null;
}
