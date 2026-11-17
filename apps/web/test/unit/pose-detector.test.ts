import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createWorkerDetector,
  forceMainPose,
  type PoseDetector,
  type PoseWorkerPort,
  type WorkerReply,
} from '../../src/ar/pose-detector.ts';

function setup(preferred: 'GPU' | 'CPU' = 'GPU') {
  vi.useFakeTimers();
  const workers: PoseWorkerPort[] = [];
  const makeWorker = vi.fn(() => {
    const worker: PoseWorkerPort = {
      postMessage: vi.fn(),
      terminate: vi.fn(),
      onmessage: null,
      onerror: null,
    };
    workers.push(worker);
    return worker;
  });
  const main: PoseDetector = {
    mode: 'main',
    delegate: 'CPU',
    busy: false,
    submit: vi.fn(),
    take: () => null,
    close: vi.fn(),
  };
  const mainFrom = vi.fn(async () => main);
  const bitmap = { close: vi.fn() } as unknown as ImageBitmap;
  const bitmapFrom = vi.fn(async () => bitmap);
  const promise = createWorkerDetector(preferred, makeWorker, bitmapFrom, mainFrom);
  const worker = workers[0] as PoseWorkerPort;
  const send = (data: WorkerReply, index = 0) =>
    workers[index]?.onmessage?.({ data } as MessageEvent<WorkerReply>);
  return { worker, workers, makeWorker, main, mainFrom, bitmap, bitmapFrom, promise, send };
}
const video = {} as HTMLVideoElement;
afterEach(() => vi.useRealTimers());

describe('pose detector lifecycle', () => {
  it('becomes ready, transfers one frame and consumes each result once', async () => {
    const s = setup();
    s.send({ type: 'ready', delegate: 'GPU' });
    const detector = await s.promise;
    expect(detector.mode).toBe('worker');
    detector.submit(video, 123);
    expect(detector.busy).toBe(true);
    detector.submit(video, 124);
    await Promise.resolve();
    expect(s.bitmapFrom).toHaveBeenCalledTimes(1);
    expect(s.worker.postMessage).toHaveBeenLastCalledWith(
      { type: 'frame', bitmap: s.bitmap, timestamp: 123 },
      [s.bitmap],
    );
    const result = {
      type: 'result' as const,
      landmarks: [],
      worldLandmarks: null,
      detectMs: 8,
      timestamp: 123,
    };
    s.send(result);
    expect(detector.busy).toBe(false);
    expect(detector.take()).toEqual(result);
    expect(detector.take()).toBeNull();
    detector.close();
  });
  it.each(['message', 'event', 'timeout'] as const)('falls back on init %s', async (failure) => {
    const s = setup(failure === 'timeout' ? 'CPU' : 'GPU');
    if (failure === 'message') s.send({ type: 'error', message: 'failed' });
    if (failure === 'event') s.worker.onerror?.({} as ErrorEvent);
    if (failure === 'timeout') await vi.advanceTimersByTimeAsync(20_000);
    const detector = await s.promise;
    expect(detector.mode).toBe('main');
    expect(s.mainFrom).toHaveBeenCalledWith(failure === 'timeout' ? 'CPU' : 'GPU');
    expect(s.worker.terminate).toHaveBeenCalled();
    detector.close();
  });
  it.each(['timeout', 'error'] as const)(
    'switches transparently on a session %s',
    async (failure) => {
      const s = setup();
      s.send({ type: 'ready', delegate: failure === 'timeout' ? 'CPU' : 'GPU' });
      const detector = await s.promise;
      detector.submit(video, 1);
      if (failure === 'timeout') await vi.advanceTimersByTimeAsync(5000);
      else {
        s.send({ type: 'error', message: 'lost' });
        await Promise.resolve();
      }
      expect(detector.mode).toBe('main');
      expect(detector.take()).toBeNull();
      detector.submit(video, 2);
      expect(s.main.submit).toHaveBeenCalledWith(video, 2);
      detector.close();
    },
  );
  it('reports delegate changes and clears the frame deadline only on result', async () => {
    const s = setup();
    s.send({ type: 'ready', delegate: 'GPU' });
    const detector = await s.promise;
    detector.onDelegateChange = vi.fn();
    detector.submit(video, 1);
    s.send({ type: 'delegate', delegate: 'CPU' });
    expect(detector.delegate).toBe('CPU');
    expect(detector.onDelegateChange).toHaveBeenCalledWith('CPU');
    await vi.advanceTimersByTimeAsync(5000);
    expect(detector.mode).toBe('main');
    detector.close();
  });
  it('closes a bitmap resolved after disposal without posting it', async () => {
    const s = setup();
    s.send({ type: 'ready', delegate: 'GPU' });
    const detector = await s.promise;
    detector.submit(video, 1);
    detector.close();
    await Promise.resolve();
    expect(s.bitmap.close).toHaveBeenCalled();
    expect(s.worker.postMessage).toHaveBeenCalledTimes(1);
  });
});

it('parses the QA main-thread override exactly', () => {
  expect(forceMainPose('?x=1&modoPose=main')).toBe(true);
  for (const search of ['', '?modoPose=worker', '?modoPose=MAIN', '?delegado=cpu'])
    expect(forceMainPose(search)).toBe(false);
});

it('keeps results empty during lazy fallback and closes a late replacement', async () => {
  const s = setup();
  let finish: (main: PoseDetector) => void = () => {};
  s.mainFrom.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  s.send({ type: 'ready', delegate: 'GPU' });
  const detector = await s.promise;
  s.send({ type: 'error', message: 'lost' });
  expect(detector.mode).toBe('main');
  expect(detector.busy).toBe(true);
  expect(detector.take()).toBeNull();
  detector.close();
  finish(s.main);
  await Promise.resolve();
  expect(s.main.close).toHaveBeenCalledOnce();
});

it('falls back if bitmap capture rejects', async () => {
  const s = setup();
  s.bitmapFrom.mockRejectedValueOnce(new Error('capture failed'));
  s.send({ type: 'ready', delegate: 'GPU' });
  const detector = await s.promise;
  detector.submit(video, 1);
  await vi.advanceTimersByTimeAsync(0);
  expect(detector.mode).toBe('main');
  expect(s.mainFrom).toHaveBeenCalledOnce();
  detector.close();
});

it.each(['init', 'frame'] as const)(
  'restarts a GPU worker on %s timeout with CPU',
  async (phase) => {
    const s = setup();
    let detector: PoseDetector | undefined;
    if (phase === 'frame') {
      s.send({ type: 'ready', delegate: 'GPU' });
      detector = await s.promise;
      detector.submit(video, 1);
    }
    const onDelegateChange = vi.fn();
    if (detector) detector.onDelegateChange = onDelegateChange;
    await vi.advanceTimersByTimeAsync(phase === 'init' ? 20_000 : 5000);
    expect(s.makeWorker).toHaveBeenCalledTimes(2);
    expect(s.worker.terminate).toHaveBeenCalledOnce();
    expect(s.workers[1]?.postMessage).toHaveBeenCalledWith({ type: 'init', delegate: 'CPU' });
    expect(s.mainFrom).not.toHaveBeenCalled();
    if (detector) {
      expect(detector.mode).toBe('worker');
      expect(detector.busy).toBe(true);
      expect(onDelegateChange).not.toHaveBeenCalled();
    }
    s.send({ type: 'ready', delegate: 'CPU' }, 1);
    detector = await s.promise;
    expect(detector.mode).toBe('worker');
    expect(detector.delegate).toBe('CPU');
    expect(detector.busy).toBe(false);
    if (phase === 'frame') expect(onDelegateChange).toHaveBeenCalledWith('CPU');
    detector.close();
  },
);

it.each(['timeout', 'error'] as const)(
  'falls back to main CPU after restarted worker %s',
  async (failure) => {
    const s = setup();
    await vi.advanceTimersByTimeAsync(20_000);
    if (failure === 'timeout') await vi.advanceTimersByTimeAsync(20_000);
    else s.send({ type: 'error', message: 'CPU failed' }, 1);
    const detector = await s.promise;
    expect(detector.mode).toBe('main');
    expect(s.mainFrom).toHaveBeenCalledWith('CPU');
    expect(s.makeWorker).toHaveBeenCalledTimes(2);
    detector.close();
  },
);

it('never restarts twice even if the CPU replacement reports GPU', async () => {
  const s = setup();
  await vi.advanceTimersByTimeAsync(20_000);
  s.send({ type: 'ready', delegate: 'GPU' }, 1);
  const detector = await s.promise;
  detector.submit(video, 1);
  await vi.advanceTimersByTimeAsync(5000);
  expect(s.makeWorker).toHaveBeenCalledTimes(2);
  expect(s.mainFrom).toHaveBeenCalledWith('CPU');
  expect(detector.mode).toBe('main');
  detector.close();
});

it('skipped clears busy and the frame timeout without producing a result', async () => {
  const s = setup();
  s.send({ type: 'ready', delegate: 'GPU' });
  const detector = await s.promise;
  detector.submit(video, 1);
  await Promise.resolve();
  s.send({ type: 'skipped' });
  expect(detector.busy).toBe(false);
  expect(detector.take()).toBeNull();
  await vi.advanceTimersByTimeAsync(5000);
  expect(s.makeWorker).toHaveBeenCalledTimes(1);
  expect(s.mainFrom).not.toHaveBeenCalled();
  detector.close();
});

it('ignores old worker replies and closes captures completed after a restart', async () => {
  const s = setup();
  let finish: (bitmap: ImageBitmap) => void = () => {};
  s.bitmapFrom.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  s.send({ type: 'ready', delegate: 'GPU' });
  const detector = await s.promise;
  detector.submit(video, 1);
  await vi.advanceTimersByTimeAsync(5000);
  s.send({ type: 'error', message: 'old worker' });
  finish(s.bitmap);
  await Promise.resolve();
  expect(s.bitmap.close).toHaveBeenCalledOnce();
  expect(s.mainFrom).not.toHaveBeenCalled();
  expect(detector.busy).toBe(true);
  detector.close();
});

it('uses main CPU if construction of the replacement worker fails', async () => {
  const s = setup();
  s.makeWorker.mockImplementationOnce(() => {
    throw new Error('worker unavailable');
  });
  await vi.advanceTimersByTimeAsync(20_000);
  const detector = await s.promise;
  expect(s.mainFrom).toHaveBeenCalledWith('CPU');
  expect(detector.mode).toBe('main');
  detector.close();
});

it('restarts on a fresh CPU worker when the GPU worker reports it is slow', async () => {
  const s = setup('GPU');
  s.send({ type: 'slow' });
  expect(s.worker.terminate).toHaveBeenCalled();
  expect(s.makeWorker).toHaveBeenCalledTimes(2);
  expect(s.workers[1]?.postMessage).toHaveBeenCalledWith({ type: 'init', delegate: 'CPU' });
  expect(s.mainFrom).not.toHaveBeenCalled();
  s.send({ type: 'ready', delegate: 'CPU' }, 1);
  const detector = await s.promise;
  expect(detector.mode).toBe('worker');
  expect(detector.delegate).toBe('CPU');
  expect(detector.busy).toBe(false);
});
