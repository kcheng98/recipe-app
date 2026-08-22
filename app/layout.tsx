import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Homebase",
  description: "Household apps — recipes, maintenance, and more",
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
        {children}
      </body>
    </html>
  );
}
