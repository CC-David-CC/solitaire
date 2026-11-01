export interface SolitaireMountResult {
  element: HTMLElement;
  dispose(): void;
}

export function mount(host: {
  ui: {make(tag: string, className?: string, text?: string): HTMLElement};
  signal?: AbortSignal;
}): SolitaireMountResult {
  const body = host.ui.make("div", "window-content solitaire-app");
  const controller = new AbortController();
  const hostAbort = () => controller.abort(host.signal?.reason);
  host.signal?.addEventListener("abort", hostAbort, {once: true});
  if (host.signal?.aborted) controller.abort(host.signal.reason);

  const title = host.ui.make("div", "solitaire-title", "Solitaire Table");
  const status = host.ui.make("div", "app-status", "Loading Solitaire Table…");
  status.setAttribute("role", "status");
  body.append(title, status);
  let view: {dispose(): void} | null = null;
  let disposed = false;

  queueMicrotask(() => {
    void import("./view/run.js")
      .then(async ({startView}) => {
        if (disposed || controller.signal.aborted) return;
        const started = await startView(host as never, controller.signal);
        if (disposed) {
          started.dispose();
          return;
        }
        view = started;
        body.replaceChildren(started.element);
      })
      .catch((error: unknown) => {
        if (!disposed && body.isConnected) {
          status.textContent = "Could not start Solitaire: " + (error instanceof Error ? error.message : "unknown error");
        }
      });
  });

  return {
    element: body,
    dispose() {
      if (disposed) return;
      disposed = true;
      controller.abort("View removed");
      host.signal?.removeEventListener("abort", hostAbort);
      view?.dispose();
      view = null;
      body.replaceChildren();
    },
  };
}
