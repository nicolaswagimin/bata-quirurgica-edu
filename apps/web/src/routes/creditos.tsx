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
          <li key={asset.id} className="border-b border-grid py-4 last:border-b-0">
            <h2 className="text-lg font-extrabold">{asset.title}</h2>
            <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
              <dt className="font-bold">Autor</dt>
              <dd>{asset.author}</dd>
              <dt className="font-bold">Licencia</dt>
              <dd>{asset.license}</dd>
              <dt className="font-bold">Modificaciones</dt>
              <dd>{asset.modifications || 'Sin modificaciones'}</dd>
              <dt className="font-bold">Fuente</dt>
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
