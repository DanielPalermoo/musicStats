import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "MusicStats — Tu playlist, en estadísticas",
  description: "Analiza cualquier playlist pública de YouTube Music, Spotify, Deezer o SoundCloud y conviértela en estadísticas, podios y tarjetas para compartir.",
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#09090b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body className="min-h-screen bg-zinc-950 font-sans text-zinc-100 antialiased">
        {children}
        <Toaster
          theme="dark"
          position="bottom-center"
          toastOptions={{
            className: '!bg-zinc-900/95 !border-white/10 !text-zinc-100 !rounded-xl backdrop-blur',
          }}
        />
      </body>
    </html>
  );
}
