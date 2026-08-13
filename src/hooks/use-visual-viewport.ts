'use client';

import * as React from 'react';

/**
 * Tracks the *visual* viewport — the part of the page actually on screen once
 * the on-screen keyboard is up.
 *
 * Why: a panel pinned with `inset-y-0 h-full` is sized against the **layout**
 * viewport, which iOS Safari does not shrink when the keyboard opens. Safari
 * instead scrolls the page to reveal the focused input, pushing the panel's
 * header off the top of the screen — which is exactly the bug where the
 * "MarigoAI" header vanished as soon as someone tapped the message box.
 *
 * Returns null until measured (and on browsers without the API), so callers can
 * fall back to their CSS height and never render a 0px panel during SSR.
 */
export interface VisualViewportRect {
  /** Height of the on-screen area, in px. */
  height: number;
  /** How far the visual viewport has been scrolled down inside the layout one. */
  offsetTop: number;
  /** True once the viewport has shrunk enough to mean "keyboard is open". */
  isKeyboardOpen: boolean;
}

/** Below this much lost height, it's browser chrome collapsing, not a keyboard. */
const KEYBOARD_THRESHOLD_PX = 120;

export function useVisualViewport(enabled = true): VisualViewportRect | null {
  const [rect, setRect] = React.useState<VisualViewportRect | null>(null);

  React.useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      setRect({
        height: vv.height,
        offsetTop: vv.offsetTop,
        isKeyboardOpen: window.innerHeight - vv.height > KEYBOARD_THRESHOLD_PX,
      });
    };

    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [enabled]);

  // Drop the measurement when the consumer closes, so the next open re-measures
  // instead of flashing the previous keyboard-sized panel.
  React.useEffect(() => {
    if (!enabled) setRect(null);
  }, [enabled]);

  return rect;
}
