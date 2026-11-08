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

// Elemento de GET /admin/questions: la pregunta con su clave (solo para docentes).
export const AdminQuestionSchema = QuestionSchema.extend({
  correctOptionIds: CorrectOptionIdsSchema,
}).strict();
export type AdminQuestion = z.infer<typeof AdminQuestionSchema>;

export const CreatedGroupSchema = z
  .object({ groupId: IdSchema, joinCode: JoinCodeSchema })
  .strict();
export type CreatedGroup = z.infer<typeof CreatedGroupSchema>;

// Fila de GET /admin/groups/{groupId}/progress.
export const MemberProgressSchema = z
  .object({
    uid: z.string().min(1),
    displayName: z.string(),
    xp: z.number().int().min(0),
    level: z.number().int().min(1),
    streakDays: z.number().int().min(0),
    completedMissions: z.number().int().min(0),
  })
  .strict();
export type MemberProgress = z.infer<typeof MemberProgressSchema>;

// ---------- Intento de misión (quiz con un solo intento por pregunta) ----------

export const StartAttemptRequestSchema = z.object({ missionId: IdSchema }).strict();
export type StartAttemptRequest = z.infer<typeof StartAttemptRequestSchema>;

/** Pregunta tal como la ve el cliente durante un intento: sin clave de respuesta. */
export const AttemptQuestionSchema = z
  .object({
    id: IdSchema,
    type: QuestionTypeSchema,
    prompt: z.string().min(1),
    options: z.array(OptionSchema).min(2),
    explanation: z.string().min(1),
    source: SourceRefSchema,
    status: QuestionStatusSchema,
  })
  .strict();
export type AttemptQuestion = z.infer<typeof AttemptQuestionSchema>;

export const StartAttemptResponseSchema = z
  .object({
    attemptId: IdSchema,
    missionId: IdSchema,
    /** Preguntas barajadas (opciones también barajadas). Sin correctOptionIds. */
    questions: z.array(AttemptQuestionSchema).min(1),
    /** true si la misión ya fue sellada antes: el XP de este intento será 0. */
    alreadySealed: z.boolean(),
  })
  .strict();
export type StartAttemptResponse = z.infer<typeof StartAttemptResponseSchema>;

export const AnswerRequestSchema = z
  .object({
    attemptId: IdSchema,
    questionId: IdSchema,
    selectedOptionIds: z.array(IdSchema).min(1).max(6),
  })
  .strict();
export type AnswerRequest = z.infer<typeof AnswerRequestSchema>;

export const AnswerResponseSchema = z
  .object({
    correct: z.boolean(),
    /** IDs de las opciones correctas: se revelan al cliente tras responder. */
    correctOptionIds: z.array(IdSchema).min(1),
    explanation: z.string(),
    source: SourceRefSchema,
  })
  .strict();
export type AnswerResponse = z.infer<typeof AnswerResponseSchema>;

export const FinishAttemptRequestSchema = z.object({ attemptId: IdSchema }).strict();
export type FinishAttemptRequest = z.infer<typeof FinishAttemptRequestSchema>;

/** Resumen de una pregunta fallada que se muestra en la pantalla de resultados. */
export const FailedQuestionSummarySchema = z
  .object({
    id: IdSchema,
    prompt: z.string().min(1),
    /** Todas las opciones, para poder mostrar el texto de la respuesta correcta. */
    options: z.array(OptionSchema).min(2),
    correctOptionIds: z.array(IdSchema).min(1),
    source: SourceRefSchema,
  })
  .strict();
export type FailedQuestionSummary = z.infer<typeof FailedQuestionSummarySchema>;

export const FinishAttemptResponseSchema = z
  .object({
    correct: z.number().int().min(0),
    total: z.number().int().min(1),
    /** Preguntas que el estudiante llegó a responder. */
    answered: z.number().int().min(0),
    /** true si cerró el intento con preguntas sin responder. */
    abandoned: z.boolean(),
    /** true si se quedó sin vidas (cierra el examen antes de la última pregunta). */
    outOfLives: z.boolean(),
    /** true solo si respondió todo y alcanzó el mínimo. */
    passed: z.boolean(),
    /** Estrellas de este intento (0 cuando no aprueba o abandona). */
    stars: z.number().int().min(0).max(3),
    /** Mejor cantidad de aciertos que ha logrado en esta misión. */
    bestCorrect: z.number().int().min(0),
    /** XP de la misión; 0 si no aprobó o si era un repaso. */
    xpAwarded: z.number().int().min(0),
    bonusXp: z.number().int().min(0),
    missionSealed: z.boolean(),
    /** true si la misión ya estaba sellada antes de este intento. */
    alreadySealed: z.boolean(),
    failedQuestions: z.array(FailedQuestionSummarySchema),
    totalXp: z.number().int().min(0),
    level: z.number().int().min(1),
    streakDays: z.number().int().min(0),
  })
  .strict();
export type FinishAttemptResponse = z.infer<typeof FinishAttemptResponseSchema>;

// ---------- Práctica guiada (AR espejo) ----------

/** Orden de los pasos de colocación; debe coincidir con content/protocolos/bata-pasos.json. */
export const DONNING_STEP_IDS = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6'] as const;

export const PracticeCompleteRequestSchema = z
  .object({
    protocol: z.literal('donning'),
    stepIds: z
      .array(IdSchema)
      .length(DONNING_STEP_IDS.length)
      .refine((ids) => ids.every((id, i) => id === DONNING_STEP_IDS[i]), {
        message: 'Los pasos deben venir completos y en orden',
      }),
  })
  .strict();
export type PracticeCompleteRequest = z.infer<typeof PracticeCompleteRequestSchema>;

export const PracticeCompleteResponseSchema = z
  .object({
    xpAwarded: z.number().int().min(0),
    alreadyCompletedToday: z.boolean(),
    totalXp: z.number().int().min(0),
    level: z.number().int().min(1),
    streakDays: z.number().int().min(0),
  })
  .strict();
export type PracticeCompleteResponse = z.infer<typeof PracticeCompleteResponseSchema>;

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

/** One step of the AR mirror game; `covers` names the donning steps it practises. */
export const ArGameStepSchema = z
  .object({
    id: IdSchema,
    order: z.number().int().min(1),
    title: z.string().min(1),
    instruction: z.string().min(1),
    covers: z.array(IdSchema),
  })
  .strict();
export type ArGameStep = z.infer<typeof ArGameStepSchema>;

export const BataPasosSchema = z
  .object({
    reviewNote: z.string(),
    hotspots: z.array(HotspotSchema).min(1),
    donning: z.array(ProtocolStepSchema).min(1),
    doffing: z.array(ProtocolStepSchema).min(1),
    juegoAr: z.array(ArGameStepSchema).min(1),
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
    // The game must practise every donning step (the practice POST sends all of them).
    const donningIds = new Set(file.donning.map((s) => s.id));
    const covered = new Set(file.juegoAr.flatMap((s) => s.covers));
    file.juegoAr.forEach((step, i) => {
      for (const id of step.covers) {
        if (!donningIds.has(id)) {
          ctx.addIssue({
            code: 'custom',
            message: `paso inexistente: ${id}`,
            path: ['juegoAr', i, 'covers'],
          });
        }
      }
    });
    for (const id of donningIds) {
      if (!covered.has(id)) {
        ctx.addIssue({ code: 'custom', message: `el juego no cubre ${id}`, path: ['juegoAr'] });
      }
    }
  });
export type BataPasos = z.infer<typeof BataPasosSchema>;

// ---------- Práctica guiada AR v2 (content/protocolos/ar-practica-v2.json) ----------
// Borrador de la secuencia didáctica: cada paso define objetivo, acción, qué mirar, tiempo de
// sostén, error frecuente, corrección y debrief. `donningIds` enlaza con el protocolo y `decisions`
// recoge lo que el director de tesis debe validar antes de implementar el motor v2.

/** Interacción que el motor v2 sabe evaluar; el contenido no necesita conocer la geometría. */
export const PracticeKindSchema = z.enum([
  'mask',
  'friction',
  'band',
  'neck',
  'sleeves',
  'still',
  'gloves',
  'turn',
  /** Bata desplegada a la altura de los hombros, lejos del cuerpo y sin sacudirla (v3). */
  'unfold',
]);
export type PracticeKind = z.infer<typeof PracticeKindSchema>;

export const ArPracticeStepSchema = z
  .object({
    id: IdSchema,
    order: z.number().int().min(1),
    kind: PracticeKindSchema,
    /** Pasos de `bata-pasos.json#donning` que practica; vacío si el paso no está en el protocolo. */
    donningIds: z.array(IdSchema),
    title: z.string().min(1).max(80),
    /** Para qué sirve el paso, en una frase. */
    goal: z.string().min(1).max(240),
    /** Qué hace el estudiante, en imperativo. */
    action: z.string().min(1).max(240),
    /** Dónde mirar o qué parte del cuerpo importa. */
    look: z.string().min(1).max(200),
    /** Cuánto debe sostener la posición o el movimiento (timer de fricción incluido). */
    holdMs: z.number().int().min(300).max(60_000),
    commonError: z.string().min(1).max(240),
    correction: z.string().min(1).max(240),
    /** Frase de cierre del paso, para el debrief final. */
    debrief: z.string().min(1).max(240),
    /** Lo que dice la voz: corto, sin leer todo el texto. */
    voice: z.string().min(1).max(160),
    /** Nota cuando el AR no puede reproducir la acción real (lavado de manos, mascarilla). */
    simulation: z.string().min(1).max(240).optional(),
    /** Paso opcional: solo entra en la práctica si la opción de `config` con este nombre está activa. */
    toggle: z.enum(['mascarilla', 'secado']).optional(),
    source: SourceRefSchema,
  })
  .strict();
export type ArPracticeStep = z.infer<typeof ArPracticeStepSchema>;

/** Pregunta clínica que el director de tesis debe resolver antes de implementar el paso. */
export const PracticeDecisionSchema = z
  .object({
    id: IdSchema,
    question: z.string().min(1).max(300),
    proposed: z.string().min(1).max(300),
    alternatives: z.array(z.string().min(1).max(300)).min(1).max(4),
    /** Opción aprobada por el director; vacío mientras la decisión siga abierta. */
    chosen: z.string().min(1).max(300).optional(),
  })
  .strict();
export type PracticeDecision = z.infer<typeof PracticeDecisionSchema>;

/** Textos del paso de giro, según la opción de giro elegida. */
const TurnTextSchema = z
  .object({
    action: z.string().min(1).max(240),
    voice: z.string().min(1).max(160),
    correction: z.string().min(1).max(240),
  })
  .strict();

/**
 * Puntos abiertos que la práctica deja configurables mientras el director decide (v3). La URL puede
 * sobrescribirlos para QA (`?giro=360|cuarto`, `?mascarilla=1|0`, `?secado=1|0`).
 */
export const ArPracticeConfigSchema = z
  .object({
    giro: z.enum(['cuarto', '360']),
    mascarilla: z.boolean(),
    secado: z.boolean(),
  })
  .strict();
export type ArPracticeConfig = z.infer<typeof ArPracticeConfigSchema>;

export const ArPracticeFileSchema = z
  .object({
    reviewNote: z.string().min(1),
    version: z.union([z.literal(2), z.literal(3)]),
    /** Estado clínico de la secuencia; si falta, lo indica `validatedBy`. */
    status: z.enum(['pendiente-validacion', 'validada']).optional(),
    /** De dónde sale el movimiento (p. ej. la guía del video) y si ya se contrastó. */
    reference: z.string().min(1).max(400).optional(),
    config: ArPracticeConfigSchema.optional(),
    turnText: z.object({ cuarto: TurnTextSchema, '360': TurnTextSchema }).strict().optional(),
    /** Quién validó la secuencia y el día (YYYY-MM-DD); van juntos o no van. */
    validatedBy: z.string().min(1).max(120).optional(),
    validatedAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha YYYY-MM-DD')
      .optional(),
    steps: z.array(ArPracticeStepSchema).min(1),
    decisions: z.array(PracticeDecisionSchema),
  })
  .strict()
  .superRefine((file, ctx) => {
    const ids = new Set<string>();
    file.steps.forEach((step, i) => {
      if (ids.has(step.id)) {
        ctx.addIssue({
          code: 'custom',
          message: `Id repetido: ${step.id}`,
          path: ['steps', i, 'id'],
        });
      }
      ids.add(step.id);
      if (step.order !== i + 1) {
        ctx.addIssue({
          code: 'custom',
          message: `order debe ser ${i + 1}`,
          path: ['steps', i, 'order'],
        });
      }
    });
    if (Boolean(file.validatedBy) !== Boolean(file.validatedAt)) {
      ctx.addIssue({
        code: 'custom',
        message: 'validatedBy y validatedAt deben ir juntos',
        path: ['validatedBy'],
      });
    }
    if (file.status === 'pendiente-validacion' && file.validatedBy) {
      ctx.addIssue({
        code: 'custom',
        message: 'Una secuencia pendiente de validación no puede tener validatedBy',
        path: ['status'],
      });
    }
    if (file.status === 'validada' && !file.validatedBy) {
      ctx.addIssue({
        code: 'custom',
        message: 'Una secuencia validada necesita validatedBy y validatedAt',
        path: ['status'],
      });
    }
    if (file.steps.some((step) => step.toggle) && !file.config) {
      ctx.addIssue({
        code: 'custom',
        message: 'Los pasos con toggle necesitan config',
        path: ['config'],
      });
    }
    const decisionIds = new Set<string>();
    file.decisions.forEach((decision, i) => {
      if (decisionIds.has(decision.id)) {
        ctx.addIssue({
          code: 'custom',
          message: `Decisión repetida: ${decision.id}`,
          path: ['decisions', i, 'id'],
        });
      }
      decisionIds.add(decision.id);
      if (
        decision.chosen &&
        decision.chosen !== decision.proposed &&
        !decision.alternatives.includes(decision.chosen)
      ) {
        ctx.addIssue({
          code: 'custom',
          message: 'chosen debe ser la propuesta o una de las alternativas',
          path: ['decisions', i, 'chosen'],
        });
      }
    });
  });
export type ArPracticeFile = z.infer<typeof ArPracticeFileSchema>;

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

// ---------- Aprende (content/lecciones/lecciones.json) ----------
// Lessons are a draft pending the thesis director's validation. Every statement names the sources
// that back it (ids into `sources`); nothing is said without one.

const SourceIdsSchema = z.array(IdSchema).min(1);

export const SourcedTextSchema = z
  .object({ text: z.string().min(1).max(600), sourceIds: SourceIdsSchema })
  .strict();
export type SourcedText = z.infer<typeof SourcedTextSchema>;

/** A frequent mistake shown as a pair of pixel illustrations: what not to do, and the fix. */
export const LessonMistakeSchema = z
  .object({
    id: IdSchema,
    wrong: z.string().min(1).max(300),
    right: z.string().min(1).max(300),
    wrongArt: IdSchema,
    rightArt: IdSchema,
    sourceIds: SourceIdsSchema,
  })
  .strict();
export type LessonMistake = z.infer<typeof LessonMistakeSchema>;

export const LessonSchema = z
  .object({
    missionId: IdSchema,
    /** Same as the mission's iconKey in the seed (the web never bundles the seed: it has answers). */
    iconKey: IdSchema,
    title: z.string().min(1).max(120),
    summary: z.string().min(1).max(240),
    /** Teaching videos shown with the lesson (ids of apps/web/public/videos/<id>.*). */
    videoIds: z.array(IdSchema).max(4),
    videoNote: z.string().min(1).max(200).optional(),
    keyPoints: z.array(SourcedTextSchema).min(2).max(6),
    mistakes: z.array(LessonMistakeSchema).min(1).max(3),
  })
  .strict();
export type Lesson = z.infer<typeof LessonSchema>;

export const GlossaryTermSchema = z
  .object({
    id: IdSchema,
    term: z.string().min(1).max(60),
    definition: z.string().min(1).max(400),
    sourceIds: SourceIdsSchema,
  })
  .strict();
export type GlossaryTerm = z.infer<typeof GlossaryTermSchema>;

const ChecklistItemSchema = SourcedTextSchema.extend({ id: IdSchema }).strict();

export const LessonsFileSchema = z
  .object({
    reviewNote: z.string().min(1),
    sources: z.record(IdSchema, SourceRefSchema),
    lessons: z.array(LessonSchema).min(1),
    glossary: z.array(GlossaryTermSchema).min(1),
    /** Donning checklist: what to check before and while dressing; the steps come from bata-pasos. */
    checklist: z
      .object({
        before: z.array(ChecklistItemSchema).min(1),
        during: z.array(ChecklistItemSchema).min(1),
      })
      .strict(),
  })
  .strict()
  .superRefine((file, ctx) => {
    const known = new Set(Object.keys(file.sources));
    const check = (ids: string[], path: (string | number)[]) => {
      for (const id of ids) {
        if (!known.has(id))
          ctx.addIssue({ code: 'custom', message: `fuente ${id} no existe`, path });
      }
    };
    for (const [i, l] of file.lessons.entries()) {
      for (const [j, k] of l.keyPoints.entries())
        check(k.sourceIds, ['lessons', i, 'keyPoints', j]);
      for (const [j, m] of l.mistakes.entries()) check(m.sourceIds, ['lessons', i, 'mistakes', j]);
    }
    for (const [i, g] of file.glossary.entries()) check(g.sourceIds, ['glossary', i]);
    for (const [i, c] of file.checklist.before.entries()) {
      check(c.sourceIds, ['checklist', 'before', i]);
    }
    for (const [i, c] of file.checklist.during.entries()) {
      check(c.sourceIds, ['checklist', 'during', i]);
    }
  });
export type LessonsFile = z.infer<typeof LessonsFileSchema>;
