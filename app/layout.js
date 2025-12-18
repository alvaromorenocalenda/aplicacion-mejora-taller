// app/layout.js
import "./globals.css";
import RegisterServiceWorker from "@/components/RegisterServiceWorker";

export const metadata = {
  title: "Mejora Taller",
  description: "App de gestión de taller",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head />
      <body className="bg-gray-100 text-gray-800 antialiased">
        <RegisterServiceWorker />
        {children}
      </body>
    </html>
  );
}

