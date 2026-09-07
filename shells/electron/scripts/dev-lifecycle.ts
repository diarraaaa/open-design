import { runShellFileCommand } from "../src/adapters/tools/file-command.ts";
import { parseElectronDevLifecycleRequest, executeElectronDevLifecycle } from "../src/adapters/tools/dev-tool.ts";

await runShellFileCommand(parseElectronDevLifecycleRequest, executeElectronDevLifecycle);
