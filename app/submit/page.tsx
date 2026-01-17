import Link from 'next/link'
import { getEventStatus } from '@/lib/event'
import SubmitClient from '@/components/SubmitClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function SubmitPage() {
  const { submissionsOpen, live, next } = await getEventStatus()

  if (!submissionsOpen) {
    return (
      <main className="min-h-[100dvh] w-full flex items-center justify-center p-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
        <div className="aero-glass rounded-3xl p-6 max-w-md w-full">
          <div className="text-lg font-semibold">Submissions are closed</div>
          <p className="mt-2 text-sm text-black/70">
            You can only post while the submission phase is open.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link className="aero-btn rounded-2xl px-4 py-3 text-sm font-semibold" href="/">
              Back
            </Link>
            {live ? (
              <Link className="aero-btn rounded-2xl px-4 py-3 text-sm font-semibold" href="/event">
                Watch Event
              </Link>
            ) : null}
          </div>

          {next ? (
            <p className="mt-4 text-xs text-black/60">
              Next event starts: {new Date(next.starts_at).toLocaleString('en-GB')}
            </p>
          ) : null}
        </div>
      </main>
    )
  }

  return <SubmitClient eventId={submissionsOpen.id} eventTitle={submissionsOpen.title} />
}
