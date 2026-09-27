import { takeCoverage } from "node:v8";

// A long-running server may still be draining renderer children at teardown.
// Flush its real V8 counters before termination rather than relying on exit timing.
process.on("message", (message) => {
  if (message === "flush-coverage") {
    takeCoverage();
    process.send?.("coverage-flushed");
  }
});
