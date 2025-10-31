// app/layout.js
import "./globals.css";

export const metadata = {
  title: "Mejora Taller",
  description: "App de gestión de taller",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head />
      <body className="bg-gray-100 text-gray-800 antialiased">
        {children}
      </body>
    </html>
  );
}

