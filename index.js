"use strict";

const path = require("path");
const isLocal = typeof process.pkg === "undefined";
const basePath = isLocal ? process.cwd() : path.dirname(process.execPath);
const { startCreating, buildSetup } = require(path.join(
  basePath,
  "/src/main.js"
));

(async () => {
  console.time("Time to finish");
  buildSetup();
  await startCreating();
  console.timeEnd("Time to finish");
  process.exit(0)
})();
