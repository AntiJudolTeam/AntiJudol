import { MAX_FIELD_LENGTH } from "../config.js";

/**
 * Coerce a request body field to a bounded string.
 * Returns "" for any non-string input — callers must not assume their input shape.
 */
export function asString(value, max = MAX_FIELD_LENGTH) {
  if (value == null || typeof value !== "string") return "";
  return value.length > max ? value.slice(0, max) : value;
}

export function asNumberOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
