# Aerostage patch v2

This patch is **safe** for Next.js App Router because it keeps all hooks inside **Client Components**.

## 1) Where to put the folders
Create these at the **project root** (same level as `app/`, `components/`, `lib/`):

- `hooks/`
- `components/` (already exists)

So your tree looks like:

- app/
- components/
- hooks/
- lib/

## 2) Fix hydration mismatch for countdown
**Best:** render the client-only countdown:

```tsx
import { CountdownCardClient } from "@/components/CountdownCardClient";

<CountdownCardClient targetIso="2026-01-01T00:00:00Z" />
```

If you want to keep your existing countdown markup, only wrap the changing number with:

```tsx
import { HydrationSafeText } from "@/components/HydrationSafeText";

<HydrationSafeText>{seconds}</HydrationSafeText>
```

## 3) Enable sound once, for ALL videos
Wrap your app (or page area) in `SoundProvider`:

- In `app/layout.tsx`, inside `<body>`:

```tsx
import { SoundProvider } from "@/components/SoundProvider";

<body>
  <SoundProvider>{children}</SoundProvider>
</body>
```

Then use `VideoCardSound` for your videos.

## 4) Proper vertical swipe up/down
Use the provided `VideoFeedClient` (or copy the pattern).

IMPORTANT: **Do NOT** put `useVerticalSwipe()` inside `app/page.tsx` (Server Component).
Instead, fetch data on the server and pass it down:

```tsx
// app/page.tsx (server)
import { VideoFeedClient } from "@/components/VideoFeedClient";

export default async function Page() {
  const videos = await getVideosSomehow();
  return <VideoFeedClient videos={videos} />;
}
```

## 5) Big videos too big
Wrap the video in `VideoFrame` (already used by VideoFeedClient).
