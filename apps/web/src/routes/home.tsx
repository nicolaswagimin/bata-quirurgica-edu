import {
  CONSENT_REQUIRED_MESSAGE,
  type CreateProfile,
  CreateProfileSchema,
  PendingConsentSchema,
  POLICY_VERSION,
  SeedMissionSchema,
} from '@bata/shared/schemas';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormField } from '../components/form-field.tsx';
import { LoadingState } from '../components/loading-state.tsx';
import { ApiError, apiFetch, type Profile, useMe } from '../lib/api.ts';
import { db, useAuth } from '../lib/firebase.tsx';

const PENDING_CONSENT_KEY = 'bata.pendingConsent';

export const MissionSchema = SeedMissionSchema.omit({ id: true }).extend({
  id: z.string(),
  questionIds: z.array(z.string()),
});
export type Mission = z.infer<typeof MissionSchema>;

const MissionProgressSchema = z.object({
  answeredCorrectIds: z.array(z.string()),
  completed: z.boolean(),
});
type MissionProgress = z.infer<typeof MissionProgressSchema>;

const primaryButtonClass =
  'min-h-11 rounded-pill bg-primary px-4 font-semibold text-bg hover:bg-primary-strong disabled:opacity-60';

function hasPendingConsent(): boolean {
  try {
    const raw = sessionStorage.getItem(PENDING_CONSENT_KEY);
    return raw !== null && PendingConsentSchema.safeParse(JSON.parse(raw)).success;
  } catch {
    return false;
  }
}

function FlameIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 text-streak" fill="currentColor">
      <path d="M12 2c1 3.5-1.5 5.5-1.5 8 0 1.4 1 2.5 2.3 2.5 1.6 0 2.4-1.4 2.2-3.2C17.6 11 19 13.6 19 16a7 7 0 0 1-14 0c0-4.6 4-7.4 7-14Z" />
    </svg>
  );
}

export function StatsBar({ profile }: { profile: Profile }) {
  return (
    <ul aria-label="Tu progreso" className="flex flex-wrap items-center gap-2 text-sm">
      <li data-testid="xp-pill" className="rounded-pill bg-xp px-3 py-1 font-semibold text-ink">
        {profile.xp} XP
      </li>
      <li className="rounded-pill bg-primary-soft px-3 py-1 font-semibold text-ink">
        Nivel {profile.level}
      </li>
      <li className="flex items-center gap-1 rounded-pill border border-border px-3 py-1">
        <FlameIcon />
        <span>
          {profile.streakDays} {profile.streakDays === 1 ? 'día' : 'días'} de racha
        </span>
      </li>
    </ul>
  );
}

type ConsentFormValues = { displayName: string; groupCode: string; consent: boolean };

function ConsentForm() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, setError, formState } = useForm<ConsentFormValues>({
    defaultValues: {
      displayName: user?.displayName ?? '',
      groupCode: '',
      consent: hasPendingConsent(),
    },
  });
  const { errors, isSubmitting } = formState;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    if (!values.consent) {
      setError('consent', { message: CONSENT_REQUIRED_MESSAGE });
      return;
    }
    const groupCode = values.groupCode.trim().toUpperCase();
    const parsed = CreateProfileSchema.safeParse({
      displayName: values.displayName,
      consent: { policyVersion: POLICY_VERSION, accepted: true },
      ...(groupCode ? { groupCode } : {}),
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        if (issue.path[0] === 'displayName') {
          setError('displayName', { message: 'Escribe un nombre de 2 a 60 caracteres' });
        } else if (issue.path[0] === 'groupCode') {
          setError('groupCode', { message: 'El código tiene 6 letras o números' });
        }
      }
      return;
    }
    try {
      await apiFetch<unknown>('/me', { method: 'POST', body: parsed.data satisfies CreateProfile });
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setError('groupCode', { message: 'No encontramos un grupo con ese código' });
        return;
      }
      if (!(error instanceof ApiError && error.status === 409)) {
        setFormError(error instanceof ApiError ? error.message : 'Ocurrió un error inesperado.');
        return;
      }
    }
    try {
      sessionStorage.removeItem(PENDING_CONSENT_KEY);
    } catch {
      // Nothing to clean up if storage is unavailable.
    }
    await queryClient.invalidateQueries({ queryKey: ['me'] });
  });

  const consentErrorId = 'perfil-consent-error';

  return (
    <section className="mx-auto flex max-w-md flex-col gap-4 rounded-card bg-surface p-6">
      <h1 className="text-xl font-semibold">Completa tu perfil</h1>
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormField
          id="perfil-nombre"
          label="Nombre visible"
          autoComplete="name"
          error={errors.displayName?.message}
          {...register('displayName')}
        />
        <FormField
          id="perfil-grupo"
          label="Código de grupo (opcional)"
          autoComplete="off"
          error={errors.groupCode?.message}
          {...register('groupCode')}
        />
        <div className="flex flex-col gap-1">
          <div className="flex items-start gap-2">
            <input
              id="perfil-consent"
              type="checkbox"
              className="mt-1 size-6 accent-primary"
              aria-invalid={errors.consent ? true : undefined}
              aria-describedby={errors.consent ? consentErrorId : undefined}
              {...register('consent')}
            />
            <label htmlFor="perfil-consent" className="text-sm">
              Acepto la{' '}
              <Link to="/privacidad" className="text-primary underline hover:text-primary-strong">
                política de tratamiento de datos personales
              </Link>{' '}
              (Ley 1581 de 2012).
            </label>
          </div>
          {errors.consent ? (
            <p id={consentErrorId} className="text-sm text-danger">
              {errors.consent.message}
            </p>
          ) : null}
        </div>
        <p role="alert" className="text-sm text-danger empty:hidden">
          {formError ?? ''}
        </p>
        <button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
          Continuar
        </button>
      </form>
    </section>
  );
}

function MissionMap({ profile }: { profile: Profile }) {
  const missions = useQuery({
    queryKey: ['missions'],
    queryFn: async () => {
      const snap = await getDocs(query(collection(db, 'missions'), orderBy('order')));
      return snap.docs.map((d) => MissionSchema.parse({ ...d.data(), id: d.id }));
    },
  });
  const progress = useQuery({
    queryKey: ['progress', profile.uid],
    queryFn: async () => {
      const snap = await getDocs(collection(db, 'progress', profile.uid, 'missions'));
      const byMission: Record<string, MissionProgress> = {};
      for (const d of snap.docs) byMission[d.id] = MissionProgressSchema.parse(d.data());
      return byMission;
    },
  });

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">Hola, {profile.displayName}</h1>
        <StatsBar profile={profile} />
      </header>
      <h2 className="text-lg font-semibold">Tus misiones</h2>
      {missions.isPending ? <LoadingState /> : null}
      {missions.isError ? (
        <p role="alert" className="text-danger">
          No pudimos cargar las misiones. Intenta de nuevo.
        </p>
      ) : null}
      <ol className="flex flex-col gap-3">
        {missions.data?.map((mission) => {
          const done = progress.data?.[mission.id];
          const correct = done?.answeredCorrectIds.length ?? 0;
          return (
            <li key={mission.id}>
              <Link
                to="/mision/$missionId"
                params={{ missionId: mission.id }}
                className="flex flex-col gap-1 rounded-card border border-border bg-surface p-4 hover:bg-primary-soft"
              >
                <span className="text-sm text-muted">Misión {mission.order}</span>
                <span className="font-semibold text-ink">{mission.title}</span>
                <span className="text-sm text-muted">{mission.description}</span>
                <span className="text-sm text-ink">
                  {done?.completed
                    ? 'Completada'
                    : `${correct} de ${mission.questionIds.length} correctas`}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default function HomePage() {
  const me = useMe();
  if (me.isPending) return <LoadingState />;
  if (me.isError) {
    return (
      <p role="alert" className="text-danger">
        {me.error instanceof ApiError ? me.error.message : 'Ocurrió un error inesperado.'}
      </p>
    );
  }
  return me.data ? <MissionMap profile={me.data} /> : <ConsentForm />;
}
