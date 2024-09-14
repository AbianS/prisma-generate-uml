import { createContext, ReactNode, useContext } from "react"
import { ColorThemeKind } from "../types/schema"

type ThemeContextType = {
  theme: ColorThemeKind
  isDarkMode: boolean
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme debe ser usado dentro de un ThemeProvider")
  }
  return context
}

export const ThemeProvider = ({
  children,
  theme,
}: {
  children: ReactNode
  theme: ColorThemeKind
}) => {
  const isDarkMode =
    theme === ColorThemeKind.Dark || theme === ColorThemeKind.HighContrast

  return (
    <ThemeContext.Provider value={{ theme, isDarkMode }}>
      {children}
    </ThemeContext.Provider>
  )
}
