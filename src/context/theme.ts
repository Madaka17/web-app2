import { createContext, useContext } from "react";
import { ThemeMode } from "@/lib/types";

export interface ThemeContextValue {
  mode: ThemeMode;
  toggle: () => void;
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
