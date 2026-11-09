// Generate with Prisma's WASM schema parser. The CLI eagerly downloads the
// unused native migration engine; SQL migrations here use Node's SQLite driver.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
import internals from "@prisma/internals";
const { getGenerators } = internals;
import { copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
// The standalone generator expects the CLI's bundled WASM beside its entrypoint.
copyFileSync(
  join(
    dirname(require.resolve("prisma/package.json")),
    "build/prisma_schema_build_bg.wasm",
  ),
  join(
    dirname(require.resolve("@prisma/client/generator-build/index.js")),
    "prisma_schema_build_bg.wasm",
  ),
);

const generators = await getGenerators({
  schemaPath: "prisma/schema.prisma",
  skipDownload: true,
  registry: {
    "prisma-client-js": {
      type: "rpc",
      generatorPath: require.resolve("@prisma/client/generator-build/index.js"),
      isNode: true,
    },
  },
});
try {
  for (const generator of generators) await generator.generate();
} finally {
  for (const generator of generators) generator.stop();
}
console.log("Prisma JavaScript client generated.");
