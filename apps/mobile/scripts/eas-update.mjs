import { spawnSync } from "node:child_process";

const TARGETS = {
  staging: {
    branch: "staging",
    apiUrl: "https://erp-demo-api.ghinamultiprima.co.id/api",
  },
  production: {
    branch: "production",
    apiUrl: "https://akuntra-api.ghinamultiprima.co.id/api",
  },
};

const envName = process.argv[2] || "staging";
const target = TARGETS[envName];
if (!target) {
  console.error(`Target tidak dikenal: "${envName}". Gunakan "staging" atau "production".`);
  process.exit(1);
}

const extraArgs = process.argv.slice(3).filter((arg) => arg !== "--");
const hasMessage = extraArgs.some((arg) => arg === "-m" || arg === "--message" || arg === "--auto");
const cmdArgs = [
  "eas-cli",
  "update",
  "--branch",
  target.branch,
  "--platform",
  "android",
  ...(hasMessage ? [] : ["--auto"]),
  ...extraArgs,
];

const isWin = process.platform === "win32";
const safeArgs = isWin
  ? cmdArgs.map((a) => (/[\s"&|<>^()]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a))
  : cmdArgs;

const res = spawnSync("npx", safeArgs, {
  stdio: "inherit",
  shell: isWin,
  env: {
    ...process.env,
    EXPO_PUBLIC_API_URL: target.apiUrl,
  },
});

process.exit(res.status ?? 1);
