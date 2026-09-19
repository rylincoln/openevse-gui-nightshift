import { PromiseBatcher, type SerialQueue as BatchQueue } from 'promise-batching-queue'

// Device writes are serialised through this one queue — the charger's web
// server is single-threaded. Never issue parallel writes.
class SerialQueue {
  private queue: BatchQueue
  timeout: ReturnType<typeof setTimeout> | null
  ispaused: boolean

  constructor() {
    this.queue = PromiseBatcher.newSerialQueue()
    this.timeout = null
    this.ispaused = false
  }

  add = async <T>(fn: () => Promise<T> | T): Promise<T | false> => {
    if (!this.ispaused) {
      const res = await this.queue.queue(fn)
      return Promise.resolve(res)
    } else {
      return false
    }
  }

  pause = (): void => {
    this.ispaused = true
  }

  resume = (): void => {
    this.ispaused = false
  }
}

export const serialQueue = new SerialQueue()
