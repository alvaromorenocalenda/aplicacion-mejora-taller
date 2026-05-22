"use client";

import { useEffect } from "react";

export default function RegisterServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/firebase-messaging-sw.js")
        .then((reg) => console.log("✅ SW registrado:", reg.scope))
        .catch((err) => console.error("❌ Error registrando SW:", err));
    }
  }, []);

  return null;
}
