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
import { HomeBand } from '../components/home-band.tsx';
import { LoadingState } from '../components/loading-state.tsx';
import { Mascot, MascotNote } from '../components/mascot.tsx';
import { type IndexEntry, MissionIndex } from '../components/mission-index.tsx';
import { MissionSheet } from '../components/mission-sheet.tsx';
import { formPanel, panel, buttonPrimary as primaryButtonClass } from '../components/ui-classes.ts';
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

function hasPendingConsent(): boolean {
  try {
    const raw = sessionStorage.getItem(PENDING_CONSENT_KEY);
    return raw !== null && PendingConsentSchema.safeParse(JSON.parse(raw)).success;
  } catch {
    return false;
  }
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
    <section className={`${formPanel} max-w-lg`}>
      <Mascot className="h-20 w-auto self-start" />
      <h1 className="text-xl font-extrabold tracking-tight">Completa tu perfil</h1>
      <p className="text-sm text-muted">
        Así empiezas: cinco misiones sobre la bata quirúrgica y la bioseguridad, con cada
        explicación basada en OMS, CDC y la Resolución 3100 de 2019.
      </p>
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
        <p className="-mt-2 text-xs text-muted">
          Si tu docente te dio un código de 6 letras o números, escríbelo para aparecer en el
          ranking de tu grupo. Puedes agregarlo después en tu perfil.
        </p>
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
        <p role="alert" className="text-sm font-bold text-danger empty:hidden">
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

  const progressKnown = progress.isSuccess;
  const entries: IndexEntry[] = (missions.data ?? []).map((m) => {
    const p = progress.data?.[m.id];
    return {
      id: m.id,
      order: m.order,
      title: m.title,
      description: m.description,
      topic: m.topic,
      xpReward: m.xpReward,
      iconKey: m.iconKey,
      questionCount: m.questionIds.length,
      correct: progressKnown ? (p?.answeredCorrectIds.length ?? 0) : null,
      completed: p?.completed ?? false,
    };
  });
  const current = entries.find((e) => !e.completed) ?? null;

  return (
    <div className="flex flex-col">
      <HomeBand profile={profile} />
      {missions.isPending || progress.isPending ? <LoadingState /> : null}
      {missions.isError ? (
        <div role="alert" className="mt-8 flex flex-col items-start gap-3">
          <p className="font-bold text-danger">No pudimos cargar tus misiones.</p>
          <button
            type="button"
            onClick={() => void missions.refetch()}
            className={primaryButtonClass}
          >
            Reintentar
          </button>
        </div>
      ) : null}
      {missions.isSuccess && !progress.isPending ? (
        entries.length === 0 ? (
          <p className="mt-8 text-muted">Aún no hay misiones publicadas. Vuelve pronto.</p>
        ) : (
          <div className="grid gap-8 md:-mt-12 md:grid-cols-12 md:items-start">
            {current ? (
              <MissionSheet mission={current} correct={current.correct} className="md:col-span-7" />
            ) : (
              <section className={`${panel} flex flex-col items-start gap-4 md:col-span-7`}>
                <h2 className="font-pixel text-2xl font-semibold text-primary">
                  ¡Todas dominadas!
                </h2>
                <MascotNote on="panel" mood="cheer">
                  Dominaste las {entries.length} misiones. Repasa en 3D o en el AR espejo para
                  mantener la técnica.
                </MascotNote>
              </section>
            )}
            <MissionIndex
              entries={entries}
              currentId={current?.id ?? null}
              className="md:col-span-5"
            />
          </div>
        )
      ) : null}
    </div>
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
