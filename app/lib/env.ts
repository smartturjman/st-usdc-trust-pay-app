export function readEnv(name: string, fallback?: string) {
  const v = process.env[name];
  return typeof v === "string" && v.length > 0 ? v : fallback ?? "";
}
