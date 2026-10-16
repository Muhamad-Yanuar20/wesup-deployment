import type { Metadata } from "next";
import { Geist, Geist_Mono, Archivo_Black, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/GlobalToast";
import { NavigationSessionProvider } from "@/components/auth/NavigationSessionProvider";
import { getViewerAccessState } from "@/lib/auth/access-state";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const archivoBlack = Archivo_Black({
  variable: "--font-archivo-black",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Wesup — Group Buying Bahan Baku UMKM",
    template: "%s | Wesup",
  },
  description:
    "Platform pembelian kolektif bahan baku untuk UMKM Bandung. Dapatkan harga terbaik lewat sistem tier diskon & escrow aman.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialAccessState = await getViewerAccessState();
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} ${archivoBlack.variable} ${jetBrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <NavigationSessionProvider initialAccessState={initialAccessState}>
          <ToastProvider>{children}</ToastProvider>
        </NavigationSessionProvider>
      </body>
    </html>
  );
}
