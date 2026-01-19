const LMAX = require('./LMAX.js');
const { performance } = require('perf_hooks');

const ITERATIONS = 10000000;
const testMsg = "FastLog benchmark test string";

async function run() {
  const t0 = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    console.log(testMsg);
  }
  const t1 = performance.now();

  const logger = new LMAX();
  const t2 = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    logger.log(testMsg);
  }
  const t3 = performance.now();

  process.stderr.write(`
Native console.log: ${(t1 - t0).toFixed(2)}ms
LMAX:            ${(t3 - t2).toFixed(2)}ms
Speedup:            ${((t1 - t0) / (t3 - t2)).toFixed(1)}x
\n`);

  logger.close();
  process.exit(0);
}

run();
