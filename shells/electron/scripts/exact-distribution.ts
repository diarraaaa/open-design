import { runShellFileCommand } from "../src/adapters/tools/file-command.ts";
import { parseElectronExactDistributionRequest } from "../src/adapters/tools/exact-contract.ts";
import { executeElectronExactDistribution } from "../src/adapters/tools/distribution-tool.ts";

await runShellFileCommand(parseElectronExactDistributionRequest, executeElectronExactDistribution);
