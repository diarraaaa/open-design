import { runShellFileCommand } from "../src/adapters/tools/file-command.ts";
import { parseElectronExactSceneRequest } from "../src/adapters/tools/exact-contract.ts";
import { executeElectronExactScene } from "../src/adapters/tools/scene-tool.ts";

await runShellFileCommand(parseElectronExactSceneRequest, executeElectronExactScene);
