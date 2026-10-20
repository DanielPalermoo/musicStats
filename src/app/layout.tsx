import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MusicStats - Extractor & Analizador de Playlists",
  description: "Extrae y analiza estadísticas de playlists de YouTube Music y Spotify",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  );
}
