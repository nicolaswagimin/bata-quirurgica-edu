import { ArPracticeFileSchema } from '@bata/shared/schemas';
import practiceJson from '../../../../content/protocolos/ar-practica-v3.json';

/** Validate the read-only protocol at the boundary, retaining its clinical review note. */
export function buildDonningV2(input: unknown) {
  const protocol = ArPracticeFileSchema.parse(input);
  const steps = protocol.steps
    .filter((step) => step.kind !== 'mask')
    .sort((a, b) => a.order - b.order)
    .map((step, index) => ({
      n: index + 1,
      title: step.title,
      action: step.action,
      look: step.look,
      modelUrl: `/models/v2/paso-${index + 1}.glb`,
    }));
  return { reviewNote: protocol.reviewNote, status: protocol.status, steps };
}

export const donningV2 = buildDonningV2(practiceJson);
