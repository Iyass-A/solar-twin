// The physics worker: runs the engine (src/physics/engine.ts) off the page's thread.
// Started by src/physics/client.ts; the messages are in src/physics/protocol.ts.

import { Engine } from './engine';
import type { ToWorker } from './protocol';

const scope = self as unknown as {
  postMessage(msg: unknown, transfer?: Transferable[]): void;
  onmessage: ((e: MessageEvent<ToWorker>) => void) | null;
};

// A zero-delay "later" (setTimeout waits at least 4 ms once nested), still letting the page's messages in
const channel = new MessageChannel();
const queue: (() => void)[] = [];
channel.port1.onmessage = () => queue.shift()?.();
const later = (fn: () => void) => { queue.push(fn); channel.port2.postMessage(null); };

const engine = new Engine((msg, transfer) => scope.postMessage(msg, transfer ?? []), later);
scope.onmessage = (e) => engine.handle(e.data);
