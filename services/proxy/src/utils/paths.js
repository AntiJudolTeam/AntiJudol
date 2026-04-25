import path from "node:path";
import { fileURLToPath } from "node:url";

// services/proxy/src/utils/paths.js → services/proxy
export const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export const PUBLIC_DIR = path.join(PROJECT_ROOT, "public");
export const DATA_DIR = path.join(PROJECT_ROOT, "data");
export const LOG_DIR = path.join(PROJECT_ROOT, "logs");

export function resolveFromRoot(relPath) {
  return path.isAbsolute(relPath) ? relPath : path.resolve(PROJECT_ROOT, relPath);
}
