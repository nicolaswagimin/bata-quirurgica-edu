import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ArPracticeFileSchema,
  BataPasosSchema,
  ChatRequestSchema,
  CreateProfileSchema,
  CreditsSchema,
  DONNING_STEP_IDS,
  KbSourcesSchema,
  LessonsFileSchema,
  messageForStatus,
  POLICY_VERSION,
  PracticeCompleteRequestSchema,
  PrivacyPolicySchema,
  SeedFileSchema,
  StreamEventSchema,
} from '../src/schemas.ts';

const contentDir = join(import.meta.dirname, '../../../content');
const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(join(contentDir, path), 'utf8'));

describe('archivos de content/', () => {
  it.each([
    ['questions/seed.json', SeedFileSchema],
    ['protocolos/bata-pasos.json', BataPasosSchema],
    ['protocolos/ar-practica-v2.json', ArPracticeFileSchema],
    ['credits.json', CreditsSchema],
    ['kb/sources.json', KbSourcesSchema],
    ['legal/privacidad.json', PrivacyPolicySchema],
    ['lecciones/lecciones.json', LessonsFileSchema],
  ] as const)('%s cumple su esquema', (path, schema) => {
    const result = schema.safeParse(readJson(path));
    expect(result.error?.issues ?? []).toEqual([]);
  });
});

describe('SeedFileSchema', () => {
  const seed = SeedFileSchema.parse(readJson('questions/seed.json'));

  it('rechaza correctOptionIds que no existen entre las opciones', () => {
    const [first, ...rest] = seed.questions;
    const broken = { ...seed, questions: [{ ...first, correctOptionIds: ['zz'] }, ...rest] };
    const result = SeedFileSchema.safeParse(broken);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['questions', 0, 'correctOptionIds']);
  });

  it('rechaza ids repetidos y misiones inexistentes', () => {
    const [first] = seed.questions;
    expect(
      SeedFileSchema.safeParse({ ...seed, questions: [...seed.questions, first] }).success,
    ).toBe(false);
    expect(
      SeedFileSchema.safeParse({
        ...seed,
        questions: [{ ...first, missionId: 'no-existe' }],
      }).success,
    ).toBe(false);
  });
});

describe('LessonsFileSchema', () => {
  const lessons = LessonsFileSchema.parse(readJson('lecciones/lecciones.json'));
  const seed = SeedFileSchema.parse(readJson('questions/seed.json'));

  it('hay exactamente una lección por misión del seed, en su orden', () => {
    expect(lessons.lessons.map((l) => l.missionId)).toEqual(
      [...seed.missions].sort((a, b) => a.order - b.order).map((m) => m.id),
    );
  });

  it('cada lección usa el ícono de su misión', () => {
    const icons = new Map(seed.missions.map((m) => [m.id, m.iconKey]));
    for (const l of lessons.lessons) expect(l.iconKey).toBe(icons.get(l.missionId));
  });

  it('el glosario incluye los términos pedidos', () => {
    const ids = lessons.glossary.map((g) => g.id);
    for (const id of [
      'campo-esteril',
      'tecnica-cerrada',
      'circulante',
      'instrumentador',
      'zona-esteril',
    ]) {
      expect(ids).toContain(id);
    }
  });

  it('rechaza una afirmación que cita una fuente inexistente', () => {
    const [first, ...rest] = lessons.lessons;
    if (!first) throw new Error('sin lecciones');
    const keyPoints = [{ text: 'x', sourceIds: ['no-existe'] }, ...first.keyPoints];
    const broken = { ...lessons, lessons: [{ ...first, keyPoints }, ...rest] };
    const result = LessonsFileSchema.safeParse(broken);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['lessons', 0, 'keyPoints', 0]);
  });
});

describe('ArPracticeFileSchema', () => {
  const source = {
    org: 'OMS',
    title: 'WHO Guidelines for Safe Surgery',
    year: 2009,
    section: 'Objetivo 6: prevención de la infección del sitio quirúrgico',
  };
  const step = (id: string, order: number) => ({
    id,
    order,
    kind: 'band',
    donningIds: [],
    title: id,
    goal: 'g',
    action: 'a',
    look: 'l',
    holdMs: 600,
    commonError: 'e',
    correction: 'c',
    debrief: 'd',
    voice: 'v',
    source,
  });
  const valid = {
    reviewNote: 'x',
    version: 2,
    steps: [step('a', 1), step('b', 2)],
    decisions: [],
  };

  it('acepta un archivo válido', () => {
    expect(ArPracticeFileSchema.safeParse(valid).success).toBe(true);
  });

  it('exige identificadores únicos y orden secuencial', () => {
    expect(
      ArPracticeFileSchema.safeParse({ ...valid, steps: [step('a', 1), step('a', 2)] }).success,
    ).toBe(false);
    expect(
      ArPracticeFileSchema.safeParse({ ...valid, steps: [step('a', 2), step('b', 1)] }).success,
    ).toBe(false);
  });

  it('exige que la validación y la fecha vayan juntas', () => {
    expect(ArPracticeFileSchema.safeParse({ ...valid, validatedBy: 'Director' }).success).toBe(
      false,
    );
    expect(ArPracticeFileSchema.safeParse({ ...valid, validatedAt: '2026-11-07' }).success).toBe(
      false,
    );
    expect(
      ArPracticeFileSchema.safeParse({
        ...valid,
        validatedBy: 'Director',
        validatedAt: '2026-11-07',
      }).success,
    ).toBe(true);
  });

  it('solo acepta una decisión elegida entre las opciones', () => {
    const decision = { id: 'd', question: 'q', proposed: 'p', alternatives: ['a'] };
    expect(
      ArPracticeFileSchema.safeParse({ ...valid, decisions: [{ ...decision, chosen: 'b' }] })
        .success,
    ).toBe(false);
    expect(
      ArPracticeFileSchema.safeParse({ ...valid, decisions: [{ ...decision, chosen: 'a' }] })
        .success,
    ).toBe(true);
  });

  it('no repite decisiones', () => {
    const decision = { id: 'd', question: 'q', proposed: 'p', alternatives: ['a'] };
    expect(ArPracticeFileSchema.safeParse({ ...valid, decisions: [decision] }).success).toBe(true);
    expect(
      ArPracticeFileSchema.safeParse({ ...valid, decisions: [decision, decision] }).success,
    ).toBe(false);
  });

  it('la práctica AR v2 cubre todos los pasos del protocolo', () => {
    const pasos = BataPasosSchema.parse(readJson('protocolos/bata-pasos.json'));
    const practice = ArPracticeFileSchema.parse(readJson('protocolos/ar-practica-v2.json'));
    const donning = new Set(pasos.donning.map((donningStep) => donningStep.id));
    const covered = new Set<string>();
    for (const practiceStep of practice.steps) {
      for (const id of practiceStep.donningIds) {
        expect(donning.has(id), `${practiceStep.id} referencia ${id}`).toBe(true);
        covered.add(id);
      }
    }
    for (const id of donning) expect(covered.has(id), `falta cubrir ${id}`).toBe(true);
  });
});

describe('esquemas de API', () => {
  it('DONNING_STEP_IDS sigue el orden de content/protocolos/bata-pasos.json', () => {
    const pasos = BataPasosSchema.parse(readJson('protocolos/bata-pasos.json'));
    const ordered = [...pasos.donning].sort((a, b) => a.order - b.order).map((s) => s.id);
    expect(ordered).toEqual([...DONNING_STEP_IDS]);
  });

  it('PracticeCompleteRequest exige los 6 pasos en orden y nada más', () => {
    const ok = { protocol: 'donning', stepIds: [...DONNING_STEP_IDS] };
    expect(PracticeCompleteRequestSchema.safeParse(ok).success).toBe(true);
    expect(
      PracticeCompleteRequestSchema.safeParse({ ...ok, stepIds: [...DONNING_STEP_IDS].reverse() })
        .success,
    ).toBe(false);
    expect(
      PracticeCompleteRequestSchema.safeParse({ ...ok, stepIds: DONNING_STEP_IDS.slice(0, 5) })
        .success,
    ).toBe(false);
    expect(PracticeCompleteRequestSchema.safeParse({ ...ok, xp: 999 }).success).toBe(false);
  });

  it('CreateProfile exige el consentimiento vigente', () => {
    const base = {
      displayName: 'Laura',
      consent: { policyVersion: POLICY_VERSION, accepted: true },
    };
    expect(CreateProfileSchema.safeParse(base).success).toBe(true);
    expect(
      CreateProfileSchema.safeParse({
        ...base,
        consent: { policyVersion: '2020-01-01', accepted: true },
      }).success,
    ).toBe(false);
    expect(CreateProfileSchema.safeParse({ ...base, groupCode: 'abc' }).success).toBe(false);
  });

  it('ChatRequest exige que el último mensaje sea del usuario', () => {
    expect(
      ChatRequestSchema.safeParse({ messages: [{ role: 'user', content: 'Hola' }] }).success,
    ).toBe(true);
    expect(
      ChatRequestSchema.safeParse({ messages: [{ role: 'assistant', content: 'Hola' }] }).success,
    ).toBe(false);
  });

  it('StreamEvent discrimina por type', () => {
    expect(StreamEventSchema.safeParse({ type: 'done', latencyMs: 12 }).success).toBe(true);
    expect(StreamEventSchema.safeParse({ type: 'error', code: 'NOPE' }).success).toBe(false);
  });

  it('messageForStatus devuelve los textos del contrato', () => {
    expect(messageForStatus(401)).toBe('Tu sesión expiró, vuelve a iniciar sesión');
    expect(messageForStatus(502)).toBe(
      'Algo falló en el servidor. Intenta de nuevo en unos minutos.',
    );
    expect(messageForStatus(418)).toBe('Ocurrió un error inesperado.');
  });
});
