import { rmSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const targets = ["dist", ".output", ".tanstack"];

for (const target of targets) {
  rmSync(resolve(root, target), { force: true, recursive: true });
}
