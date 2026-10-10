import {
  type LoginForm,
  LoginFormSchema,
  type PendingConsent,
  POLICY_VERSION,
  PrivacyPolicySchema,
  type RegisterForm,
  RegisterFormSchema,
} from '@bata/shared/schemas';
import { Link, useNavigate, useRouter, useSearch } from '@tanstack/react-router';
import { FirebaseError } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { useState } from 'react';
import { type FieldValues, type Path, type UseFormSetError, useForm } from 'react-hook-form';
import type { z } from 'zod';
import privacidadJson from '../../../../content/legal/privacidad.json';
import { FormField } from '../components/form-field.tsx';
import { clearAuthNotice, readAuthNotice } from '../lib/api.ts';
import { auth } from '../lib/firebase.tsx';

const privacyPolicy = PrivacyPolicySchema.parse(privacidadJson);

const cardClass = 'mx-auto flex max-w-md flex-col gap-4 rounded-card bg-surface p-6';
const primaryButtonClass =
  'min-h-11 rounded-pill bg-primary px-4 font-semibold text-bg hover:bg-primary-strong disabled:opacity-60';
const secondaryButtonClass =
  'min-h-11 rounded-pill border border-border bg-bg px-4 font-semibold text-ink hover:bg-primary-soft';
const linkClass = 'text-primary underline hover:text-primary-strong';

function authErrorMessage(error: unknown): string {
  const code = error instanceof FirebaseError ? error.code : '';
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
    return 'Correo o contraseña incorrectos.';
  }
  if (code === 'auth/email-already-in-use') return 'Ya existe una cuenta con este correo.';
  if (code === 'auth/too-many-requests') return 'Demasiados intentos. Espera unos minutos.';
  if (code === 'auth/popup-closed-by-user')
    return 'Cerraste la ventana de Google antes de terminar.';
  if (code === 'auth/network-request-failed')
    return 'Sin conexión. Revisa tu red e intenta de nuevo.';
  return 'No pudimos completar la operación. Intenta de nuevo.';
}

// Runs the shared zod schema and maps each issue to its field; returns null when invalid.
function validate<T extends FieldValues>(
  schema: z.ZodType<T>,
  values: unknown,
  setError: UseFormSetError<T>,
): T | null {
  const parsed = schema.safeParse(values);
  if (parsed.success) return parsed.data;
  for (const issue of parsed.error.issues) {
    const field = issue.path[0];
    if (typeof field === 'string') setError(field as Path<T>, { message: issue.message });
  }
  return null;
}

// Only same-origin paths, never protocol-relative URLs.
function safeRedirect(target: string | undefined): string {
  return target?.startsWith('/') && !target.startsWith('//') ? target : '/';
}

function FormAlert({ message }: { message: string | null }) {
  return (
    <p role="alert" className="text-sm text-danger empty:hidden">
      {message ?? ''}
    </p>
  );
}

export function LoginPage() {
  const router = useRouter();
  const { redirect } = useSearch({ from: '/login' });
  const [formError, setFormError] = useState<string | null>(readAuthNotice);
  const [notice, setNotice] = useState<string | null>(null);
  const { register, handleSubmit, setError, getValues, formState } = useForm<LoginForm>({
    defaultValues: { email: '', password: '' },
  });
  const { errors, isSubmitting } = formState;

  const finish = () => {
    clearAuthNotice();
    router.history.push(safeRedirect(redirect));
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const data = validate(LoginFormSchema, values, setError);
    if (!data) return;
    try {
      await signInWithEmailAndPassword(auth, data.email, data.password);
      finish();
    } catch (error) {
      setFormError(authErrorMessage(error));
    }
  });

  const onGoogle = async () => {
    setFormError(null);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      finish();
    } catch (error) {
      setFormError(authErrorMessage(error));
    }
  };

  const onReset = async () => {
    setFormError(null);
    setNotice(null);
    const parsed = LoginFormSchema.shape.email.safeParse(getValues('email'));
    if (!parsed.success) {
      setError('email', { message: 'Escribe tu correo para restablecer la contraseña' });
      return;
    }
    try {
      await sendPasswordResetEmail(auth, parsed.data);
      setNotice(
        'Si el correo está registrado, te enviamos un enlace para restablecer la contraseña.',
      );
    } catch (error) {
      setFormError(authErrorMessage(error));
    }
  };

  return (
    <section className={cardClass}>
      <h1 className="text-2xl font-semibold">Iniciar sesión</h1>
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormField
          id="login-email"
          label="Correo electrónico"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <FormField
          id="login-password"
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <FormAlert message={formError} />
        <button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
          Iniciar sesión
        </button>
      </form>
      <button type="button" onClick={() => void onGoogle()} className={secondaryButtonClass}>
        Continuar con Google
      </button>
      <button type="button" onClick={() => void onReset()} className={`${linkClass} self-start`}>
        ¿Olvidaste tu contraseña?
      </button>
      <p role="status" className="text-sm text-muted empty:hidden">
        {notice ?? ''}
      </p>
      <p className="text-sm text-muted">
        ¿No tienes cuenta?{' '}
        <Link to="/registro" className={linkClass}>
          Crear cuenta
        </Link>
      </p>
    </section>
  );
}

export function RegistroPage() {
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, setError, formState } = useForm<RegisterForm>({
    defaultValues: { displayName: '', email: '', password: '' },
  });
  const { errors, isSubmitting } = formState;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const data = validate(RegisterFormSchema, values, setError);
    if (!data) return;
    try {
      const { user } = await createUserWithEmailAndPassword(auth, data.email, data.password);
      await updateProfile(user, { displayName: data.displayName });
      const pending: PendingConsent = {
        policyVersion: POLICY_VERSION,
        acceptedAt: new Date().toISOString(),
      };
      sessionStorage.setItem('bata.pendingConsent', JSON.stringify(pending));
      await navigate({ to: '/' });
    } catch (error) {
      setFormError(authErrorMessage(error));
    }
  });

  const consentErrorId = 'registro-consent-error';

  return (
    <section className={cardClass}>
      <h1 className="text-2xl font-semibold">Crear cuenta</h1>
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        <FormField
          id="registro-nombre"
          label="Nombre"
          autoComplete="name"
          error={errors.displayName?.message}
          {...register('displayName')}
        />
        <FormField
          id="registro-email"
          label="Correo electrónico"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <FormField
          id="registro-password"
          label="Contraseña"
          type="password"
          autoComplete="new-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <div className="flex flex-col gap-1">
          <div className="flex items-start gap-2">
            <input
              id="registro-consent"
              type="checkbox"
              className="mt-1 size-6 accent-primary"
              aria-invalid={errors.consent ? true : undefined}
              aria-describedby={errors.consent ? consentErrorId : undefined}
              {...register('consent')}
            />
            <label htmlFor="registro-consent" className="text-sm">
              Acepto la{' '}
              <Link to="/privacidad" className={linkClass}>
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
        <FormAlert message={formError} />
        <button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
          Crear cuenta
        </button>
      </form>
      <p className="text-sm text-muted">
        ¿Ya tienes cuenta?{' '}
        <Link to="/login" className={linkClass}>
          Iniciar sesión
        </Link>
      </p>
    </section>
  );
}

export function PrivacidadPage() {
  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">{privacyPolicy.title}</h1>
        <p className="mt-1 text-sm text-muted">Versión {privacyPolicy.policyVersion}</p>
      </header>
      {privacyPolicy.sections.map((section) => (
        <section key={section.heading} className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{section.heading}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className="leading-relaxed">
              {paragraph}
            </p>
          ))}
        </section>
      ))}
    </article>
  );
}
