import type { Metadata } from "next";
import { AppProvider } from "@/context/AppProvider";
import { ClientShell } from "@/components/ClientShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Our Recipes",
  description: "A private recipe organizer for our kitchen",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased overflow-x-hidden">
        <AppProvider>
          <ClientShell>{children}</ClientShell>
        </AppProvider>
      </body>
    </html>
  );
}