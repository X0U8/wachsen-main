import React, { useEffect, useRef } from 'react';
import { useMathJax } from '../lib/MathJaxContext';

const MathText = ({ text }: { text: any }) => {
  const ready = useMathJax();
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const textStr = String(text ?? '');


    const escaped = textStr
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    containerRef.current.innerHTML = escaped;

    if (!ready || !textStr.includes('$')) return;


    if (window.MathJax?.typesetClear) {
      window.MathJax.typesetClear([containerRef.current]);
    }

    const timer = setTimeout(() => {
      window.MathJax?.typesetPromise?.([containerRef.current]).catch(() => { });
    }, 50);

    return () => clearTimeout(timer);
  }, [text, ready]);

  if (text === null || text === undefined) return null;

  return <span ref={containerRef} className="inline-block max-w-full break-words whitespace-pre-wrap" />;
};

export default MathText;
