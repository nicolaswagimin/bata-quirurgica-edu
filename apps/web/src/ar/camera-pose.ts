// Opens the front camera and loads the pose model in parallel. Frames stay on the device: the
// stream only feeds a <video> element that the in-browser model reads.

import { type PoseDelegate, preferredDelegate } from './pose.ts';
import { createPoseDetector, type PoseDetector } from './pose-detector.ts';

export type BootResult =
  | { kind: 'ready'; stream: MediaStream; detector: PoseDetector; delegate: PoseDelegate }
  | { kind: 'camera-error' }
  | { kind: 'model-error'; stream: MediaStream }
  | { kind: 'cancelled' };

/** Shared constraints for initial capture and recovery. */
export function acquireCamera(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: 'user',
      width: { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: 30, max: 30 },
    },
    audio: false,
  });
}

export async function bootCameraAndPose(
  video: HTMLVideoElement,
  isCancelled: () => boolean,
): Promise<BootResult> {
  const cameraPromise = acquireCamera();
  const modelPromise = createPoseDetector(
    preferredDelegate({
      userAgent: navigator.userAgent,
      maxTouchPoints: navigator.maxTouchPoints,
      search: window.location.search,
    }),
  );
  modelPromise.catch(() => undefined); // the camera may fail first
  let stream: MediaStream;
  try {
    stream = await cameraPromise;
  } catch {
    modelPromise.then((detector) => detector.close()).catch(() => undefined);
    return { kind: isCancelled() ? 'cancelled' : 'camera-error' };
  }
  if (isCancelled()) {
    modelPromise.then((detector) => detector.close()).catch(() => undefined);
    stopTracks(stream);
    return { kind: 'cancelled' };
  }
  video.srcObject = stream;
  await video.play().catch(() => undefined);
  try {
    const detector = await modelPromise;
    if (isCancelled()) {
      detector.close();
      stopTracks(stream);
      return { kind: 'cancelled' };
    }
    return { kind: 'ready', stream, detector, delegate: detector.delegate };
  } catch {
    if (isCancelled()) {
      stopTracks(stream);
      return { kind: 'cancelled' };
    }
    return { kind: 'model-error', stream };
  }
}

export function stopTracks(stream: MediaStream | null) {
  for (const track of stream?.getTracks() ?? []) track.stop();
}
