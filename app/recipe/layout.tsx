import type { Metadata } from "next";
import { AppProvider } from "@/context/AppProvider";
import { ClientShell } from "@/components/ClientShell";

export const metadata: Metadata = {
  title: "Kitchen",
  description: "A private recipe organizer for our kitchen",
};

export default function RecipeLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AppProvider>
      <ClientShell>{children}</ClientShell>
    </AppProvider>
  );
}
