"use client";

import type React from "react";
import { createContext, useState, useContext, useEffect } from "react";

type Theme = "light" | "dark";

type ThemeContextType = {
  theme: Theme;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [theme, setTheme] = useState<Theme>("light");
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // This code will only run on the client side
    const savedTheme = localStorage.getItem("theme") as Theme | null;

    const applyAutoTheme = () => {
      const hour = new Date().getHours();
      const auto: Theme = hour >= 6 && hour < 18 ? "light" : "dark";
      setTheme(auto);
      localStorage.setItem("theme", auto);
    };

    if (savedTheme) {
      // respect stored preference initially
      setTheme(savedTheme);
    } else {
      // no preference: choose based on time
      applyAutoTheme();
    }

    setIsInitialized(true);

    // schedule future switch at 6:00 or 18:00
    const msUntilNext = () => {
      const now = new Date();
      const hour = now.getHours();
      let next = new Date(now);
      if (hour < 6) next.setHours(6, 0, 0, 0);
      else if (hour < 18) next.setHours(18, 0, 0, 0);
      else {
        next.setDate(next.getDate() + 1);
        next.setHours(6, 0, 0, 0);
      }
      return next.getTime() - now.getTime();
    };

    const timer = setTimeout(() => {
      applyAutoTheme();
      // afterwards we could reschedule, but leaving simple for now
    }, msUntilNext());

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem("theme", theme);
      if (theme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  }, [theme, isInitialized]);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === "light" ? "dark" : "light"));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
