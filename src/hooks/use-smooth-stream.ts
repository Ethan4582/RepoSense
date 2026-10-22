'use client';

import * as React from 'react';

export function useSmoothStream() {
  const pending = React.useRef('');
  const frame = React.useRef<number | null>(null);
  const [text, setText] = React.useState('');

  const flush = React.useCallback(() => {
    frame.current = null;
    if (!pending.current) return;
    const chunk = pending.current;
    pending.current = '';
    setText((value) => value + chunk);
  }, []);

  const push = React.useCallback((chunk: string) => {
    pending.current += chunk;
    if (frame.current === null) frame.current = requestAnimationFrame(flush);
  }, [flush]);

  const reset = React.useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    pending.current = '';
    setText('');
  }, []);

  React.useEffect(() => () => { if (frame.current !== null) cancelAnimationFrame(frame.current); }, []);
  return { text, push, reset, flush };
}
