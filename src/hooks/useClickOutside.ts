import { useEffect, useRef, type RefObject } from 'react';

/**
 * Calls `handler` when the user clicks/taps outside all provided refs.
 */
export function useClickOutside(
  refs: RefObject<HTMLElement | null> | Array<RefObject<HTMLElement | null>>,
  handler: () => void,
  enabled = true
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  const refsRef = useRef(refs);
  refsRef.current = refs;

  useEffect(() => {
    if (!enabled) return;

    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      const refList = Array.isArray(refsRef.current) ? refsRef.current : [refsRef.current];
      const clickedInside = refList.some((ref) => ref.current?.contains(target));
      if (!clickedInside) {
        handlerRef.current();
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [enabled]);
}
