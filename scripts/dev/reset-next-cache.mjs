import fs from "node:fs/promises";
import path from "node:path";

const target = path.resolve(process.cwd(), ".next");

try {
  const stat = await fs.lstat(target);

  if (!stat.isDirectory()) {
    console.log(`skipped ${target} (not a directory)`);
    process.exit(0);
  }

  await fs.rm(target, { recursive: true, force: true });
  console.log(`removed ${target}`);
} catch (error) {
  if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
    console.log(`skipped ${target} (missing)`);
    process.exit(0);
  }

  throw error;
}
