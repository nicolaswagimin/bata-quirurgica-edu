import {
  type CreatedGroup,
  CreateGroupSchema,
  type MemberProgress,
  messageForStatus,
} from '@bata/shared/schemas';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { FormField } from '../components/form-field.tsx';
import { LoadingState } from '../components/loading-state.tsx';
import { AdminOnlyNotice } from '../components/require-admin.tsx';
import { ApiError, apiFetch } from '../lib/api.ts';
import { useAuth } from '../lib/firebase.tsx';

// There is no "list groups" endpoint: the groups this admin created are remembered per browser.
const STORAGE_KEY = 'bata.adminGroups';

type KnownGroup = CreatedGroup & { name: string };

function loadGroups(): KnownGroup[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as KnownGroup[]) : [];
  } catch {
    return [];
  }
}

function storeGroups(groups: KnownGroup[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
  } catch {
    // Storage unavailable: the list lives only for this visit.
  }
}

function errorText(error: unknown): string {
  return error instanceof ApiError ? error.message : messageForStatus(0);
}

const primaryButtonClass =
  'min-h-11 rounded-pill bg-primary px-4 font-semibold text-bg hover:bg-primary-strong disabled:opacity-60';
const inputClass = 'min-h-11 rounded-card border border-border bg-bg px-3 text-base text-ink';

type FormValues = { name: string };

export default function AdminGruposPage() {
  const { role } = useAuth();
  const [groups, setGroups] = useState<KnownGroup[]>(loadGroups);
  const [selected, setSelected] = useState<string>(() => loadGroups()[0]?.groupId ?? '');
  const [created, setCreated] = useState<KnownGroup | null>(null);
  const { register, handleSubmit, setError, reset, formState } = useForm<FormValues>({
    defaultValues: { name: '' },
  });
  const { errors, isSubmitting } = formState;

  const progress = useQuery({
    queryKey: ['admin', 'groups', selected, 'progress'],
    queryFn: () =>
      apiFetch<MemberProgress[]>(`/admin/groups/${encodeURIComponent(selected)}/progress`),
    enabled: role === 'admin' && selected !== '',
  });

  if (role !== 'admin') return <AdminOnlyNotice />;

  const onSubmit = handleSubmit(async (values) => {
    const parsed = CreateGroupSchema.safeParse(values);
    if (!parsed.success) {
      setError('name', { message: 'El nombre debe tener entre 3 y 60 caracteres' });
      return;
    }
    try {
      const group = await apiFetch<CreatedGroup>('/admin/groups', {
        method: 'POST',
        body: parsed.data,
      });
      const known = { ...group, name: parsed.data.name };
      const next = [known, ...groups];
      setGroups(next);
      storeGroups(next);
      setCreated(known);
      setSelected(group.groupId);
      reset();
    } catch (error) {
      setError('name', { message: errorText(error) });
    }
  });

  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-6">
      <h1 className="text-2xl font-semibold text-ink">Grupos</h1>

      <form
        noValidate
        onSubmit={onSubmit}
        className="flex flex-col gap-3 rounded-card bg-surface p-4"
      >
        <h2 className="text-xl font-semibold text-ink">Crear grupo</h2>
        <FormField
          id="grupo-nombre"
          label="Nombre del grupo"
          placeholder="Cirugía 2026-A"
          error={errors.name?.message}
          {...register('name')}
        />
        <button
          type="submit"
          className={`${primaryButtonClass} self-start`}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Creando…' : 'Crear grupo'}
        </button>
        <div aria-live="polite">
          {created ? (
            <p className="text-ink">
              Código de «{created.name}»:{' '}
              <strong className="rounded-pill bg-primary-soft px-3 py-1 text-xl tracking-widest">
                {created.joinCode}
              </strong>
              <span className="block text-sm text-muted">
                Compártelo con tus estudiantes para que se unan desde su perfil.
              </span>
            </p>
          ) : null}
        </div>
      </form>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold text-ink">Progreso del grupo</h2>
        {groups.length === 0 ? (
          <p className="text-muted">Crea un grupo para ver el progreso de sus integrantes.</p>
        ) : (
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            Grupo
            <select
              className={inputClass}
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              {groups.map((g) => (
                <option key={g.groupId} value={g.groupId}>
                  {g.name} ({g.joinCode})
                </option>
              ))}
            </select>
          </label>
        )}
        {progress.isFetching ? <LoadingState /> : null}
        {progress.isError ? (
          <p role="alert" className="text-danger">
            {errorText(progress.error)}
          </p>
        ) : null}
        {progress.data && progress.data.length === 0 ? (
          <p className="text-muted">Este grupo aún no tiene integrantes.</p>
        ) : null}
        {progress.data && progress.data.length > 0 ? (
          <div className="overflow-x-auto rounded-card border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-muted">
                <tr>
                  <th scope="col" className="p-3">
                    Nombre
                  </th>
                  <th scope="col" className="p-3 text-right">
                    XP
                  </th>
                  <th scope="col" className="p-3 text-right">
                    Nivel
                  </th>
                  <th scope="col" className="p-3 text-right">
                    Racha (días)
                  </th>
                  <th scope="col" className="p-3 text-right">
                    Misiones completadas
                  </th>
                </tr>
              </thead>
              <tbody>
                {progress.data.map((m) => (
                  <tr key={m.uid} className="border-t border-border text-ink">
                    <th scope="row" className="p-3 font-medium">
                      {m.displayName}
                    </th>
                    <td className="p-3 text-right">{m.xp}</td>
                    <td className="p-3 text-right">{m.level}</td>
                    <td className="p-3 text-right">{m.streakDays}</td>
                    <td className="p-3 text-right">{m.completedMissions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </section>
  );
}
