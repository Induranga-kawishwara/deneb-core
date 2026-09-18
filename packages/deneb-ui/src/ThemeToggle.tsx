'use client';

import React, { useEffect, useState } from 'react';

export interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

/**
 * Built-in ThemeToggle Component for DENEB Storefront Templates.
 * Toggles the `.dark` class on the root <html> element and persists preference to localStorage.
 */
export function ThemeToggle({ className = '', showLabel = false }: ThemeToggleProps) {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const hasDarkClass = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
    const storedTheme = typeof window !== 'undefined' ? localStorage.getItem('deneb-theme') : null;
    const prefersDark = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)').matches : false;

    const activeDark = storedTheme ? storedTheme === 'dark' : hasDarkClass || prefersDark;
    setIsDark(activeDark);
    if (activeDark) {
      if (typeof document !== 'undefined') document.documentElement.classList.add('dark');
    } else {
      if (typeof document !== 'undefined') document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      if (typeof document !== 'undefined') document.documentElement.classList.add('dark');
      if (typeof window !== 'undefined') localStorage.setItem('deneb-theme', 'dark');
    } else {
      if (typeof document !== 'undefined') document.documentElement.classList.remove('dark');
      if (typeof window !== 'undefined') localStorage.setItem('deneb-theme', 'light');
    }
  };

  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="Toggle theme"
        data-preview-static="theme-toggle"
        className={`w-9 h-9 rounded-lg border border-[var(--border-color,#e2e8f0)] bg-[var(--card-bg,#ffffff)] opacity-0 transition-opacity ${className}`}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      data-preview-static="theme-toggle"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`inline-flex items-center justify-center gap-2 h-9 px-2.5 rounded-lg border border-[var(--border-color,rgba(0,0,0,0.1))] bg-[var(--card-bg,#ffffff)] text-[var(--text-color,#0f172a)] hover:border-[var(--color-primary,#016a7e)] hover:text-[var(--color-primary,#016a7e)] shadow-sm transition-all duration-200 cursor-pointer ${className}`}
    >
      {isDark ? (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-amber-400">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-amber-500">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="m4.93 4.93 1.41 1.41" />
          <path d="m17.66 17.66 1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="m6.34 17.66-1.41 1.41" />
          <path d="m19.07 4.93-1.41 1.41" />
        </svg>
      )}
      {showLabel && (
        <span className="text-xs font-medium">{isDark ? 'Dark' : 'Light'}</span>
      )}
    </button>
  );
}

export default ThemeToggle;
