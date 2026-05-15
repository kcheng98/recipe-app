import type { Metadata } from "next";
import { AppProvider } from "@/context/AppProvider";
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
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
