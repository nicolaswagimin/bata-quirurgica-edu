import { CreditsSchema } from '@bata/shared/schemas';
import creditsJson from '../../../../content/credits.json';

const credits = CreditsSchema.parse(creditsJson);

export default function CreditosPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Créditos</h1>
      <p className="text-muted">Activos 3D y multimedia usados en la plataforma y sus licencias.</p>
      <ul className="flex flex-col gap-3">
        {credits.assets.map((asset) => (
          <li key={asset.id} className="rounded-card border border-border bg-surface p-4">
            <h2 className="text-lg font-semibold">{asset.title}</h2>
            <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
              <dt className="font-semibold">Autor</dt>
              <dd>{asset.author}</dd>
              <dt className="font-semibold">Licencia</dt>
              <dd>{asset.license}</dd>
              <dt className="font-semibold">Modificaciones</dt>
              <dd>{asset.modifications || 'Sin modificaciones'}</dd>
              <dt className="font-semibold">Fuente</dt>
              <dd>
                {asset.sourceUrl ? (
                  <a
                    href={asset.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline hover:text-primary-strong"
                  >
                    {asset.sourceUrl}
                  </a>
                ) : (
                  'Creado por el proyecto'
                )}
              </dd>
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}
