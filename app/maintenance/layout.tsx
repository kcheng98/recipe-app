import type { Metadata } from "next";
import { MaintenanceProvider } from "@/context/MaintenanceProvider";
import MaintenanceConflictBanner from "@/components/maintenance/MaintenanceConflictBanner";

export const metadata: Metadata = {
  title: "Maintenance",
  description: "Track recurring tasks around the house",
};

export default function MaintenanceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <MaintenanceProvider>
      <MaintenanceConflictBanner />
      {children}
    </MaintenanceProvider>
  );
}
