const { Worker, isMainThread, workerData } = require('worker_threads');
const fs = require('fs');

if (isMainThread) {
  module.exports = class LMAX {
    constructor(slots = 4096, slotSize = 256) {
      this.slots = slots;
      this.slotSize = slotSize;
      this.mask = slots - 1;
      this.sab = new SharedArrayBuffer(128 + (slots * slotSize));
      this.state = new Int32Array(this.sab); 
      this.tailIdx = 0;   
      this.headIdx = 16;  
      this.closeIdx = 32;
      
      this.storage = new Uint8Array(this.sab, 128);
      this.worker = new Worker(__filename, { workerData: { sab: this.sab, slots, slotSize } });
    }

    log(str) {
      const head = Atomics.load(this.state, this.headIdx);
      const tail = Atomics.load(this.state, this.tailIdx);
      if (((head + 1) & this.mask) === tail) return; 

      const offset = head * this.slotSize;
      const buf = Buffer.from(str);
      const len = Math.min(buf.length, this.slotSize - 1);
      
      this.storage[offset] = len;
      this.storage.set(buf.subarray(0, len), offset + 1);

      Atomics.store(this.state, this.headIdx, (head + 1) & this.mask);
      Atomics.notify(this.state, this.headIdx);
    }

    async close() {
      Atomics.store(this.state, this.closeIdx, 1);
      Atomics.notify(this.state, this.headIdx);

      return new Promise((resolve) => {
        this.worker.on('exit', resolve);
      });
    }
  };
} else {
  const { sab, slots, slotSize } = workerData;
  const mask = slots - 1;
  const state = new Int32Array(sab);
  const storage = new Uint8Array(sab, 128);
  const fd = process.stdout.fd;

  const tailIdx = 0;
  const headIdx = 16;
  const closeIdx = 32;

  while (true) {
    let head = Atomics.load(state, headIdx);
    let tail = Atomics.load(state, tailIdx);
    const shouldClose = Atomics.load(state, closeIdx);

    if (tail === head) {
      if (shouldClose) break; // Buffer is empty and close signal received
      Atomics.wait(state, headIdx, head, 50); 
      continue;
    }

    const offset = tail * slotSize;
    const len = storage[offset];
    fs.writeSync(fd, storage.subarray(offset + 1, offset + 1 + len));
    fs.writeSync(fd, "\n");

    Atomics.store(state, tailIdx, (tail + 1) & mask);
  }
  process.exit(0);
}
