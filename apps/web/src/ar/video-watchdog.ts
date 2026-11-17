import { acquireCamera, stopTracks } from './camera-pose.ts';
import { shouldKickVideo } from './video-playback.ts';

/** Driven by the existing rAF, including when no frames reach detection. */
export function watchVideo(video: HTMLVideoElement, initialStream: MediaStream) {
  let stream = initialStream;
  let disposed = false;
  let acquiring = false;
  let lastAcquireAt = -Infinity;
  let lastKickAt = -Infinity;
  let lastAdvanceAt = performance.now();
  let lastTime = video.currentTime;
  let kicks = 0;
  let detachTrack = () => {};

  const onMediaEvent = () => tick(performance.now());
  function bindTrack() {
    detachTrack();
    const track = stream.getVideoTracks()[0];
    for (const event of ['mute', 'unmute', 'ended']) track?.addEventListener(event, onMediaEvent);
    detachTrack = () => {
      for (const event of ['mute', 'unmute', 'ended'])
        track?.removeEventListener(event, onMediaEvent);
    };
  }

  async function reacquire(now: number) {
    acquiring = true;
    lastAcquireAt = now;
    try {
      const replacement = await acquireCamera();
      if (disposed) return stopTracks(replacement);
      detachTrack();
      stopTracks(stream);
      stream = replacement;
      video.srcObject = stream;
      lastTime = video.currentTime;
      lastAdvanceAt = performance.now();
      bindTrack();
      kick(performance.now());
    } catch {
      // Retry from rAF, at most once every three seconds.
    } finally {
      acquiring = false;
    }
  }

  function kick(now: number) {
    if (now - lastKickAt < 1000) return;
    lastKickAt = now;
    kicks++;
    void video.play().catch(() => undefined);
  }

  function tick(now: number) {
    if (disposed) return;
    if (video.currentTime !== lastTime) {
      lastTime = video.currentTime;
      lastAdvanceAt = now;
    }
    const track = stream.getVideoTracks()[0];
    if (track?.readyState === 'ended') {
      if (!acquiring && now - lastAcquireAt >= 3000) void reacquire(now);
      return;
    }
    if (
      shouldKickVideo(
        {
          paused: video.paused,
          ended: video.ended,
          trackLive: track?.readyState === 'live',
          lastAdvanceAt,
          lastKickAt,
        },
        now,
      )
    )
      kick(now);
  }

  bindTrack();
  for (const event of ['pause', 'stalled', 'suspend']) video.addEventListener(event, onMediaEvent);
  return {
    tick,
    snapshot: () => ({
      paused: video.paused,
      readyState: video.readyState,
      currentTime: video.currentTime,
      trackState: stream.getVideoTracks()[0]?.readyState ?? 'sin pista',
      muted: stream.getVideoTracks()[0]?.muted ?? false,
      kicks,
    }),
    dispose() {
      disposed = true;
      detachTrack();
      for (const event of ['pause', 'stalled', 'suspend'])
        video.removeEventListener(event, onMediaEvent);
      stopTracks(stream);
    },
  };
}
