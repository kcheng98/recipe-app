import type { Metadata } from "next";
import { AppProvider } from "@/context/AppProvider";
import { CookConfirmIntercept } from "@/components/planner/CookConfirmIntercept";
import "./globals.css";

export const metadata: Metadata = {
  title: "Our Recipes",
  description: "A private recipe organizer for our kitchen",
};

function ClientShell({ children }: { children: React.ReactNode }) {
  "use client";
  return (
    <>
      <CookConfirmIntercept />
      {children}
    </>
  );
}

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