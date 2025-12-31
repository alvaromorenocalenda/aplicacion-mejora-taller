"use client";

import { useEffect, useState } from "react";

export default function EnableNotificationSound() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("notif_sound_enabled");
    setEnabled(saved === "1");
  }, []);

  const enable = async () => {
    try {
      // “Desbloquea” audio en móviles/tablets (necesita gesto del usuario)
      const audio = new Audio("/sounds/notify.mp3");
      audio.volume = 1;
      await audio.play();
      audio.pause();
      audio.currentTime = 0;

      localStorage.setItem("notif_sound_enabled", "1");
      setEnabled(true);
      alert("✅ Sonido activado. A partir de ahora sonará cuando estés dentro.");
    } catch (e) {
      console.error(e);
      alert(
        "No se pudo activar el sonido. Revisa que exista /public/sounds/notify.mp3 y que el navegador permita sonido."
      );
    }
  };

  const disable = () => {
    localStorage.setItem("notif_sound_enabled", "0");
    setEnabled(false);
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: 14,
        right: 14,
        zIndex: 9999,
        background: "white",
        borderRadius: 12,
        padding: "10px 12px",
        boxShadow: "0 10px 25px rgba(0,0,0,0.12)",
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontSize: 14,
      }}
    >
      <span style={{ fontWeight: 600 }}>Sonido</span>

      {!enabled ? (
        <button
          onClick={enable}
          style={{
            background: "#ec4899",
            color: "white",
            border: "none",
            borderRadius: 10,
            padding: "8px 10px",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          Activar
        </button>
      ) : (
        <button
          onClick={disable}
          style={{
            background: "#111827",
            color: "white",
            border: "none",
            borderRadius: 10,
            padding: "8px 10px",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          Desactivar
        </button>
      )}
    </div>
  );
}
