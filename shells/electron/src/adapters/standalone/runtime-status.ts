import type { LifecycleStatus, StandaloneRuntimeStatus } from "@open-design/standalone";

/** A live shared host is not proof that this Shell still owns an attachment. */
export function projectElectronRuntimeStatus(status: LifecycleStatus, bindingDigest: string, generationId: string, attachmentId?: string): StandaloneRuntimeStatus {
  const revoked = attachmentId != null && status.state === "running"
    && (status.bindingDigest !== bindingDigest || status.generationId !== generationId
      || !status.occupants.some((occupant) => occupant.attachmentId === attachmentId));
  return Object.freeze({
    bindingDigest, generationId, instanceId: status.instanceId ?? `stopped-${status.fence}`,
    references: status.references, state: revoked ? "failed" : status.state,
  });
}
