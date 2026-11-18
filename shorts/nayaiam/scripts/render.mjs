// usage: node scripts/render.mjs <out.mp4> [scale] [from-to] [concurrency]
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
const [out, scale = "1", range, conc = "2"] = process.argv.slice(2);
const browserExecutable = process.env.CHROME || "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome";
const chromiumOptions = { gl: process.env.GL || "swangle" };
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
const composition = await selectComposition({ serveUrl, id: "NayaiamShort", browserExecutable, chromiumOptions, timeoutInMilliseconds: 600000 });
const frameRange = range ? range.split("-").map(Number) : null;
const t0 = Date.now();
let last = 0;
await renderMedia({
  composition, serveUrl, codec: "h264", crf: 16, outputLocation: out, scale: Number(scale), browserExecutable, chromiumOptions,
  concurrency: Number(conc), timeoutInMilliseconds: 600000, frameRange, muted: true,
  onProgress: ({ renderedFrames, progress }) => {
    if (renderedFrames - last >= 10 || progress === 1) {
      last = renderedFrames;
      const s = (Date.now() - t0) / 1000;
      console.log(`frames ${renderedFrames}  ${(progress * 100).toFixed(1)}%  ${s.toFixed(0)}s  ${(renderedFrames / s).toFixed(2)} fps`);
    }
  },
});
console.log("done", out, ((Date.now() - t0) / 1000).toFixed(0) + "s");
process.exit(0);
