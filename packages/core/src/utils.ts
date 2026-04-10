import { createHash } from "node:crypto";

export const nowIso = (): string => new Date().toISOString();

export const normalizeWhitespace = (value: string | null | undefined): string =>
  (value ?? "").replace(/\s+/g, " ").trim();

export const hashObject = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

export const toBoolean = (value: string | boolean | undefined): boolean => {
  if (typeof value === "boolean") {
    return value;
  }

  return String(value).toLowerCase() === "true";
};

export const safeCell = (cells: string[], index: number): string => cells[index] ?? "";

export const splitRequester = (value: string): { requesterName: string; requesterOrg: string } => {
  const [requesterName, requesterOrg] = value.split("|").map((part) => normalizeWhitespace(part));
  return {
    requesterName,
    requesterOrg
  };
};
