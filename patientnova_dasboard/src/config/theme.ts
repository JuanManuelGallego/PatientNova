/**
 * ─── Centralized Theme Configuration ─────────────────────────────────────────
 *
 * Single source of truth for ALL visual tokens across the application.
 *
 * To change the brand color → update `colors.primary` below.
 * To change the font       → update `fontFamily` below AND the Google Font
 *                             import in `src/app/layout.tsx`.
 *
 * Consumed by:
 *   • src/app/globals.css          — via manually-synced CSS custom properties
 *   • src/styles/theme.ts          — Ant Design ConfigProvider theme tokens
 *   • src/styles/medicalRecordsPDFStyle.ts — @react-pdf/renderer palette
 *   • Components that need programmatic color access (e.g. avatars, charts)
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const theme = {
  /** ── Font ─────────────────────────────────────────────────────────────── */
  fontFamily: "'DM Sans', sans-serif",

  /** ── Colors ──────────────────────────────────────────────────────────── */
  colors: {
    /* Brand */
    primary: "#7C3AED", // main actions, active states, highlights
    primaryHover: "#6D28D9", // button hover, link hover
    primarySubtle: "#F3EEFF", // light tint backgrounds, badges, hover fills
    primaryMuted: "#DDD6FE", // soft borders, focus rings

    /* Surfaces */
    surface: "#FFFFFF", // cards, panels, modals
    background: "#F8F7FF", // app background — barely-there purple tint
    inputBg: "#FAFAFE", // input/select backgrounds

    /* Borders */
    border: "#E5E2F0", // dividers, card borders
    borderLight: "#F0EEF5", // subtle inner dividers

    /* Text */
    textPrimary: "#1A1523", // headings, body text
    textSecondary: "#6B6580", // labels, metadata, placeholders
    textTertiary: "#9F95B0", // disabled text, captions

    /* Semantic */
    success: "#10B981",
    successBg: "#ECFDF5",
    successDot: "#34D399",

    warning: "#F59E0B",
    warningBg: "#FFFBEB",
    warningDot: "#FBBF24",
    warningDark: "#92400E",

    danger: "#EF4444",
    dangerBg: "#FEF2F2",
    dangerDot: "#F87171",
    dangerBorder: "#FECACA",

    info: "#3B82F6",
    infoBg: "#EFF6FF",
    infoDot: "#60A5FA",
    infoBorder: "#BFDBFE",

    /* Neutrals */
    white: "#FFFFFF",
    gray50: "#F9FAFB",
    gray100: "#F3F4F6",
    gray200: "#E5E7EB",
    gray300: "#D1D5DB",
    gray400: "#9CA3AF",
    gray500: "#6B7280",
    gray600: "#4B5563",
    gray700: "#374151",
    gray800: "#1F2937",
    gray900: "#111827",
  },

  /** ── Border Radius ───────────────────────────────────────────────────── */
  radius: {
    sm: "6px", // badges, tags
    md: "8px", // buttons, inputs
    lg: "12px", // cards, panels
    xl: "16px", // modals, drawers
    full: "9999px", // pills, avatars
  },

  /** ── Shadows ─────────────────────────────────────────────────────────── */
  shadows: {
    xs: "0 1px 2px rgba(0, 0, 0, 0.04)",
    sm: "0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)",
    md: "0 4px 6px -1px rgba(0, 0, 0, 0.06), 0 2px 4px -2px rgba(0, 0, 0, 0.04)",
    lg: "0 10px 15px -3px rgba(0, 0, 0, 0.06), 0 4px 6px -4px rgba(0, 0, 0, 0.04)",
    xl: "0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)",
    modal: "0 25px 50px -12px rgba(0, 0, 0, 0.2)",
    drawer: "0 0 40px rgba(0, 0, 0, 0.12)",
  },

  /** ── Z-index ─────────────────────────────────────────────────────────── */
  zIndex: {
    sidebar: 40,
    modal: 50,
    modalNested: 60,
  },

  /** ── Transitions ─────────────────────────────────────────────────────── */
  transition: {
    fast: "0.1s ease",
    base: "0.15s ease",
    smooth: "0.25s ease",
    slow: "0.35s ease",
  },

  /** ── Typography ──────────────────────────────────────────────────────── */
  fontSize: {
    xs: "11px",
    sm: "12px",
    base: "13px",
    md: "14px",
    lg: "16px",
    xl: "18px",
    "2xl": "24px",
    "3xl": "30px",
    "4xl": "36px",
  },

  fontWeight: {
    normal: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
    black: "800",
  },

  /** ── Spacing ─────────────────────────────────────────────────────────── */
  spacing: {
    "1": "4px",
    "2": "8px",
    "3": "12px",
    "4": "16px",
    "5": "20px",
    "6": "24px",
    "8": "32px",
    "10": "40px",
    "12": "48px",
    "16": "64px",
  },

  /** ── Layout ──────────────────────────────────────────────────────────── */
  layout: {
    sidebarWidth: "260px",
    navbarHeight: "56px",
  },
} as const;
