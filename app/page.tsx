import Link from "next/link";

const APPS = [
  {
    href: "/recipe",
    label: "Kitchen",
    description: "Our recipe library and meal planner.",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0071e3" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5V4.5A2.5 2.5 0 0 1 6.5 2H20v18" />
        <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-4H6.5a2.5 2.5 0 0 0 0 5" />
        <path d="M8 7h8" />
        <path d="M8 10.5h8" />
      </svg>
    ),
    iconBg: "#e8f2fc",
    accent: "#0071e3",
  },
  {
    href: "/maintenance",
    label: "Maintenance",
    description: "Track recurring tasks around our house, car, and health.",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#248a3d" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M5.5 10v9a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-9" />
        <path d="M10 20v-6h4v6" />
      </svg>
    ),
    iconBg: "#eafaf0",
    accent: "#248a3d",
  },
];

export default function HomebasePage() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-[#f5f5f7] px-6">
      <div className="mt-16 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-[#1d1d1f]">Homebase</h1>
        <p className="mt-1 text-sm text-[#86868b]">Pick an app</p>
      </div>

      <div className="mt-10 grid w-full max-w-xl grid-cols-1 gap-5 sm:grid-cols-2">
        {APPS.map((app) => (
          <Link
            key={app.href}
            href={app.href}
            className="flex flex-col gap-4 rounded-[20px] border border-[#e5e5ea] bg-white p-7 shadow-sm transition hover:shadow-md"
          >
            <div
              className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl"
              style={{ backgroundColor: app.iconBg }}
            >
              {app.icon}
            </div>
            <div>
              <div className="text-lg font-semibold text-[#1d1d1f]">{app.label}</div>
              <div className="mt-1 text-[13px] leading-snug text-[#86868b]">{app.description}</div>
            </div>
            <div
              className="mt-auto flex items-center gap-1.5 text-[13px] font-medium"
              style={{ color: app.accent }}
            >
              Open
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={app.accent} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6 15 12 9 18" />
              </svg>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
