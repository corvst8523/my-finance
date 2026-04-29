import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "My Finance",
  description: "Fluxo de caixa pessoal com Supabase.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={cn("h-full antialiased font-sans", inter.variable)}
    >
      <body className="min-h-full bg-background text-foreground">{children}</body>
    </html>
  );
}
