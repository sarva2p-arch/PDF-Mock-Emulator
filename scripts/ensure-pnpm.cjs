const fs = require("node:fs");

for (const file of ["package-lock.json", "yarn.lock"]) {
  try {
    fs.rmSync(file, { force: true });
  } catch {
    // Best effort cleanup only.
  }
}

const packageManagerInfo = [
  process.env.npm_config_user_agent,
  process.env.npm_execpath,
  process.env.npm_command,
]
  .filter(Boolean)
  .join(" ")
  .toLowerCase();

if (packageManagerInfo && !packageManagerInfo.includes("pnpm")) {
  console.error("Use pnpm instead");
  process.exit(1);
}
