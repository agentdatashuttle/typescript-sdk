// tsup.config.ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  minify: true,
  banner: {
    js: "// Agent Data Shuttle (ADS) - https://agentdatashuttle.knowyours.co",
  },
});
