import dynamicImport from "next/dynamic";
import { redirect } from "next/navigation";
import { getEventStatus } from "@/lib/event";
import { getFeedForEvent } from "@/lib/feed";
import { SoundProvider } from "@/components/SoundProvider";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const VideoFeedClient = dynamicImport(
  () => import("@/components/VideoFeedClient").then((m) => m.VideoFeedClient),
  { ssr: false }
);

export default async function EventPage() {
  const { live } = await getEventStatus();
  if (!live) redirect("/");

  const feed = await getFeedForEvent(live.id);

  const videos = feed.map((item) => ({
    id: item.submission_id,
    src: item.video_url,
    title: item.display_name,
    description: item.description ?? null,
    spotifyUrl: item.spotify_url ?? null,
    soundcloudUrl: item.soundcloud_url ?? null,
    instagramUrl: item.instagram_url ?? null,
    likeCount: item.like_count ?? 0,
  }));

  return (
    <SoundProvider>
      <main className="h-[100dvh] w-full overflow-hidden bg-black">
        <VideoFeedClient eventId={live.id} videos={videos} />
      </main>
    </SoundProvider>
  );
}
