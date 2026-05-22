import "./globals.css";
import RegisterServiceWorker from "@/components/RegisterServiceWorker";
import ForegroundFCMListener from "@/components/ForegroundFCMListener";

export const metadata = {
  title: "Mejora Taller",
  description: "App de gestión de taller",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="bg-gray-100 text-gray-800 antialiased">
        <RegisterServiceWorker />
        <ForegroundFCMListener />
        {children}
      </body>
    </html>
  );
}
