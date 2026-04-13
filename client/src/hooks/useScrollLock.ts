import { useEffect } from 'react';

// Use a global counter to manage multiple overlapping scroll locks
let lockCount = 0;

export const useScrollLock = (lock: boolean) => {
  useEffect(() => {
    if (!lock) return;

    // When lock is true, increment counter and apply class to html
    lockCount++;
    const html = document.documentElement;
    const body = document.body;
    
    // Apply class to lock scroll
    html.classList.add('scroll-lock');
    body.classList.add('scroll-lock');

    return () => {
      // When component unmounts or lock becomes false, decrement counter
      lockCount--;
      if (lockCount <= 0) {
        lockCount = 0;
        html.classList.remove('scroll-lock');
        body.classList.remove('scroll-lock');
      }
    };
  }, [lock]);
};
