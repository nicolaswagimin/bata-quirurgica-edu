export type VideoPlaybackState = {
  paused: boolean;
  ended: boolean;
  trackLive: boolean;
  lastAdvanceAt: number;
  lastKickAt: number;
};

export function shouldKickVideo(state: VideoPlaybackState, now: number): boolean {
  return (
    state.trackLive &&
    now - state.lastKickAt >= 1000 &&
    (state.paused || state.ended || now - state.lastAdvanceAt > 1000)
  );
}
