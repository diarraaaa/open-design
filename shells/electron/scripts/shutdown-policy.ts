import { standaloneHostControlRequestTimeoutMs } from "@open-design/standalone";
import runtime from "../config/runtime.json" with { type: "json" };

// The outer process must outlive its bounded host release and physical cleanup.
const termGraceMs = runtime.shutdown.gracefulTimeoutMs;
if (!Number.isSafeInteger(termGraceMs) || termGraceMs <= standaloneHostControlRequestTimeoutMs({ operation: "lifecycle.release" })) {
  throw new Error("Electron graceful shutdown budget must exceed its host release budget");
}
export const electronGracefulStopOptions = Object.freeze({ termGraceMs });
