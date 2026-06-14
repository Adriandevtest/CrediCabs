import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import MobileNav from "@/components/MobileNav";
import { BackPrevention } from "@/components/BackPrevention";
import { cn } from "@/lib/utils";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Credi Cab's",
  description: "Sistema de gestión de créditos",
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={cn("h-full", "antialiased", geistSans.variable, geistMono.variable, "font-sans", inter.variable)}
    >
      <head>
        <link 
          rel="stylesheet" 
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" 
        />
      </head>
      {/* Ajustes clave:
        1. h-screen en lugar de h-full para forzar el alto de la ventana
        2. overflow-hidden en el body para evitar que nada se salga horizontalmente
      */}
      <body className="h-screen flex flex-col bg-gray-950 overflow-hidden" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <BackPrevention />
        <main className="flex-grow overflow-y-auto md:pb-0 w-full" style={{ paddingBottom: 'max(6rem, calc(5rem + env(safe-area-inset-bottom, 0px)))' }}>
          {children}
        </main>
        <MobileNav />
      </body>
    </html>
  );
}