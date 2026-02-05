// app/page.tsx
import Link from "next/link";
import { getEventStatus } from "@/lib/event";
import CountdownCard from "@/components/CountdownCard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  const { live, next, submissionsOpen } = await getEventStatus();

  const status = live ? "LIVE" : next ? "UPCOMING" : "NO EVENT";
  const statusStyles =
    status === "LIVE"
      ? "bg-emerald-600/10 text-emerald-800 ring-emerald-600/20"
      : status === "UPCOMING"
      ? "bg-sky-600/10 text-sky-800 ring-sky-600/20"
      : "bg-slate-600/5 text-slate-700 ring-slate-700/15";

  return (
    <main className="relative min-h-[100svh] w-full overflow-hidden px-5 py-10 flex items-center justify-center bg-gradient-to-b from-sky-100 via-white to-white">
      {/* soft sky orbs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-sky-300/35 blur-3xl" />
        <div className="absolute top-24 -left-40 h-[520px] w-[520px] rounded-full bg-cyan-200/45 blur-3xl" />
        <div className="absolute -bottom-56 right-[-180px] h-[640px] w-[640px] rounded-full bg-indigo-200/25 blur-3xl" />
      </div>

      <div className="relative w-full max-w-xl">
        <div className="rounded-[28px] border border-slate-900/10 bg-white/60 p-6 md:p-8 backdrop-blur-2xl shadow-[0_30px_100px_-55px_rgba(2,6,23,0.45)]">
          {/* top row */}
          <div className="flex items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-sky-600/70 shadow-[0_0_18px_rgba(2,132,199,0.45)]" />
              <span className="text-xs font-medium tracking-wide text-slate-700">
                Mirage
              </span>
            </div>

            <span
              className={[
                "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide ring-1",
                statusStyles,
              ].join(" ")}
            >
              {status}
            </span>
          </div>

          {/* title */}
          <h1 className="mt-4 text-center text-3xl md:text-4xl font-semibold tracking-tight text-slate-900">
            Mirage Events
          </h1>

          {/* event status + countdown */}
          {live ? (
            <div className="w-full mt-6">
              <CountdownCard title={`Now Live: ${live.title}`} targetISO={live.ends_at} />
            </div>
          ) : next ? (
            <div className="w-full mt-6">
              <CountdownCard title={`Next Event: ${next.title}`} targetISO={next.starts_at} />
            </div>
          ) : (
            <p className="mt-6 text-center text-sm md:text-base text-slate-600">
              No event scheduled.
            </p>
          )}

          {/* CTA buttons (swapped order + swapped styles) */}
          <div className="mt-7 flex flex-wrap justify-center gap-2">
            {live && (
              <Link
                href="/event"
                className="inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold
                           bg-gradient-to-r from-sky-500 to-cyan-400 text-white
                           shadow-[0_18px_60px_-35px_rgba(14,165,233,0.55)]
                           transition hover:translate-y-[-1px] hover:shadow-[0_22px_70px_-38px_rgba(14,165,233,0.65)]
                           focus:outline-none focus:ring-2 focus:ring-sky-500/40"
              >
                Watch Now
              </Link>
            )}

            {submissionsOpen && (
              <Link
                href="/submit"
                className="inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold
                           border border-slate-900/10 bg-white/70 text-slate-900
                           backdrop-blur-xl transition hover:bg-white hover:translate-y-[-1px]
                           focus:outline-none focus:ring-2 focus:ring-sky-500/35"
              >
                Redeem Code &amp; Post
              </Link>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
