import { CSSProperties } from "react";
import { theme } from "@/src/config/theme";

/**
 * Shared Ant Design ConfigProvider theme.
 * All values sourced from src/config/theme.ts (single source of truth).
 */
export const antThemeConfig = {
  token: {
    fontFamily: theme.fontFamily,
    fontSize: 14,
    colorPrimary: theme.colors.primary,
    colorBorder: theme.colors.gray200,
    colorBgContainer: theme.colors.inputBg,
    borderRadius: parseInt(theme.radius.lg),
    controlHeight: 40,
    colorText: theme.colors.textPrimary,
    colorTextPlaceholder: theme.colors.gray400,
  },
  components: {
    DatePicker: {
      activeBorderColor: theme.colors.primary,
      hoverBorderColor: theme.colors.primary,
      cellActiveWithRangeBg: theme.colors.primarySubtle,
      cellHoverBg: theme.colors.primarySubtle,
    },
  },
};

export const sectionGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 18,
};
