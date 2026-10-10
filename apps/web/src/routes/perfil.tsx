import { type JoinGroup, JoinGroupSchema } from '@bata/shared/schemas';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { FormField } from '../components/form-field.tsx';
import { LoadingState } from '../components/loading-state.tsx';
import { ApiError, apiFetch, type Profile, useMe } from '../lib/api.ts';
import { useAuth } from '../lib/firebase.tsx';
import { StatsBar } from './home.tsx';

const primaryButtonClass =
  'min-h-11 rounded-pill bg-primary px-4 font-semibold text-bg hover:bg-primary-strong disabled:opacity-60';
const dangerButtonClass =
  'min-h-11 rounded-pill bg-danger px-4 font-semibold text-bg hover:opacity-90 disabled:opacity-60';
const secondaryButtonClass =
  'min-h-11 rounded-pill border border-border px-4 font-semibold text-ink hover:bg-primary-soft';

function unexpected(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Ocurrió un error inesperado.';
}

type GroupFormValues = { groupCode: string };

function JoinGroupForm() {
  const queryClient = useQueryClient();
  const [joined, setJoined] = useState(false);
  const { register, handleSubmit, setError, formState } = useForm<GroupFormValues>({
    defaultValues: { groupCode: '' },
  });
  const { errors, isSubmitting } = formState;

  const onSubmit = handleSubmit(async (values) => {
    setJoined(false);
    const parsed = JoinGroupSchema.safeParse({ groupCode: values.groupCode.trim().toUpperCase() });
    if (!parsed.success) {
      setError('groupCode', { message: 'El código tiene 6 letras o números' });
      return;
    }
    try {
      await apiFetch<unknown>('/me/group', {
        method: 'POST',
        body: parsed.data satisfies JoinGroup,
      });
    } catch (error) {
      const notFound = error instanceof ApiError && error.status === 404;
      setError('groupCode', {
        message: notFound ? 'No encontramos un grupo con ese código' : unexpected(error),
      });
      return;
    }
    setJoined(true);
    await queryClient.invalidateQueries({ queryKey: ['me'] });
  });

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-3">
      <FormField
        id="perfil-codigo-grupo"
        label="Código de grupo"
        autoComplete="off"
        error={errors.groupCode?.message}
        {...register('groupCode')}
      />
      <p role="status" className="text-sm text-ink empty:hidden">
        {joined ? 'Te uniste al grupo' : ''}
      </p>
      <button type="submit" disabled={isSubmitting} className={`${primaryButtonClass} self-start`}>
        Unirme al grupo
      </button>
    </form>
  );
}

// Native modal <dialog>: the rest of the page becomes inert (focus stays inside) and Escape closes it.
function DeleteAccount() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { signOut } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [error, setErrorText] = useState<string | null>(null);

  async function confirmDelete() {
    setDeleting(true);
    setErrorText(null);
    try {
      await apiFetch<void>('/me', { method: 'DELETE' });
    } catch (err) {
      setErrorText(unexpected(err));
      setDeleting(false);
      return;
    }
    dialogRef.current?.close();
    await signOut();
    queryClient.clear();
    await navigate({ to: '/login' });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className={`${dangerButtonClass} self-start`}
      >
        Eliminar mi cuenta
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby="eliminar-titulo"
        aria-describedby="eliminar-descripcion"
        className="m-auto max-w-md rounded-card border border-border bg-bg p-6 text-ink backdrop:bg-ink/40"
      >
        <h2 id="eliminar-titulo" className="text-lg font-semibold">
          ¿Eliminar tu cuenta?
        </h2>
        <p id="eliminar-descripcion" className="mt-2 text-sm text-muted">
          Se borrarán tu perfil, tu progreso y tu puntaje. Esta acción no se puede deshacer.
        </p>
        <p role="alert" className="mt-2 text-sm text-danger empty:hidden">
          {error ?? ''}
        </p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className={secondaryButtonClass}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={confirmDelete}
            className={dangerButtonClass}
          >
            Sí, eliminar mi cuenta
          </button>
        </div>
      </dialog>
    </>
  );
}

function ProfileDetails({ profile }: { profile: Profile }) {
  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">Tu perfil</h1>
        <p className="text-lg text-ink">{profile.displayName}</p>
        <StatsBar profile={profile} />
      </header>
      <section className="flex flex-col gap-3 rounded-card bg-surface p-6">
        <h2 className="text-lg font-semibold">Grupo</h2>
        <p className="text-sm text-muted">
          {profile.groupId
            ? 'Ya perteneces a un grupo. Puedes cambiarlo con otro código.'
            : 'Aún no perteneces a un grupo. Pide el código a tu docente.'}
        </p>
        <JoinGroupForm />
      </section>
      <section className="flex flex-col gap-3 rounded-card border border-border p-6">
        <h2 className="text-lg font-semibold">Tu cuenta</h2>
        <p className="text-sm text-muted">
          Puedes eliminar tu cuenta y todos tus datos en cualquier momento.
        </p>
        <DeleteAccount />
      </section>
    </section>
  );
}

export default function PerfilPage() {
  const me = useMe();
  if (me.isPending) return <LoadingState />;
  if (me.isError) {
    return (
      <p role="alert" className="text-danger">
        {unexpected(me.error)}
      </p>
    );
  }
  if (!me.data) {
    return <p className="text-muted">Completa tu perfil en la página de inicio para continuar.</p>;
  }
  return <ProfileDetails profile={me.data} />;
}
