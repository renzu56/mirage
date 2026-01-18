import dynamicImport from "next/dynamic";
import { redirect } from "next/navigation";
import { getEventStatus } from "@/lib/event";
import { getFeedForEvent } from "@/lib/feed";
import { SoundProvider } from "@/components/SoundProvider";

// Next.js flag (muss "dynamic" heißen)
export const dynamic = 'force-dynamic'
export const revalidate = 0


// ✅ SSR aus für den Feed
const VideoFeedClient = dynamicImport(
  () => import("@/components/VideoFeedClient").then((m) => m.VideoFeedClient),
  { ssr: false }
);

export default async function EventPage() {
  const { live } = await getEventStatus();
  if (!live) redirect("/");

  const feed = await getFeedForEvent(live.id);

  return (
    <SoundProvider>
      <main className="min-h-screen px-4 py-6">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-xl font-semibold mb-4">{live.title}</h1>

          <VideoFeedClient
            eventId={live.id}
            videos={feed.map((item) => ({
              id: item.submission_id,
              src: item.video_url,
              title: item.display_name,
              description: item.description ?? null,
              spotifyUrl: item.spotify_url ?? null,
              soundcloudUrl: item.soundcloud_url ?? null,
              instagramUrl: item.instagram_url ?? null,
              likeCount: item.like_count ?? 0,
            }))}
          />
        </div>
      </main>
    </SoundProvider>
  );
}
