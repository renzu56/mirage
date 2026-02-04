// Root landing page for the AeroStage application. This page displays the
// current event status (live, upcoming, or none) with a modern, mobile‑friendly
// design. It fetches event information on the server and uses a client
// component for the real‑time countdown. All text is in English and the
// layout adapts gracefully on mobile screens.

import Link from "next/link";
import { getEventStatus } from "@/lib/event";
import CountdownCard from "@/components/CountdownCard";
export const dynamic = "force-dynamic";
export const revalidate = 0;


export default async function HomePage() {
  const { live, next, submissionsOpen } = await getEventStatus();

  return (
    <main className="relative flex items-center justify-center min-h-[100svh] w-full p-6">
      {/* Blurred orb background */}
      <div className="absolute inset-0 pointer-events-none opacity-35">
        <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl bg-white" />
      </div>
      <div className="relative w-full max-w-xl">
        <div className="aero-glass rounded-3xl p-6 md:p-8 flex flex-col items-center text-center w-full">
          {/* Title */}
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-black">
            Music Video Event
          </h1>
          {/* Event status and countdown */}
          {live ? (
            <div className="w-full mt-6">
              <CountdownCard title={`Now Live: ${live.title}`} targetISO={live.ends_at} />
            </div>
          ) : next ? (
            <div className="w-full mt-6">
              <CountdownCard title={`Next Event: ${next.title}`} targetISO={next.starts_at} />
            </div>
          ) : (
            <p className="mt-6 text-sm md:text-base text-black/70">
              No event scheduled. 
            </p>
          )}
          {/* Call-to-action buttons */}
          <div className="mt-6 flex gap-2 flex-wrap justify-center">
            {submissionsOpen && (
              <Link
                href="/submit"
                className="aero-btn rounded-2xl px-4 py-3 text-sm font-semibold"
              >
                Redeem Code &amp; Post
              </Link>
            )}
            {live && (
              <Link
                href="/event"
                className="aero-btn rounded-2xl px-4 py-3 text-sm font-semibold"
              >
                Watch Now
              </Link>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}