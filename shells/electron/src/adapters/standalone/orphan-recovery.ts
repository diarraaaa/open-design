import { findSidecarProcesses, type SidecarStamp } from "@open-design/sidecar/authority";
import { StandaloneHostLifecycle, type LifecycleScope, type StandaloneHostLifecycleLedger } from "@open-design/standalone";
import type { ElectronPhysicalResourceSetGuard } from "./guarded-lifecycle.js";

/** No host may write the ledger while its orphaned resource set is reconciled. */
export async function retireElectronOrphanedRuntime(input: Readonly<{
  stamp: SidecarStamp;
  scope: LifecycleScope;
  ledger: StandaloneHostLifecycleLedger;
  guard: ElectronPhysicalResourceSetGuard;
}>): Promise<boolean> {
  if ((await findSidecarProcesses(input.stamp)).length !== 0) return false;
  await input.guard.retire();
  // Installer/content reservations retain their explicit recovery authority.
  // Physical absence does not authorize abandoning a durable transition.
  if ((await input.ledger.readOrInitial()).transition == null) {
    const continuation = new StandaloneHostLifecycle(input.scope, { statePort: input.ledger });
    const status = await continuation.status();
    if (status.state !== "stopped") await continuation.stop(status.fence);
  }
  return true;
}
