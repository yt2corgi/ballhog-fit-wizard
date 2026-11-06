const WORKERS = Math.max(1, Math.min(3, Math.floor((navigator.hardwareConcurrency || 2) / 2)));
const idle = [];
const queue = [];
const live = new Map();
let nextId = 1;
let made = 0;
let broken = false;

function makeWorker() {
  const worker = new Worker(new URL('./cut-worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }) => {
    const job = live.get(data.id);
    live.delete(data.id);
    if (data.error) job?.reject(new Error(data.error));
    else job?.resolve(data.blob);
    release(worker);
  };
  worker.onerror = () => {
    broken = true;
    for (const job of live.values()) job.reject(new Error('worker'));
    live.clear();
    while (queue.length) queue.shift().reject(new Error('worker'));
  };
  return worker;
}

function release(worker) {
  const job = queue.shift();
  if (job) start(worker, job);
  else idle.push(worker);
}

function start(worker, job) {
  live.set(job.id, job);
  worker.postMessage({ id: job.id, src: job.src, slot: job.slot });
}

const memo = new Map();

export function cutImage(src, slot) {
  const key = `${slot}|${src}`;
  if (memo.has(key)) return memo.get(key);
  const promise = new Promise((resolve, reject) => {
    if (broken || typeof Worker === 'undefined') {
      reject(new Error('no worker'));
      return;
    }
    const job = { id: nextId++, src, slot, resolve, reject };
    const worker = idle.pop() || (made < WORKERS ? (made++, makeWorker()) : null);
    if (worker) start(worker, job);
    else queue.push(job);
  }).then(blob => URL.createObjectURL(blob));
  promise.catch(() => memo.delete(key));
  memo.set(key, promise);
  return promise;
}
