import { appendLogLine, dailyLogPath, sanitizeForLog, timeString } from "./logFile.js";

export function logFeedback({ donator, message, decision, verdict }) {
  const line = `[${timeString()}] [${decision}] [${verdict}] ${sanitizeForLog(donator)} :: ${sanitizeForLog(message)}`;
  appendLogLine(dailyLogPath("feedback"), line);
}
