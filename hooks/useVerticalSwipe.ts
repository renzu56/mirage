"use client";

import * as React from "react";

type Options = {
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number;
  lockMs?: number;
};

/** Don't treat gestures that start on buttons/links/inputs as a swipe */
function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest(
      [
        "[data-no-swipe]",
        "button",
        "a",
        "input",
        "textarea",
        "select",
        "label",
        "[role='button']",
      ].join(",")
    )
  );
}

export function useVerticalSwipe({
  onSwipeUp,
  onSwipeDown,
  threshold = 70,
  lockMs = 350,
}: Options) {
  const start = React.useRef({ x: 0, y: 0 });
  const pointerId = React.useRef<number | null>(null);
  const tracking = React.useRef(false);
  const lockedUntil = React.useRef(0);

  const onPointerDownCapture = React.useCallback((e: React.PointerEvent) => {
    if (Date.now() < lockedUntil.current) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (isInteractiveTarget(e.target)) return;

    tracking.current = true;
    pointerId.current = e.pointerId;
    start.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onPointerMoveCapture = React.useCallback((e: React.PointerEvent) => {
    if (!tracking.current) return;
    if (pointerId.current !== e.pointerId) return;

    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;

    // only prevent default if it's mostly vertical (helps mobile scroll stealing)
    if (Math.abs(dy) > Math.abs(dx) && e.cancelable) {
      e.preventDefault();
    }
  }, []);

  const finish = React.useCallback(
    (e: React.PointerEvent) => {
      if (!tracking.current) return;
      if (pointerId.current !== e.pointerId) return;

      tracking.current = false;
      pointerId.current = null;

      const dx = e.clientX - start.current.x;
      const dy = e.clientY - start.current.y;

      // ignore mostly-horizontal gestures
      if (Math.abs(dx) > Math.abs(dy)) return;

      if (dy <= -threshold) {
        lockedUntil.current = Date.now() + lockMs;
        onSwipeUp?.();
      } else if (dy >= threshold) {
        lockedUntil.current = Date.now() + lockMs;
        onSwipeDown?.();
      }
    },
    [lockMs, onSwipeDown, onSwipeUp, threshold]
  );

  const onPointerUpCapture = finish;
  const onPointerCancelCapture = finish;

  return React.useMemo(
    () => ({
      onPointerDownCapture,
      onPointerMoveCapture,
      onPointerUpCapture,
      onPointerCancelCapture,
    }),
    [onPointerCancelCapture, onPointerDownCapture, onPointerMoveCapture, onPointerUpCapture]
  );
}
