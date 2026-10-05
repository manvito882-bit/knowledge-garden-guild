import { useEffect, useState } from "react";

export type Theme = "light" | "dark";
const KEY = "luminary-theme";

export function applyStoredTheme() {
  if (typeof window === "undefined") return;
  const t = (localStorage.getItem(KEY) as Theme) || "light";
  document.documentElement.classList.toggle("dark", t === "dark");
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("light");
  useEffect(() => {
    setThemeState((localStorage.getItem(KEY) as Theme) || "light");
  }, []);
  const setTheme = (t: Theme) => {
    localStorage.setItem(KEY, t);
    document.documentElement.classList.toggle("dark", t === "dark");
    setThemeState(t);
  };
  return { theme, setTheme, toggle: () => setTheme(theme === "dark" ? "light" : "dark") };
}
