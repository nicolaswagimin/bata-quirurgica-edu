import {
  type AdminQuestion,
  type QuestionInput,
  QuestionInputSchema,
  type QuestionType,
} from '@bata/shared/schemas';
import { useForm } from 'react-hook-form';
import { FormField } from './form-field.tsx';
import { TextAreaField } from './text-area-field.tsx';

const OPTION_IDS = ['a', 'b', 'c', 'd', 'e', 'f'] as const;

const TYPE_LABELS: Record<QuestionType, string> = {
  single: 'Una respuesta',
  multiple: 'Varias respuestas',
  truefalse: 'Verdadero o falso',
};

const inputClass = 'min-h-11 rounded-card border border-border bg-bg px-3 text-base text-ink';
const primaryButtonClass =
  'min-h-11 rounded-pill bg-primary px-4 font-semibold text-bg hover:bg-primary-strong disabled:opacity-60';
const secondaryButtonClass =
  'min-h-11 rounded-pill border border-border px-4 font-semibold text-ink hover:bg-primary-soft';

type Draft = {
  missionId: string;
  type: QuestionType;
  prompt: string;
  options: string[];
  correct: string[];
  explanation: string;
  org: string;
  title: string;
  year: string;
  section: string;
  difficulty: string;
  xp: string;
};

function toDraft(q: AdminQuestion | null, missionIds: string[]): Draft {
  if (!q) {
    return {
      missionId: missionIds[0] ?? '',
      type: 'single',
      prompt: '',
      options: ['', ''],
      correct: [],
      explanation: '',
      org: '',
      title: '',
      year: String(new Date().getFullYear()),
      section: '',
      difficulty: '1',
      xp: '10',
    };
  }
  return {
    missionId: q.missionId,
    type: q.type,
    prompt: q.prompt,
    options: q.options.map((o) => o.text),
    correct: q.correctOptionIds,
    explanation: q.explanation,
    org: q.source.org,
    title: q.source.title,
    year: String(q.source.year),
    section: q.source.section,
    difficulty: String(q.difficulty),
    xp: String(q.xp),
  };
}

function toInput(d: Draft): unknown {
  return {
    missionId: d.missionId,
    type: d.type,
    prompt: d.prompt.trim(),
    options: d.options.map((text, i) => ({ id: OPTION_IDS[i], text: text.trim() })),
    correctOptionIds: d.correct,
    explanation: d.explanation.trim(),
    source: {
      org: d.org.trim(),
      title: d.title.trim(),
      year: Number(d.year),
      section: d.section.trim(),
    },
    difficulty: Number(d.difficulty),
    xp: Number(d.xp),
  };
}

type QuestionFormProps = {
  question: AdminQuestion | null;
  missionIds: string[];
  onSubmit: (input: QuestionInput) => Promise<void>;
  onCancel: () => void;
};

// Maps the first zod issue path to the form field that shows it.
function fieldFor(path: PropertyKey[]): keyof Draft | 'root' {
  const [first, second] = path;
  if (first === 'source' && typeof second === 'string') {
    return (['org', 'title', 'year', 'section'] as const).find((k) => k === second) ?? 'root';
  }
  if (first === 'options') return 'options';
  if (first === 'correctOptionIds') return 'correct';
  const plain = ['missionId', 'prompt', 'explanation', 'difficulty', 'xp'] as const;
  return plain.find((k) => k === first) ?? 'root';
}

export function QuestionForm({ question, missionIds, onSubmit, onCancel }: QuestionFormProps) {
  const { register, handleSubmit, watch, setValue, setError, formState } = useForm<Draft>({
    defaultValues: toDraft(question, missionIds),
  });
  const { errors, isSubmitting } = formState;
  const type = watch('type');
  const options = watch('options');
  const correct = watch('correct');
  const fixedOptions = type === 'truefalse';

  const toggleCorrect = (id: string) => {
    if (type !== 'multiple') setValue('correct', [id]);
    else
      setValue(
        'correct',
        correct.includes(id) ? correct.filter((c) => c !== id) : [...correct, id],
      );
  };

  const changeType = (next: QuestionType) => {
    setValue('type', next);
    if (next === 'truefalse') setValue('options', ['Verdadero', 'Falso']);
    if (next !== 'multiple') setValue('correct', correct.slice(0, 1));
  };

  const removeLast = () => {
    const removed = OPTION_IDS[options.length - 1];
    setValue('options', options.slice(0, -1));
    setValue(
      'correct',
      correct.filter((c) => c !== removed),
    );
  };

  const submit = handleSubmit(async (draft) => {
    const parsed = QuestionInputSchema.safeParse(toInput(draft));
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        setError(fieldFor(issue.path), { message: issue.message });
      }
      return;
    }
    try {
      await onSubmit(parsed.data);
    } catch (err) {
      setError('root', {
        message: err instanceof Error ? err.message : 'Ocurrió un error inesperado.',
      });
    }
  });

  const text = (key: keyof Draft, label: string, numeric = false) => (
    <FormField
      id={`q-${key}`}
      label={label}
      inputMode={numeric ? 'numeric' : undefined}
      error={errors[key]?.message}
      {...register(key)}
    />
  );

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4 rounded-card bg-surface p-4">
      <h2 className="text-xl font-semibold text-ink">
        {question ? `Editar pregunta ${question.id}` : 'Nueva pregunta'}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Misión
          <select className={inputClass} {...register('missionId')}>
            {missionIds.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          Tipo
          <select
            className={inputClass}
            value={type}
            onChange={(e) => changeType(e.target.value as QuestionType)}
          >
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <TextAreaField
        id="q-prompt"
        label="Enunciado"
        error={errors.prompt?.message}
        {...register('prompt')}
      />
      <fieldset className="flex flex-col gap-2" aria-describedby="q-options-error">
        <legend className="mb-1 text-sm font-medium text-ink">
          Opciones (marca las correctas)
        </legend>
        {options.map((_, i) => {
          const id = OPTION_IDS[i] ?? String(i);
          return (
            <div key={id} className="flex items-center gap-2">
              <input
                type={type === 'multiple' ? 'checkbox' : 'radio'}
                name="correcta"
                aria-label={`Opción ${id} es correcta`}
                className="size-6 accent-primary"
                checked={correct.includes(id)}
                onChange={() => toggleCorrect(id)}
              />
              <input
                aria-label={`Texto de la opción ${id}`}
                className={`${inputClass} flex-1`}
                readOnly={fixedOptions}
                {...register(`options.${i}`)}
              />
            </div>
          );
        })}
        <p id="q-options-error" className="text-sm text-danger">
          {errors.options?.message ?? errors.correct?.message}
        </p>
        {!fixedOptions ? (
          <div className="flex gap-2">
            <button
              type="button"
              className={secondaryButtonClass}
              disabled={options.length >= OPTION_IDS.length}
              onClick={() => setValue('options', [...options, ''])}
            >
              Agregar opción
            </button>
            <button
              type="button"
              className={secondaryButtonClass}
              disabled={options.length <= 2}
              onClick={removeLast}
            >
              Quitar última
            </button>
          </div>
        ) : null}
      </fieldset>
      <TextAreaField
        id="q-explanation"
        label="Explicación"
        error={errors.explanation?.message}
        {...register('explanation')}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {text('org', 'Fuente: organización')}
        {text('title', 'Fuente: título')}
        {text('year', 'Fuente: año', true)}
        {text('section', 'Fuente: sección')}
        {text('difficulty', 'Dificultad (1–3)', true)}
        {text('xp', 'XP (1–100)', true)}
      </div>
      {errors.root ? (
        <p role="alert" className="text-sm text-danger">
          {errors.root.message}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={primaryButtonClass} disabled={isSubmitting}>
          {isSubmitting ? 'Guardando…' : 'Guardar como borrador'}
        </button>
        <button type="button" className={secondaryButtonClass} onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
