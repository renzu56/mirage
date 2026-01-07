import Link from 'next/link'
import { getEventStatus } from '@/lib/event'
import SubmitClient from '@/components/SubmitClient'

export default async function SubmitPage() {
  const { submissionsOpen, live, next } = await getEventStatus()

  if (!submissionsOpen) {
    return (
      <main className="flex h-[100svh] items-center justify-center p-6">
        <div className="aero-glass rounded-3xl p-6 max-w-md">
          <div className="text-lg font-semibold">Submissions are closed</div>
          <p className="mt-2 text-sm text-black/70">
           You can only post, when the Submission Phase is open.
          </p>
          <div className="mt-4 flex items-center gap-2">
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
              Next Event is in: {new Date(next.starts_at).toLocaleString('de-DE')}
            </p>
          ) : null}
        </div>
      </main>
    )
  }

  return <SubmitClient eventId={submissionsOpen.id} eventTitle={submissionsOpen.title} />
}
