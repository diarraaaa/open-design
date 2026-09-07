import { runShellFileCommand } from "../src/adapters/tools/file-command.ts";
import { parseElectronSceneManifestRequest, executeElectronManifest } from "../src/adapters/tools/manifests.ts";

await runShellFileCommand(parseElectronSceneManifestRequest, executeElectronManifest);
