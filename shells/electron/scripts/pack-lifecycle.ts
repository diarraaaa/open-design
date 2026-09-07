import { runShellFileCommand } from "../src/adapters/tools/file-command.ts";
import { parseElectronPackRequest, executeElectronPack } from "../src/adapters/tools/pack-tool.ts";

await runShellFileCommand(parseElectronPackRequest, executeElectronPack);
