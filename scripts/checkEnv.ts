import fs from "fs";
import path from "path";
import { getAddress, isAddress } from "ethers";

type EnvRecord = Record<string, string>;

const REQUIRED_KEYS = [
  "ARC_RPC_URL",
  "ARC_CHAIN_ID",
  "ARC_EXPLORER_BASE",
  "USDC_ADDRESS",
  "USDC_DECIMALS",
  "SERVICE_PRIVATE_KEY",
  "MERCHANT_ADDRESS",
  "CIRCLE_API_BASE",
  "CIRCLE_API_KEY",
  "BRIDGE_ENV",
] as const;

const envPath = path.resolve(process.cwd(), ".env.local");

function parseEnvFile(contents: string): EnvRecord {
  const map: EnvRecord = {};
  const lines = contents.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    value = value.replace(/\s+#.*$/, "").trim();

    map[key] = value;
  }

  return map;
}

function formatKey(key: string) {
  return `• ${key}`;
}

function ensureEnvRecord(): { env: EnvRecord; original: string } {
  if (!fs.existsSync(envPath)) {
    console.warn(
      "[env:check] No .env.local found. Create one to configure the app.",
    );
    return { env: {}, original: "" };
  }
  const raw = fs.readFileSync(envPath, "utf8");
  return { env: parseEnvFile(raw), original: raw };
}

function ensureNextPublicExplorer(
  env: EnvRecord,
  originalContents: string,
): { updated: boolean; contents: string } {
  if (env.NEXT_PUBLIC_ARC_EXPLORER_BASE) {
    return { updated: false, contents: originalContents };
  }

  const base = env.ARC_EXPLORER_BASE;
  if (!base) {
    return { updated: false, contents: originalContents };
  }

  const trimmed = base.replace(/\/$/, "");
  env.NEXT_PUBLIC_ARC_EXPLORER_BASE = trimmed;

  const needsNewline =
    originalContents.length > 0 && !originalContents.endsWith("\n");
  const appended =
    (needsNewline ? `${originalContents}\n` : originalContents) +
    `NEXT_PUBLIC_ARC_EXPLORER_BASE=${trimmed}\n`;

  fs.writeFileSync(envPath, appended, "utf8");
  console.log(
    `[env:check] NEXT_PUBLIC_ARC_EXPLORER_BASE was missing. Added from ARC_EXPLORER_BASE (${trimmed}).`,
  );
  return { updated: true, contents: appended };
}

function validateAddress(key: string, value: string | undefined, warnings: string[]) {
  if (!value) return;
  if (!isAddress(value)) {
    warnings.push(
      `${key} is not a valid address: ${value}`,
    );
    return;
  }
  const checksum = getAddress(value);
  if (checksum !== value) {
    warnings.push(
      `${key} is not checksummed. Suggested value: ${checksum}`,
    );
  }
}

function validateNumeric(
  key: string,
  value: string | undefined,
  warnings: string[],
) {
  if (!value) return;
  const num = Number(value);
  if (!Number.isFinite(num)) {
    warnings.push(`${key} must be numeric. Received: ${value}`);
  }
}

function validatePrivateKey(value: string | undefined, warnings: string[]) {
  if (!value) return;
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    warnings.push(
      "SERVICE_PRIVATE_KEY should be 32-byte hex string prefixed with 0x.",
    );
  }
}

function run(): void {
  const missingKeys: string[] = [];
  const warnings: string[] = [];

  const { env, original } = ensureEnvRecord();
  ensureNextPublicExplorer(env, original);

  for (const key of REQUIRED_KEYS) {
    if (!env[key]) {
      missingKeys.push(key);
    }
  }

  if (missingKeys.length > 0) {
    console.warn(
      "[env:check] Missing environment variables:\n" +
        missingKeys.map(formatKey).join("\n"),
    );
  }

  validateAddress("USDC_ADDRESS", env.USDC_ADDRESS, warnings);
  validateAddress("MERCHANT_ADDRESS", env.MERCHANT_ADDRESS, warnings);
  validatePrivateKey(env.SERVICE_PRIVATE_KEY, warnings);
  validateNumeric("ARC_CHAIN_ID", env.ARC_CHAIN_ID, warnings);
  validateNumeric("USDC_DECIMALS", env.USDC_DECIMALS, warnings);

  if (env.ARC_RPC_URL && !/^https?:\/\//i.test(env.ARC_RPC_URL)) {
    warnings.push("ARC_RPC_URL should start with http:// or https://");
  }

  if (warnings.length > 0) {
    console.warn(
      "[env:check] Warnings:\n" + warnings.map(formatKey).join("\n"),
    );
  } else {
    console.log("[env:check] Environment looks good ✅");
  }
}

run();
