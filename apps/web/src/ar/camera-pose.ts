// Opens the front camera and loads the pose model in parallel. Frames stay on the device: the
// stream only feeds a <video> element that the in-browser model reads.
import type { PoseLandmarker } from '@mediapipe/tasks-vision';
import { createPoseLandmarker, type PoseDelegate } from './pose.ts';

export type BootResult =
  | { kind: 'ready'; stream: MediaStream; landmarker: PoseLandmarker; delegate: PoseDelegate }
  | { kind: 'camera-error' }
  | { kind: 'model-error'; stream: MediaStream }
  | { kind: 'cancelled' };

export async function bootCameraAndPose(
  video: HTMLVideoElement,
  isCancelled: () => boolean,
): Promise<BootResult> {
  const cameraPromise = navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user' },
    audio: false,
  });
  const modelPromise = createPoseLandmarker();
  modelPromise.catch(() => undefined); // the camera may fail first
  let stream: MediaStream;
  try {
    stream = await cameraPromise;
  } catch {
    modelPromise.then(({ landmarker }) => landmarker.close()).catch(() => undefined);
    return { kind: 'camera-error' };
  }
  if (isCancelled()) {
    stopTracks(stream);
    return { kind: 'cancelled' };
  }
  video.srcObject = stream;
  await video.play().catch(() => undefined);
  try {
    const { landmarker, delegate } = await modelPromise;
    if (isCancelled()) {
      landmarker.close();
      stopTracks(stream);
      return { kind: 'cancelled' };
    }
    return { kind: 'ready', stream, landmarker, delegate };
  } catch {
    return { kind: 'model-error', stream };
  }
}

export function stopTracks(stream: MediaStream | null) {
  for (const track of stream?.getTracks() ?? []) track.stop();
}
