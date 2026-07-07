import React, { createContext, useContext, useEffect, useState } from 'react';

declare global {
  interface Window {
    MathJax: any;
  }
}

const MathJaxContext = createContext(false);

export function MathJaxProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (window.MathJax) { setReady(true); return; }

    window.MathJax = {
      options: {
        renderActions: {
          addMenu: []
        }
      },
      loader: {
        load: ['input/asciimath', 'output/chtml']
      },
      startup: {
        typeset: false
      }
    };

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/mml-chtml.js';
    script.async = true;
    script.onload = () => {
      setReady(true);
    };
    script.onerror = () => console.error('MathJax failed to load');
    document.head.appendChild(script);
  }, []);

  return (
    <MathJaxContext.Provider value={ready}>
      {children}
    </MathJaxContext.Provider>
  );
}

export const useMathJax = () => useContext(MathJaxContext);
