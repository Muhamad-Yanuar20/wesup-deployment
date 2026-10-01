import type { Metadata } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
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

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  display: "swap",
  // Optical sizing, not a weight pin. Newsreader is a variable font with an
  // opsz axis, and the hero headlines sit large while the same family sets
  // 0.9375rem body copy lower down. One static weight cannot serve both: pinned,
  // the big headlines render with the hairlines and open apertures of the text
  // cut and the hero reads thin. The browser then picks the correct optical
  // design per size, with the display cut at the large sizes.
  axes: ["opsz"],
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
      className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <NavigationSessionProvider initialAccessState={initialAccessState}>
          <ToastProvider>{children}</ToastProvider>
        </NavigationSessionProvider>
      </body>
    </html>
  );
}
