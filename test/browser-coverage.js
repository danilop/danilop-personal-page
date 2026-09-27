const fs = require("node:fs/promises");
const path = require("node:path");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
// Attribute Chromium coverage only to byte-identical source or verified source maps.
async function browserCoverage(page, resolveSource) {
  const session = await page.context().newCDPSession(page);
  await session.send("Debugger.enable");
  await session.send("Profiler.enable");
  await session.send("Profiler.startPreciseCoverage", {
    callCount: true,
    detailed: true,
  });
  return async () => {
    const { result } = await session.send("Profiler.takePreciseCoverage");
    if (!process.env.NODE_V8_COVERAGE) return;
    const scripts = [],
      maps = {};
    for (const entry of result) {
      const file = resolveSource(entry.url);
      if (!file) continue;
      const url = pathToFileURL(file).href;
      const { scriptSource } = await session.send("Debugger.getScriptSource", {
        scriptId: entry.scriptId,
      });
      const inline = scriptSource.match(
        /sourceMappingURL=data:application\/json[^,]*;base64,([^\s]+)/,
      );
      if (inline) {
        const data = JSON.parse(Buffer.from(inline[1], "base64").toString());
        for (let i = 0; i < data.sources.length; i++) {
          const source = path.resolve(path.dirname(file), data.sources[i]);
          assert.equal(
            data.sourcesContent[i],
            await fs.readFile(source, "utf8"),
            "Browser map must identify the exact source under test",
          );
          data.sources[i] = pathToFileURL(source).href;
        }
        maps[url] = {
          lineLengths: scriptSource.split("\n").map((line) => line.length),
          data,
          url: null,
        };
      } else
        assert.equal(
          scriptSource,
          await fs.readFile(file, "utf8"),
          "Browser coverage requires matching source offsets",
        );
      scripts.push({ ...entry, url });
    }
    await fs.mkdir(process.env.NODE_V8_COVERAGE, { recursive: true });
    await fs.writeFile(
      path.join(
        process.env.NODE_V8_COVERAGE,
        `coverage-${process.pid}-${Date.now()}-browser.json`,
      ),
      JSON.stringify({
        result: scripts,
        "source-map-cache": maps,
        timestamp: Date.now() / 1000,
      }),
    );
  };
}
module.exports = { browserCoverage };
