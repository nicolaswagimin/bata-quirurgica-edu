// Contrato de percepción del AR v2: lo comparten el extractor de la web, el grabador de capturas y
// el validador de `tools/vision/`. Cambiar el orden o el significado de un campo exige subir
// PERCEPTION_VERSION y volver a validar las tomas existentes.
import { z } from 'zod';

/** Versión del formato de captura y de las features. */
export const PERCEPTION_VERSION = 1 as const;

/**
 * Puntos del cuerpo en el orden fijo de cada frame (índices de MediaPipe Pose en el extractor).
 * `x` e `y` van en anchos de hombros, con origen en el punto medio de los hombros, `x` a lo largo
 * de la línea de hombros y `y` hacia las caderas.
 */
export const BODY_POINTS = [
  'nose',
  'leftShoulder',
  'rightShoulder',
  'leftElbow',
  'rightElbow',
  'leftWrist',
  'rightWrist',
  'leftHip',
  'rightHip',
  'leftKnee',
  'rightKnee',
  'leftAnkle',
  'rightAnkle',
] as const;
export type BodyPoint = (typeof BODY_POINTS)[number];
export const BODY_POINT_COUNT = BODY_POINTS.length;

/** MediaPipe Hands devuelve 21 puntos por mano; se reserva el sitio antes de activarlo. */
export const HAND_POINT_COUNT = 21;

export const FeaturePointSchema = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
    /** Profundidad aproximada de MediaPipe, también en anchos de hombros. */
    z: z.number().finite(),
    /** 0 = ocluido; el modelo debe ignorar el punto. */
    visibility: z.number().min(0).max(1),
  })
  .strict();
export type FeaturePoint = z.infer<typeof FeaturePointSchema>;

export const VelocitySchema = z
  .object({ x: z.number().finite(), y: z.number().finite() })
  .strict();
export type Velocity = z.infer<typeof VelocitySchema>;

/** Ángulos en radianes; `-1` significa "no disponible" porque falta un landmark. */
export const AnglesSchema = z
  .object({
    leftElbow: z.number().finite(),
    rightElbow: z.number().finite(),
    leftShoulder: z.number().finite(),
    rightShoulder: z.number().finite(),
    /** Inclinación del eje del torso respecto a la vertical de la imagen, en radianes. */
    torsoTilt: z.number().finite(),
  })
  .strict();
export type Angles = z.infer<typeof AnglesSchema>;

/** Marco del torso en píxeles de la imagen original; sirve para reconstruir y depurar. */
export const TorsoSchema = z
  .object({
    centerX: z.number().finite(),
    centerY: z.number().finite(),
    shoulderWidth: z.number().positive(),
    torsoHeight: z.number().positive(),
    /** Ángulo de la línea de hombros (derecha → izquierda) en radianes. */
    angleRad: z.number().finite(),
  })
  .strict();
export type Torso = z.infer<typeof TorsoSchema>;

export const HandFrameSchema = z
  .object({
    side: z.enum(['left', 'right']),
    points: z.array(FeaturePointSchema).length(HAND_POINT_COUNT),
  })
  .strict();
export type HandFrame = z.infer<typeof HandFrameSchema>;

export const FeatureFrameSchema = z
  .object({
    /** Milisegundos desde el inicio de la toma. */
    t: z.number().min(0),
    points: z.array(FeaturePointSchema).length(BODY_POINT_COUNT),
    velocities: z.array(VelocitySchema).length(BODY_POINT_COUNT),
    angles: AnglesSchema,
    torso: TorsoSchema,
    /** Vacío hasta activar MediaPipe Hands; el esquema ya reserva hasta dos manos. */
    hands: z.array(HandFrameSchema).max(2).default([]),
  })
  .strict();
export type FeatureFrame = z.infer<typeof FeatureFrameSchema>;

/** Una toma de captura: ventana corta de features con la etiqueta del paso. */
export const CaptureTakeSchema = z
  .object({
    version: z.literal(PERCEPTION_VERSION),
    /** Id del paso de `juegoAr` que se estaba practicando. */
    label: z.string().min(1).max(64),
    source: z.literal('ar-espejo'),
    capturedAt: z.iso.datetime(),
    durationMs: z.number().min(0),
    sampleHz: z.number().min(1).max(60),
    frames: z.array(FeatureFrameSchema).min(1),
  })
  .strict();
export type CaptureTake = z.infer<typeof CaptureTakeSchema>;
