import type { GhostSkeleton, JointStatus } from './pose-targets.ts';
import type { Vec } from './posture.ts';

export interface AssistColors {
  ghost: string;
  ok: string;
  near: string;
  far: string;
  ring: string;
  track: string;
  outline: string;
}

export function drawGhost(
  ctx: CanvasRenderingContext2D,
  skeleton: GhostSkeleton,
  colors: AssistColors,
  alpha = 0.35,
): void {
  ctx.save();
  ctx.globalAlpha *= Math.min(1, Math.max(0, alpha));
  ctx.strokeStyle = colors.ghost;
  ctx.fillStyle = colors.ghost;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = skeleton.limbWidth;
  ctx.beginPath();
  for (const [from, to] of skeleton.bones) {
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
  }
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(skeleton.points.head.x, skeleton.points.head.y, skeleton.headRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawJointStatus(
  ctx: CanvasRenderingContext2D,
  statuses: readonly JointStatus[],
  colors: AssistColors,
  scale: number,
): void {
  const unit = Math.max(0, scale);
  ctx.save();
  ctx.lineCap = 'round';
  for (const joint of statuses) {
    ctx.fillStyle = colors[joint.status];
    ctx.strokeStyle = colors.outline;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(joint.current.x, joint.current.y, 5 * unit, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (joint.status === 'ok' || !joint.arrow) continue;
    const length = Math.min(
      48 * unit,
      Math.hypot(joint.target.x - joint.current.x, joint.target.y - joint.current.y),
    );
    const end = {
      x: joint.current.x + joint.arrow.x * length,
      y: joint.current.y + joint.arrow.y * length,
    };
    const head = Math.min(8 * unit, length / 3);
    ctx.strokeStyle = colors[joint.status];
    ctx.lineWidth = 2 * unit;
    ctx.beginPath();
    ctx.moveTo(joint.current.x, joint.current.y);
    ctx.lineTo(end.x, end.y);
    ctx.moveTo(
      end.x - joint.arrow.x * head - joint.arrow.y * head * 0.6,
      end.y - joint.arrow.y * head + joint.arrow.x * head * 0.6,
    );
    ctx.lineTo(end.x, end.y);
    ctx.lineTo(
      end.x - joint.arrow.x * head + joint.arrow.y * head * 0.6,
      end.y - joint.arrow.y * head - joint.arrow.x * head * 0.6,
    );
    ctx.stroke();
  }
  ctx.restore();
}

export function drawHoldRing(
  ctx: CanvasRenderingContext2D,
  center: Vec,
  radius: number,
  progress: number,
  colors: AssistColors,
): void {
  ctx.save();
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.strokeStyle = colors.track;
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  const amount = Math.min(1, Math.max(0, progress));
  if (amount > 0) {
    ctx.strokeStyle = colors.ring;
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, -Math.PI / 2, -Math.PI / 2 + amount * Math.PI * 2, false);
    ctx.stroke();
  }
  ctx.restore();
}
