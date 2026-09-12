import { useState, useEffect, useRef, useCallback } from 'react';

export function useTypewriter(text: string, msPerChar: number = 25) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);
  const indexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!text) return;
    indexRef.current = 0;
    setDisplayed('');
    setDone(false);

    timerRef.current = setInterval(() => {
      indexRef.current++;
      if (indexRef.current >= text.length) {
        setDisplayed(text);
        setDone(true);
        if (timerRef.current) clearInterval(timerRef.current);
      } else {
        setDisplayed(text.slice(0, indexRef.current));
      }
    }, msPerChar);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [text, msPerChar]);

  const skip = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setDisplayed(text);
    setDone(true);
  }, [text]);

  return { displayed, done, skip };
}
