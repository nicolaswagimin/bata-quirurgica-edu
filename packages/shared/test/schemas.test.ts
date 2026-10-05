import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BataPasosSchema,
  ChatRequestSchema,
  CreateProfileSchema,
  CreditsSchema,
  KbSourcesSchema,
  messageForStatus,
  POLICY_VERSION,
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
    ['credits.json', CreditsSchema],
    ['kb/sources.json', KbSourcesSchema],
    ['legal/privacidad.json', PrivacyPolicySchema],
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

describe('esquemas de API', () => {
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
