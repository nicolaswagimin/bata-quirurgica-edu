import { describe, expect, it } from 'vitest';
import { shouldKickVideo, type VideoPlaybackState } from '../../src/ar/video-playback.ts';

const playing: VideoPlaybackState = {
  paused: false,
  ended: false,
  trackLive: true,
  lastAdvanceAt: 1000,
  lastKickAt: -Infinity,
};

describe('shouldKickVideo', () => {
  it('leaves advancing playback alone', () => {
    expect(shouldKickVideo(playing, 1500)).toBe(false);
  });
  it('recovers paused or ended playback immediately', () => {
    expect(shouldKickVideo({ ...playing, paused: true }, 1000)).toBe(true);
    expect(shouldKickVideo({ ...playing, ended: true }, 1000)).toBe(true);
  });
  it('recovers a stall only after more than one second', () => {
    expect(shouldKickVideo(playing, 2000)).toBe(false);
    expect(shouldKickVideo(playing, 2001)).toBe(true);
  });
  it('throttles all recovery reasons to once per second', () => {
    for (const state of [playing, { ...playing, paused: true }, { ...playing, ended: true }]) {
      expect(shouldKickVideo({ ...state, lastKickAt: 2000 }, 2999)).toBe(false);
      expect(shouldKickVideo({ ...state, lastKickAt: 2000 }, 3000)).toBe(true);
    }
  });
  it('does not kick a missing or ended track', () => {
    expect(shouldKickVideo({ ...playing, trackLive: false, paused: true }, 5000)).toBe(false);
  });
});
