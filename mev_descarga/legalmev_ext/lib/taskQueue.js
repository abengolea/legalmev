/**
 * TaskQueue — Cola FIFO con prioridad para content scripts.
 * Máximo 1 tarea ejecutándose simultáneamente.
 * Singleton por tab (usa chrome.storage.session para estado compartido).
 */
(function () {
  'use strict';

  const PRIORITY = { HIGH: 1, NORMAL: 0 };
  const STATE = { PENDING: 'pending', RUNNING: 'running', COMPLETED: 'completed', FAILED: 'failed' };

  const STORAGE_KEY = 'legalmev_taskqueue_state';

  function getTabId() {
    try {
      return typeof chrome !== 'undefined' && chrome.devtools
        ? 'devtools'
        : (typeof chrome !== 'undefined' && chrome.tabs ? 'unknown' : 'standalone');
    } catch (_) {
      return 'standalone';
    }
  }

  function createTask(fn, opts = {}) {
    const id = opts.id || 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
    return {
      id,
      fn,
      priority: opts.priority === 'HIGH' ? PRIORITY.HIGH : PRIORITY.NORMAL,
      label: opts.label || id,
      state: STATE.PENDING,
      createdAt: Date.now()
    };
  }

  function sortByPriority(a, b) {
    if (a.priority !== b.priority) return b.priority - a.priority;
    return a.createdAt - b.createdAt;
  }

  class TaskQueue {
    constructor() {
      this._queue = [];
      this._running = null;
      this._tabId = getTabId();
      this._listeners = { taskComplete: [], taskFailed: [], queueEmpty: [] };
    }

    static getInstance() {
      const key = '__legalmev_taskqueue_instance__';
      if (typeof globalThis !== 'undefined' && globalThis[key]) return globalThis[key];
      const instance = new TaskQueue();
      if (typeof globalThis !== 'undefined') globalThis[key] = instance;
      return instance;
    }

    enqueue(fn, opts = {}) {
      const task = createTask(fn, opts);
      this._queue.push(task);
      this._queue.sort(sortByPriority);
      this._process();
      return task.id;
    }

    /** Ejecuta una tarea y devuelve una promesa que se resuelve con el resultado. */
    async run(fn, opts = {}) {
      return new Promise((resolve, reject) => {
        const wrapped = async () => {
          try {
            const r = await fn();
            resolve(r);
            return r;
          } catch (e) {
            reject(e);
            throw e;
          }
        };
        this.enqueue(wrapped, opts);
      });
    }

    cancel(taskId) {
      const idx = this._queue.findIndex((t) => t.id === taskId);
      if (idx >= 0 && this._queue[idx].state === STATE.PENDING) {
        this._queue.splice(idx, 1);
        return true;
      }
      return false;
    }

    cancelAll() {
      const pending = this._queue.filter((t) => t.state === STATE.PENDING);
      this._queue = this._queue.filter((t) => t.state !== STATE.PENDING);
      return pending.length;
    }

    getState(taskId) {
      if (taskId) {
        const t = this._queue.find((x) => x.id === taskId) || (this._running?.id === taskId ? this._running : null);
        return t ? t.state : null;
      }
      return {
        pending: this._queue.filter((t) => t.state === STATE.PENDING).length,
        running: this._running ? 1 : 0,
        completed: this._queue.filter((t) => t.state === STATE.COMPLETED).length,
        failed: this._queue.filter((t) => t.state === STATE.FAILED).length
      };
    }

    on(event, handler) {
      if (this._listeners[event]) this._listeners[event].push(handler);
    }

    off(event, handler) {
      if (!this._listeners[event]) return;
      this._listeners[event] = this._listeners[event].filter((h) => h !== handler);
    }

    _emit(event, data) {
      (this._listeners[event] || []).forEach((h) => {
        try {
          h(data);
        } catch (_) {}
      });
    }

    async _process() {
      if (this._running) return;
      const next = this._queue.find((t) => t.state === STATE.PENDING);
      if (!next) {
        this._emit('queueEmpty', {});
        return;
      }
      next.state = STATE.RUNNING;
      this._running = next;
      try {
        const result = await next.fn();
        next.state = STATE.COMPLETED;
        this._emit('taskComplete', { taskId: next.id, label: next.label, result });
      } catch (err) {
        next.state = STATE.FAILED;
        this._emit('taskFailed', { taskId: next.id, label: next.label, error: err });
        throw err;
      } finally {
        this._running = null;
        this._process();
      }
    }

  }

  if (typeof globalThis !== 'undefined') {
    globalThis.LegalMevTaskQueue = TaskQueue;
  }
})();
