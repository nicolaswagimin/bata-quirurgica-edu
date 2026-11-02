// Draws the live guides of the posture feedback: the waist line and a ring on each tracked wrist,
// both turning to the danger colour while a warning is active. Takes the context as a parameter.
import { type BodyFrame, type Violation, waistLine } from './posture.ts';

type GuideContext = Pick<
  CanvasRenderingContext2D,
  'beginPath' | 'moveTo' | 'lineTo' | 'stroke' | 'arc' | 'setLineDash'
> & {
  strokeStyle: CanvasRenderingContext2D['strokeStyle'];
  lineWidth: number;
  globalAlpha: number;
};

export interface GuideColors {
  line: string;
  danger: string;
}

export function drawPostureGuides(
  ctx: GuideContext,
  frame: BodyFrame | null,
  active: ReadonlySet<Violation>,
  colors: GuideColors,
): void {
  if (!frame) return;
  const scale = frame.shoulderWidth / 200;
  const [a, b] = waistLine(frame);
  ctx.globalAlpha = 0.9;
  ctx.setLineDash([12 * scale, 8 * scale]);
  ctx.lineWidth = Math.max(2, 3 * scale);
  ctx.strokeStyle = active.has('bajo-cintura') ? colors.danger : colors.line;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.setLineDash([]);
  const warn = active.size > 0;
  for (const limb of [frame.left, frame.right]) {
    if (!limb.wrist) continue;
    ctx.strokeStyle = warn ? colors.danger : colors.line;
    ctx.lineWidth = Math.max(2, (warn ? 5 : 3) * scale);
    ctx.beginPath();
    ctx.arc(limb.wrist.x, limb.wrist.y, 16 * scale, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
