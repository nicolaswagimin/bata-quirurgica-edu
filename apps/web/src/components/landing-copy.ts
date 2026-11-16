export const LANDING_COPY = {
  title: 'Domina la bata quirúrgica, misión a misión',
  intro:
    'Misiones cortas, práctica en 3D y con tu cámara, y respuestas con la norma citada. Para estudiantes y personal de salud en Colombia.',
  virtual: 'La Dra. Menta es un personaje virtual.',
  create: 'Crear cuenta',
  login: 'Ya tengo cuenta',
  learn: 'Qué vas a aprender',
  how: 'Cómo funciona',
  sources: 'Basado en fuentes',
  faq: 'Preguntas frecuentes',
  sourceIntro: 'El contenido se apoya en documentos públicos:',
  sourceList: [
    'Guías globales de la OMS para la prevención de la infección del sitio quirúrgico (2018).',
    'Resolución 3100 de 2019 del Ministerio de Salud y Protección Social (habilitación de servicios de salud).',
  ],
  sourceNote:
    'El contenido está en revisión docente. Es material de estudio: no reemplaza el criterio de tu profesor ni el protocolo de tu institución.',
  finalTitle: '¿Empezamos?',
  finalText: 'Tu primera misión toma unos minutos.',
  privacy: 'Lee la política de tratamiento de datos',
  dialogueLabel: 'Presentación de la Dra. Menta',
  signature: '— Dra. Menta',
  next: 'Siguiente',
  skip: 'Saltar',
  restart: 'Volver a empezar',
  transcript: 'Leer todo el diálogo',
  back: 'Volver a la Dra. Menta',
} as const;

export const DIALOGUE_LINES = [
  '¡Hola! Soy la Dra. Menta, instrumentadora quirúrgica. Te acompaño a dominar la bata estéril.',
  'Esta app es para estudiantes y personal de salud en Colombia que se ponen bata y guantes sin romper la esterilidad.',
  'Aprendes con misiones cortas: cada respuesta trae su explicación y la norma que la respalda.',
  'Luego practicas con el cuerpo: un maniquí en 3D paso a paso y un espejo con tu cámara, que nunca sale de tu navegador.',
  'Gana XP, sostén tu racha y sube en el ranking de tu grupo. ¿Empezamos?',
] as const;

export const LEARN_ITEMS = [
  {
    sprite: 'gown',
    title: 'Bata estéril',
    text: 'Cómo tomarla por dentro, desplegarla y ponértela sin que el frente toque nada no estéril.',
  },
  {
    sprite: 'zone',
    title: 'Zona estéril',
    text: 'Qué partes de la bata cuentan como estériles: el frente, del pecho al nivel del campo, y las mangas hasta el puño.',
  },
  {
    sprite: 'gloves',
    title: 'Técnica cerrada de guantes',
    text: 'Calzarte los guantes sin que tus manos salgan de los puños de la bata.',
  },
] as const;

export const HOW_ITEMS = [
  {
    sprite: 'TROPHY',
    title: 'Misiones con XP y ranking',
    text: 'Preguntas cortas con explicación y fuente. Apruebas con 60 %, ganas XP, mantienes tu racha y subes en el ranking global o de tu grupo.',
  },
  {
    sprite: 'CUBE_3D',
    title: 'Bata en 3D paso a paso',
    text: 'Un maniquí te muestra cada paso de la colocación; lo giras y avanzas a tu ritmo.',
  },
  {
    sprite: 'MIRROR',
    title: 'Espejo con tu cámara',
    text: 'Ves la bata sobre tu cuerpo y practicas los pasos frente a la cámara. Las imágenes se procesan en tu navegador y no se envían a ningún servidor.',
  },
  {
    sprite: 'PLAY',
    title: 'Lecciones con video',
    text: 'Cada misión tiene su lección: explicación breve, ilustraciones y videos cortos del procedimiento.',
  },
  {
    sprite: 'ASK_BUBBLE',
    title: 'Asistente que cita la norma',
    text: 'Pregúntale por texto o por voz; responde con base en las guías cargadas y te dice de dónde sale cada dato.',
  },
] as const;

export const FAQ_ITEMS = [
  {
    question: '¿Es gratis?',
    answer: 'Sí. Es un proyecto académico (trabajo de grado) y no tiene pagos.',
  },
  {
    question: '¿Funciona en el celular?',
    answer:
      'Sí. Está pensada primero para el celular y funciona en el navegador, sin instalar nada. Si tu equipo va lento en el espejo con cámara, te sugiere el modo 3D.',
  },
  {
    question: '¿La cámara envía imágenes?',
    answer:
      'No. El espejo procesa la cámara en tu navegador; ninguna imagen ni video sale de tu equipo ni se guarda.',
  },
  {
    question: '¿Qué datos se guardan?',
    answer:
      'Tu nombre visible, correo, rol, grupo, XP, nivel, racha y tus respuestas a los cuestionarios. Las conversaciones con el asistente no se guardan.',
    privacy: true,
  },
] as const;
