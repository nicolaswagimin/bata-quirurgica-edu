import { z } from 'zod';

// Versión vigente de content/legal/privacidad.json; el consentimiento debe coincidir.
export const POLICY_VERSION = '2026-10-04';

// ---------- Errores ----------

export const ERROR_CODES = [
  'BAD_REQUEST',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'PAYLOAD_TOO_LARGE',
  'VALIDATION_ERROR',
  'QUOTA_EXCEEDED',
  'THROTTLED',
  'INTERNAL',
  'NOT_IMPLEMENTED',
  'UPSTREAM_ERROR',
] as const;

export const ErrorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const ERROR_STATUS: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  VALIDATION_ERROR: 422,
  QUOTA_EXCEEDED: 429,
  THROTTLED: 429,
  INTERNAL: 500,
  NOT_IMPLEMENTED: 501,
  UPSTREAM_ERROR: 502,
};

export const ErrorEnvelopeSchema = z.object({
  error: z.object({ code: ErrorCodeSchema, message: z.string() }),
});
export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;

export function messageForStatus(status: number): string {
  if (status === 401) return 'Tu sesión expiró, vuelve a iniciar sesión';
  if (status === 429) return 'Alcanzaste el límite de mensajes; intenta más tarde';
  if (status >= 500) return 'Algo falló en el servidor. Intenta de nuevo en unos minutos.';
  if (status === 403) return 'No tienes permiso para esta acción.';
  if (status === 404) return 'No encontramos lo que buscas.';
  if (status === 422) return 'Revisa los datos enviados.';
  return 'Ocurrió un error inesperado.';
}

// ---------- Perfil y grupos ----------

export const RoleSchema = z.enum(['student', 'admin']);
export type Role = z.infer<typeof RoleSchema>;

export const JoinCodeSchema = z.string().regex(/^[A-Z0-9]{6}$/);

export const ConsentInputSchema = z
  .object({ policyVersion: z.literal(POLICY_VERSION), accepted: z.literal(true) })
  .strict();
export type ConsentInput = z.infer<typeof ConsentInputSchema>;

export const CreateProfileSchema = z
  .object({
    displayName: z.string().trim().min(2).max(60),
    consent: ConsentInputSchema,
    groupCode: JoinCodeSchema.optional(),
  })
  .strict();
export type CreateProfile = z.infer<typeof CreateProfileSchema>;

// ---------- Formularios de autenticación (web) ----------

export const CONSENT_REQUIRED_MESSAGE =
  'Debes aceptar la política de tratamiento de datos para continuar';

const EmailFieldSchema = z.string().trim().pipe(z.email('Escribe un correo electrónico válido'));

export const LoginFormSchema = z.object({
  email: EmailFieldSchema,
  password: z.string().min(1, 'Escribe tu contraseña'),
});
export type LoginForm = z.infer<typeof LoginFormSchema>;

export const RegisterFormSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, 'Escribe tu nombre (mínimo 2 caracteres)')
    .max(60, 'El nombre admite máximo 60 caracteres'),
  email: EmailFieldSchema,
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  consent: z.literal(true, CONSENT_REQUIRED_MESSAGE),
});
export type RegisterForm = z.infer<typeof RegisterFormSchema>;

export const PendingConsentSchema = z
  .object({ policyVersion: z.literal(POLICY_VERSION), acceptedAt: z.iso.datetime() })
  .strict();
export type PendingConsent = z.infer<typeof PendingConsentSchema>;

export const JoinGroupSchema = z.object({ groupCode: JoinCodeSchema }).strict();
export type JoinGroup = z.infer<typeof JoinGroupSchema>;

export const CreateGroupSchema = z.object({ name: z.string().trim().min(3).max(60) }).strict();
export type CreateGroup = z.infer<typeof CreateGroupSchema>;

// ---------- Preguntas y quiz ----------

const IdSchema = z.string().min(1).max(64);

export const QuestionTypeSchema = z.enum(['single', 'multiple', 'truefalse']);
export type QuestionType = z.infer<typeof QuestionTypeSchema>;

export const QuestionStatusSchema = z.enum(['draft', 'validated']);
export type QuestionStatus = z.infer<typeof QuestionStatusSchema>;

export const OptionSchema = z.object({ id: IdSchema, text: z.string().min(1).max(500) }).strict();
export type Option = z.infer<typeof OptionSchema>;

export const SourceRefSchema = z
  .object({
    org: z.string().min(1),
    title: z.string().min(1),
    year: z.number().int().min(1900).max(2100),
    section: z.string().min(1),
  })
  .strict();
export type SourceRef = z.infer<typeof SourceRefSchema>;

// Campos que define el autor de una pregunta (seed o admin), sin la clave.
const questionBody = {
  missionId: IdSchema,
  type: QuestionTypeSchema,
  prompt: z.string().min(1).max(1000),
  options: z.array(OptionSchema).min(2).max(6),
  explanation: z.string().min(1).max(2000),
  source: SourceRefSchema,
  difficulty: z.number().int().min(1).max(3),
  xp: z.number().int().min(1).max(100),
};

type KeyedQuestion = {
  type: QuestionType;
  options: Option[];
  correctOptionIds: string[];
};

// Reglas de coherencia entre opciones y respuestas correctas.
function checkAnswerKey(q: KeyedQuestion, ctx: z.RefinementCtx, path: (string | number)[]) {
  const optionIds = q.options.map((o) => o.id);
  if (new Set(optionIds).size !== optionIds.length) {
    ctx.addIssue({
      code: 'custom',
      message: 'Opciones con id repetido',
      path: [...path, 'options'],
    });
  }
  for (const id of q.correctOptionIds) {
    if (!optionIds.includes(id)) {
      ctx.addIssue({
        code: 'custom',
        message: `correctOptionIds incluye "${id}", que no es una opción`,
        path: [...path, 'correctOptionIds'],
      });
    }
  }
  if (q.type !== 'multiple' && q.correctOptionIds.length !== 1) {
    ctx.addIssue({
      code: 'custom',
      message: `Una pregunta ${q.type} debe tener exactamente una respuesta correcta`,
      path: [...path, 'correctOptionIds'],
    });
  }
  if (q.type === 'truefalse' && q.options.length !== 2) {
    ctx.addIssue({
      code: 'custom',
      message: 'Una pregunta truefalse debe tener dos opciones',
      path: [...path, 'options'],
    });
  }
}

const CorrectOptionIdsSchema = z.array(IdSchema).min(1).max(6);

// Documento `questions/{id}` tal como lo ve un cliente (nunca incluye la clave).
export const QuestionSchema = z
  .object({
    id: IdSchema,
    ...questionBody,
    status: QuestionStatusSchema,
    createdBy: z.string().min(1),
    validatedBy: z.string().nullable(),
    validatedAt: z.string().nullable(),
  })
  .strict();
export type Question = z.infer<typeof QuestionSchema>;

// Cuerpo de POST/PUT /admin/questions.
export const QuestionInputSchema = z
  .object({ ...questionBody, correctOptionIds: CorrectOptionIdsSchema })
  .strict()
  .superRefine((q, ctx) => checkAnswerKey(q, ctx, []));
export type QuestionInput = z.infer<typeof QuestionInputSchema>;

export const AnswerRequestSchema = z
  .object({ questionId: IdSchema, selectedOptionIds: z.array(IdSchema).min(1).max(6) })
  .strict();
export type AnswerRequest = z.infer<typeof AnswerRequestSchema>;

export const AnswerResponseSchema = z
  .object({
    correct: z.boolean(),
    explanation: z.string(),
    source: SourceRefSchema,
    xpAwarded: z.number().int().min(0),
    totalXp: z.number().int().min(0),
    level: z.number().int().min(1),
    streakDays: z.number().int().min(0),
  })
  .strict();
export type AnswerResponse = z.infer<typeof AnswerResponseSchema>;

// ---------- Asistente ----------

export const ChatMessageSchema = z
  .object({ role: z.enum(['user', 'assistant']), content: z.string().min(1).max(2000) })
  .strict();
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatRequestSchema = z
  .object({
    messages: z
      .array(ChatMessageSchema)
      .min(1)
      .max(10)
      .refine((m) => m.at(-1)?.role === 'user', 'El último mensaje debe ser del usuario'),
  })
  .strict();
export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const CitationSchema = z
  .object({
    n: z.number().int().min(1),
    title: z.string(),
    org: z.string(),
    section: z.string(),
    url: z.url().optional(),
  })
  .strict();
export type Citation = z.infer<typeof CitationSchema>;

export const StreamEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('delta'), text: z.string() }).strict(),
  z.object({ type: z.literal('citations'), items: z.array(CitationSchema) }).strict(),
  z.object({ type: z.literal('done'), latencyMs: z.number().min(0) }).strict(),
  z.object({ type: z.literal('error'), code: ErrorCodeSchema }).strict(),
]);
export type StreamEvent = z.infer<typeof StreamEventSchema>;

export const TranscribeRequestSchema = z
  .object({
    mimeType: z.enum(['audio/webm', 'audio/mp4']),
    audioBase64: z.string().min(1).max(4_000_000),
  })
  .strict();
export type TranscribeRequest = z.infer<typeof TranscribeRequestSchema>;

// ---------- Contenido (content/**) ----------

export const SeedMissionSchema = z
  .object({
    id: IdSchema,
    title: z.string().min(1),
    description: z.string().min(1),
    order: z.number().int().min(1),
    topic: z.string().min(1),
    xpReward: z.number().int().min(0),
    iconKey: z.string().min(1),
  })
  .strict();
export type SeedMission = z.infer<typeof SeedMissionSchema>;

export const SeedQuestionSchema = z
  .object({ id: IdSchema, ...questionBody, correctOptionIds: CorrectOptionIdsSchema })
  .strict();
export type SeedQuestion = z.infer<typeof SeedQuestionSchema>;

export const SeedFileSchema = z
  .object({
    reviewNote: z.string(),
    missions: z.array(SeedMissionSchema).min(1),
    questions: z.array(SeedQuestionSchema).min(1),
  })
  .strict()
  .superRefine((file, ctx) => {
    const missionIds = file.missions.map((m) => m.id);
    if (new Set(missionIds).size !== missionIds.length) {
      ctx.addIssue({ code: 'custom', message: 'Misiones con id repetido', path: ['missions'] });
    }
    const seen = new Set<string>();
    file.questions.forEach((q, i) => {
      if (seen.has(q.id)) {
        ctx.addIssue({ code: 'custom', message: `Id repetido: ${q.id}`, path: ['questions', i] });
      }
      seen.add(q.id);
      if (!missionIds.includes(q.missionId)) {
        ctx.addIssue({
          code: 'custom',
          message: `missionId inexistente: ${q.missionId}`,
          path: ['questions', i, 'missionId'],
        });
      }
      checkAnswerKey(q, ctx, ['questions', i]);
    });
  });
export type SeedFile = z.infer<typeof SeedFileSchema>;

export const HotspotSchema = z
  .object({ id: IdSchema, label: z.string().min(1), description: z.string().min(1) })
  .strict();
export type Hotspot = z.infer<typeof HotspotSchema>;

export const ProtocolStepSchema = z
  .object({
    id: IdSchema,
    order: z.number().int().min(1),
    title: z.string().min(1),
    description: z.string().min(1),
    hotspotIds: z.array(IdSchema),
    source: SourceRefSchema,
  })
  .strict();
export type ProtocolStep = z.infer<typeof ProtocolStepSchema>;

export const BataPasosSchema = z
  .object({
    reviewNote: z.string(),
    hotspots: z.array(HotspotSchema).min(1),
    donning: z.array(ProtocolStepSchema).min(1),
    doffing: z.array(ProtocolStepSchema).min(1),
  })
  .strict()
  .superRefine((file, ctx) => {
    const hotspotIds = new Set(file.hotspots.map((h) => h.id));
    for (const phase of ['donning', 'doffing'] as const) {
      file[phase].forEach((step, i) => {
        for (const id of step.hotspotIds) {
          if (!hotspotIds.has(id)) {
            ctx.addIssue({
              code: 'custom',
              message: `hotspot inexistente: ${id}`,
              path: [phase, i, 'hotspotIds'],
            });
          }
        }
      });
    }
  });
export type BataPasos = z.infer<typeof BataPasosSchema>;

export const CreditAssetSchema = z
  .object({
    id: IdSchema,
    title: z.string().min(1),
    author: z.string().min(1),
    sourceUrl: z.url().nullable(),
    license: z.string().min(1),
    modifications: z.string(),
  })
  .strict();
export type CreditAsset = z.infer<typeof CreditAssetSchema>;

export const CreditsSchema = z.object({ assets: z.array(CreditAssetSchema) }).strict();
export type Credits = z.infer<typeof CreditsSchema>;

export const KbSourceSchema = z
  .object({
    id: IdSchema,
    title: z.string().min(1),
    org: z.string().min(1),
    year: z.number().int().min(1900).max(2100),
    file: z.string().regex(/^[\w.-]+\.pdf$/),
    language: z.enum(['es', 'en']),
  })
  .strict();
export type KbSource = z.infer<typeof KbSourceSchema>;

export const KbSourcesSchema = z
  .object({ note: z.string(), documents: z.array(KbSourceSchema).min(1) })
  .strict();
export type KbSources = z.infer<typeof KbSourcesSchema>;

export const PrivacyPolicySchema = z
  .object({
    policyVersion: z.literal(POLICY_VERSION),
    title: z.string().min(1),
    sections: z
      .array(
        z
          .object({ heading: z.string().min(1), paragraphs: z.array(z.string().min(1)).min(1) })
          .strict(),
      )
      .min(1),
  })
  .strict();
export type PrivacyPolicy = z.infer<typeof PrivacyPolicySchema>;
