import type { Metadata } from "next";
import { TravelProvider } from "@/context/TravelProvider";
import TravelConflictBanner from "@/components/travel/TravelConflictBanner";

export const metadata: Metadata = {
  title: "Travel",
  description: "Every trip you take, in or out of the country",
};

export default function TravelLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <TravelProvider>
      {/* Travel gets its own fun/cute type pairing (Baloo 2 display + Nunito
          body) distinct from the rest of Homebase's Apple-system-font look —
          scoped to this layout so it doesn't leak into other modules. */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Nunito:wght@400;600;700;800&display=swap"
        rel="stylesheet"
      />
      <TravelConflictBanner />
      {children}
    </TravelProvider>
  );
}
