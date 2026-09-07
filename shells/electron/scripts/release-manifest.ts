import { runShellFileCommand } from "../src/adapters/tools/file-command.ts";
import { parseElectronReleaseManifestRequest, executeElectronManifest } from "../src/adapters/tools/manifests.ts";

await runShellFileCommand(parseElectronReleaseManifestRequest, executeElectronManifest);
