import { useState, useEffect } from "react";

const DARK_KEY = "dhanusha_dark_mode";

export function useDarkMode(): [boolean, () => void] {
  const [isDark, setIsDark] = useState<boolean>(() => {
    const stored = localStorage.getItem(DARK_KEY);
    if (stored !== null) return stored === "true";
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem(DARK_KEY, String(isDark));
  }, [isDark]);

  return [isDark, () => setIsDark((prev) => !prev)];
}
