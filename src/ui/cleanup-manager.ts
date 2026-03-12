export class CleanupManager {
  private handlers: (() => void)[] = [];

  registerDocumentClick(handler: () => void): void {
    document.addEventListener("click", handler);
    this.handlers.push(handler);
  }

  cleanup(): void {
    for (const handler of this.handlers) {
      document.removeEventListener("click", handler);
    }
    this.handlers = [];
  }
}
