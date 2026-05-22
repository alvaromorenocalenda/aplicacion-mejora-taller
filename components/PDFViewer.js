// components/PDFViewer.js
"use client";

import { useEffect, useRef } from "react";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";

// Apunta al worker en un CDN para evitar importarlo en la build
GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@3.4.120/build/pdf.worker.min.js`;

export default function PDFViewer({ url, scale = 1.0 }) {
  const canvasRef = useRef();

  useEffect(() => {
    let cancelled = false;

    async function renderPage() {
      const loadingTask = getDocument(url);
      const pdf = await loadingTask.promise;
      if (cancelled) return;

      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const ctx = canvas.getContext("2d");
      await page.render({ canvasContext: ctx, viewport }).promise;
    }

    renderPage();

    return () => {
      cancelled = true;
    };
  }, [url, scale]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", objectFit: "contain" }}
    />
  );
}
