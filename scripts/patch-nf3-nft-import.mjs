import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const traceFile = join(root, "node_modules", "nf3", "dist", "_chunks", "trace.mjs");

const incompatibleImport = 'import { nodeFileTrace } from "@vercel/nft";';
const compatibleImport = 'import __nftPkg from "@vercel/nft"; const { nodeFileTrace } = __nftPkg;';

try {
  const source = await readFile(traceFile, "utf8");

  if (!source.includes(incompatibleImport)) {
    process.exit(0);
  }

  await writeFile(traceFile, source.replace(incompatibleImport, compatibleImport));
  console.log("Patched nf3 @vercel/nft import for Render.");
} catch (error) {
  if (error?.code === "ENOENT") {
    process.exit(0);
  }

  throw error;
}
