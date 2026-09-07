import { runShellFileCommand } from "../src/adapters/tools/file-command.ts";
import { parseElectronRuntimeLifecycleRequest, executeElectronRuntimeLifecycle } from "../src/adapters/tools/runtime-tool.ts";

await runShellFileCommand(parseElectronRuntimeLifecycleRequest, executeElectronRuntimeLifecycle);
