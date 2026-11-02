/** Decorative streak flame; always rendered next to the streak number in text. */
export function FlameIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={`flex-none text-streak ${className}`}
      fill="currentColor"
    >
      <path d="M12 2c1 3.5-1.5 5.5-1.5 8 0 1.4 1 2.5 2.3 2.5 1.6 0 2.4-1.4 2.2-3.2C17.6 11 19 13.6 19 16a7 7 0 0 1-14 0c0-4.6 4-7.4 7-14Z" />
    </svg>
  );
}
