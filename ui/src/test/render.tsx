import React, { act } from "react";
import { createRoot, Root } from "react-dom/client";

export interface RenderResult {
  container: HTMLElement;
  unmount: () => void;
  rerender: (ui: React.ReactElement) => void;
}

/** Minimal jsdom render helper built on react-dom/client + React.act. */
export function render(ui: React.ReactElement): RenderResult {
  const container = document.createElement("div");
  document.body.appendChild(container);
  let root!: Root;
  act(() => {
    root = createRoot(container);
    root.render(ui);
  });
  return {
    container,
    rerender: (u) => act(() => root.render(u)),
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

/** Fire a bubbling click wrapped in act() so React flushes resulting updates. */
export function click(el: Element | null): void {
  if (!el) throw new Error("click: element not found");
  act(() => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

/** Fire a keydown on an element wrapped in act(). */
export function keyDown(el: Element | null, key: string, init: KeyboardEventInit = {}): void {
  if (!el) throw new Error("keyDown: element not found");
  act(() => {
    el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init }));
  });
}
