import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import MobileNav from "@/components/MobileNav";
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
      <body className="h-screen flex flex-col bg-gray-950 overflow-hidden">
        
        {/* Main es el área de scroll:
          1. flex-grow: ocupa el espacio restante
          2. overflow-y-auto: permite scroll dentro de la página
          3. pb-20: espacio para que el contenido final no se tape con la nav móvil
        */}
        <main className="flex-grow overflow-y-auto pb-24 md:pb-0 w-full">
          {children}
        </main>
        
        {/* MobileNav se mantiene fijo abajo */}
        <MobileNav />
      </body>
    </html>
  );
}