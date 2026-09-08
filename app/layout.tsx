import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import OfflineSyncProvider from "@/components/OfflineSyncProvider";
import OfflineBanner from "@/components/OfflineBanner";

export const metadata: Metadata = {
  title: "Accountability",
  description: "Personal planning, tracking, and discipline PWA",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Accountability",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-950 pb-24 text-neutral-100 antialiased">
        <ServiceWorkerRegister />
        <OfflineSyncProvider>
          <OfflineBanner />
          <main className="mx-auto max-w-md px-4 py-4">{children}</main>
        </OfflineSyncProvider>
        <BottomNav />
      </body>
    </html>
  );
}
