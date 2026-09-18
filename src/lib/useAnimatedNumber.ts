import { useEffect, useRef, useState } from "react";

const DURATION_MS = 550;

/** Glides from the value on screen to `target`, so a re-priced result reads
 * as a change rather than a replacement. The first render is instant. */
export function useAnimatedNumber(target: number): number {
  const [value, setValue] = useState(target);
  const shownRef = useRef(target); // what is on screen right now, mid-glide included
  const frameRef = useRef(0);

  useEffect(() => {
    const from = shownRef.current;
    if (from === target) return;
    if (document.hidden) {
      // requestAnimationFrame is paused in a background tab; do not leave a stale number.
      shownRef.current = target;
      setValue(target);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      shownRef.current = from + (target - from) * eased;
      setValue(shownRef.current);
      if (t < 1) frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target]);

  return value;
}
