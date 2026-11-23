export class ModelLoadAttempt {
  private reason?: Error;
  private readonly cancelHandlers = new Set<(reason: Error) => void>();

  get cancelled() { return this.reason !== undefined; }

  check() {
    if (this.reason) throw this.reason;
  }

  onCancel(handler: (reason: Error) => void) {
    this.cancelHandlers.add(handler);
    return () => { this.cancelHandlers.delete(handler); };
  }

  cancel(reason = new Error('Model load cancelled')) {
    if (this.reason) return;
    this.reason = reason;
    for (const handler of this.cancelHandlers) handler(reason);
    this.cancelHandlers.clear();
  }
}
