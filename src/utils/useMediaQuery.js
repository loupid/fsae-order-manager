import { useState, useEffect } from 'react';

/**
 * Hook to listen for CSS media queries in React components
 * @param {string} query CSS media query string, e.g. '(max-width: 767px)'
 * @returns {boolean} Whether the media query matches
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQueryList = window.matchMedia(query);
    const updateMatch = (e) => setMatches(e.matches);

    // Initial check
    setMatches(mediaQueryList.matches);

    if (mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener('change', updateMatch);
      return () => mediaQueryList.removeEventListener('change', updateMatch);
    } else {
      mediaQueryList.addListener(updateMatch);
      return () => mediaQueryList.removeListener(updateMatch);
    }
  }, [query]);

  return matches;
}

/**
 * Helper hook to detect mobile viewport (< breakpoint px, default 768px)
 * @param {number} breakpoint Viewport breakpoint in pixels (default 768)
 * @returns {boolean} true when screen width is below breakpoint
 */
export function useIsMobile(breakpoint = 768) {
  return useMediaQuery(`(max-width: ${breakpoint - 0.02}px)`);
}

export default useIsMobile;
