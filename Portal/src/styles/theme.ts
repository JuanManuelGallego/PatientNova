import { CSSProperties } from "react";
import { theme as antTheme } from "antd";
import { theme } from "@/src/config/theme";

/**
 * Shared Ant Design ConfigProvider theme.
 * All values sourced from src/config/theme.ts (single source of truth).
 * Pass isDark=true to apply the Ant Design dark algorithm.
 */
export function getAntThemeConfig(isDark = false) {
  return {
    algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
    token: {
      fontFamily: theme.fontFamily,
      fontSize: 14,
      colorPrimary: isDark ? "#a78bfa" : theme.colors.primary,
      colorBorder: isDark ? "#312f42" : theme.colors.gray200,
      colorBgContainer: isDark ? "#1e1c2a" : theme.colors.inputBg,
      borderRadius: parseInt(theme.radius.lg),
      controlHeight: 40,
      colorText: isDark ? "#f0eeff" : theme.colors.textPrimary,
      colorTextPlaceholder: isDark ? "#6b6a82" : theme.colors.gray400,
    },
    components: {
      DatePicker: {
        activeBorderColor: isDark ? "#a78bfa" : theme.colors.primary,
        hoverBorderColor: isDark ? "#a78bfa" : theme.colors.primary,
        cellActiveWithRangeBg: isDark ? "#2e1a5e" : theme.colors.primarySubtle,
        cellHoverBg: isDark ? "#2e1a5e" : theme.colors.primarySubtle,
      },
    },
  };
}

/** Convenience static export for components that don't need dark mode */
export const antThemeConfig = getAntThemeConfig(false);

export const sectionGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 18,
};
