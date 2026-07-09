import React, { useEffect, useRef } from 'react';
import { useMathJax } from '../lib/MathJaxContext';

const MathText = ({ text }: { text: string }) => {
  const ready = useMathJax();
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ready || !containerRef.current) return;
    const mathSpans = containerRef.current.querySelectorAll('.math-inline');
    if (!mathSpans.length) return;

    mathSpans.forEach(span => {
      span.innerHTML = '`' + span.getAttribute('data-math') + '`';
    });

    const timer = setTimeout(() => {
      window.MathJax.typesetPromise([containerRef.current]).catch(console.error);
    }, 50);
    return () => clearTimeout(timer);
  }, [text, ready]);

  if (!text) return null;
  if (!text.includes('$')) return <span>{text}</span>;

  const parts = text.split(/(\$[^$]+\$)/g);

  return (
    <span ref={containerRef} style={{ display: 'inline-block' }}>
      {parts.map((part, i) => {
        const match = part.match(/^\$([^$]+)\$$/);
        if (match) {
          return <span key={i} className="math-inline" data-math={match[1]} />;
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
};

export default MathText;
