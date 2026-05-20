import type { Metadata } from "next";
import { AppProvider } from "@/context/AppProvider";
import { ClientShell } from "@/components/ClientShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Our Recipes",
  description: "A private recipe organizer for our kitchen",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <AppProvider>
          <ClientShell>{children}</ClientShell>
        </AppProvider>
      </body>
    </html>
  );
}