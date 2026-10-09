import { useEffect, useRef, useState } from "react";

/**
 * Tracks an element's content width so SVG charts can lay out at real pixel
 * size (keeping text legible on phones). Server and first client render use
 * `fallback`, so hydration markup matches.
 */
export function useElementWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const update = () => setWidth(Math.max(240, Math.round(element.clientWidth)));
    update();

    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, width] as const;
}
