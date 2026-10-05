export function ComingSoon({ title }: { title: string }) {
  return (
    <section className="mx-auto max-w-2xl rounded-card bg-surface p-8 text-center">
      <h1 className="text-xl font-semibold text-ink">{title}</h1>
      <p className="mt-2 text-muted">Próximamente</p>
    </section>
  );
}
