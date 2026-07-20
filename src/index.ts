export { PACKAGE_VERSION, LOCKFILE_FILENAME, CONFIG_FILENAME } from "./types/constants.js";
export {
  ConfigSchema,
  LockfileSchema,
  RegistrySnapshotSchema,
  ExitCode,
  ConfidenceSchema,
} from "./types/schemas.js";
export type {
  Config,
  Lockfile,
  RegistrySnapshot,
  DetectedDependency,
  PolicyFinding,
  Confidence,
} from "./types/schemas.js";
export { loadConfig, defaultConfig, configToYaml } from "./config/load.js";
export { discoverDependencies } from "./discover/index.js";
export { evaluatePolicy } from "./policy/engine.js";
export { diffLockfileToRegistry } from "./diff/index.js";
export { generateLockfile, readLockfile, writeLockfile } from "./lockfile/io.js";
export { loadCurrentRegistry, loadRegistrySnapshot } from "./registry/load.js";
export { mergeSourceResults } from "./sources/merge.js";
export { modelsDevAdapter } from "./sources/models-dev.js";
export { deprecationsInfoAdapter } from "./sources/deprecations-info.js";
export { officialProviderAdapter } from "./sources/official-provider.js";
export { canonicalize, digestJson, sha256 } from "./util/canonical.js";
export { sanitizeForPrint } from "./sanitize/index.js";
export { cmdInit, cmdScan, cmdCheck, cmdUpdate, cmdExplain, cmdValidate } from "./commands.js";
export { createProgram, runCli } from "./cli.js";
