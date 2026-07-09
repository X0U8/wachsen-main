import React, { useEffect, useRef } from 'react';
import { useMathJax } from '../lib/MathJaxContext';

const MathText = ({ text }: { text: string }) => {
  const ready = useMathJax();
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // HTML-escape so < > & don't get interpreted as tags before MathJax runs
    const escaped = (text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    containerRef.current.innerHTML = escaped;

    if (!ready || !text?.includes('$')) return;

    // Clear MathJax's internal cache for this element so it re-processes
    if (window.MathJax?.typesetClear) {
      window.MathJax.typesetClear([containerRef.current]);
    }

    const timer = setTimeout(() => {
      window.MathJax?.typesetPromise?.([containerRef.current]).catch(() => {});
    }, 50);

    return () => clearTimeout(timer);
  }, [text, ready]);

  if (!text) return null;

  return <span ref={containerRef} style={{ display: 'inline-block' }} />;
};

export default MathText;
