import { useEffect, useRef, useState } from 'react';
import { duration, posterUrl, VIDEOS, videoUrl } from '../lib/videos.ts';

/**
 * A teaching video: the poster stands in until the clip nears the viewport, then a native <video>
 * with controls, Spanish captions on by default and `preload="none"`, so nothing downloads until
 * the learner presses play. It never autoplays, which also keeps reduced-motion users in control.
 */
export function VideoClip({ id, className = '' }: { id: string; className?: string }) {
  const info = VIDEOS[id];
  const box = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el || near) return;
    if (!('IntersectionObserver' in window)) {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setNear(true);
      },
      { rootMargin: '300px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [near]);

  if (!info) return null;
  return (
    <figure className={`flex flex-col gap-2 ${className}`}>
      <div
        ref={box}
        className="tile-grid aspect-video overflow-hidden rounded-card bg-primary-soft"
      >
        {near ? (
          <video
            controls
            playsInline
            preload="none"
            poster={posterUrl(id)}
            width={1280}
            height={720}
            aria-label={info.title}
            className="pixelated block size-full bg-primary-soft object-contain"
          >
            <source src={videoUrl(id, 'webm')} type="video/webm" />
            <source src={videoUrl(id, 'mp4')} type="video/mp4" />
            <track kind="captions" srcLang="es" label="Español" src={videoUrl(id, 'vtt')} default />
          </video>
        ) : (
          <img
            src={posterUrl(id)}
            alt=""
            loading="lazy"
            width={1280}
            height={720}
            className="pixelated block size-full object-contain"
          />
        )}
      </div>
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
        <span className="font-bold text-ink">{info.title}</span>
        <span className="font-mono text-xs text-muted">
          {duration(info.seconds)} · subtítulos en español
        </span>
      </figcaption>
    </figure>
  );
}
