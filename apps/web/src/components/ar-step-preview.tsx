import { useCallback, useState } from 'react';
import { CHAPTER_SECONDS } from '../three/procedure.ts';
import { ProcedureViewer } from '../three/procedure-viewer.tsx';

const noop = () => {};

/**
 * Thumbnail that loops the step's chapter of the 3D procedure (the same animated model as
 * /bata-3d). With reduced motion it shows a still frame from the middle of the chapter.
 */
export function ArStepPreview({
  chapter,
  title,
  reducedMotion,
}: {
  chapter: number;
  title: string;
  reducedMotion: boolean;
}) {
  const start = chapter * CHAPTER_SECONDS;
  const [time, setTime] = useState(reducedMotion ? start + CHAPTER_SECONDS / 2 : start);
  const onTime = useCallback(
    (seconds: number) => {
      // The viewer only rewinds when `time` changes, so alternate two values a hair apart.
      if (seconds >= start + CHAPTER_SECONDS) setTime((t) => (t === start ? start + 0.001 : start));
    },
    [start],
  );
  return (
    <figure className="pointer-events-none overflow-hidden rounded-card bg-bg/95 shadow-float">
      <ProcedureViewer
        label={`Animación 3D del paso: ${title}`}
        className="h-40 w-32 landscape:h-32 landscape:w-28 md:h-56 md:w-44"
        time={time}
        playing={!reducedMotion}
        onTime={onTime}
        onShown={noop}
        hotspotIds={[]}
        activeHotspotId={null}
      />
      <figcaption className="px-2 py-1 text-center text-xs font-bold text-ink">
        Así se hace
      </figcaption>
    </figure>
  );
}
