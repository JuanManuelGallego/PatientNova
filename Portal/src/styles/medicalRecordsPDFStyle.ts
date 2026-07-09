import { StyleSheet } from "@react-pdf/renderer";
import { theme } from "@/src/config/theme";

// ─── Palette (sourced from src/config/theme.ts) ─────────────────────────────
// CSS variables cannot be used in @react-pdf/renderer — values are inlined here.
// All values come from the centralized theme config.
export const C = {
  // Brand
  brand: theme.colors.primary,
  brandAccent: theme.colors.primary,
  brandLight: theme.colors.primarySubtle,
  brandNav: theme.colors.primaryMuted,
  brandSub: theme.colors.primaryMuted,

  // Neutrals
  white: theme.colors.white,
  gray50: theme.colors.gray50,
  gray100: theme.colors.gray100,
  gray200: theme.colors.gray200,
  gray300: theme.colors.gray300,
  gray400: theme.colors.gray400,
  gray500: theme.colors.gray500,
  gray700: theme.colors.gray700,
  gray900: theme.colors.gray900,

  // Surfaces
  pageBg: theme.colors.background,
  surface: theme.colors.surface,

  // Semantic
  success: theme.colors.success,
  successBg: theme.colors.successBg,
  error: theme.colors.danger,
  errorBg: theme.colors.dangerBg,
  warning: theme.colors.warning,
  link: theme.colors.primary,
  infoBg: theme.colors.infoBg,
  infoBorder: theme.colors.infoBorder,
};

// ─── Styles ──────────────────────────────────────────────────────────────────
export const S = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    backgroundColor: C.surface, // --c-page-bg
    paddingTop: 50,
    paddingBottom: 100,
    paddingHorizontal: 0,
    fontSize: 9,
    color: C.gray900, // --c-gray-900
  },

  // Header band
  headerBand: {
    backgroundColor: C.brand, // --c-brand
    paddingHorizontal: 36,
    paddingTop: 0,
    paddingBottom: 22,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: C.gray900, // --c-white
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 9,
    color: C.brandSub, // --c-brand-sub
    marginTop: 3,
    letterSpacing: 0.3,
  },
  headerBadge: {
    backgroundColor: C.brandAccent, // --c-brand-accent
    borderRadius: 4, // ~--r-sm
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  headerBadgeText: {
    color: C.white,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.5,
  },
  headerDivider: {
    height: 1,
    backgroundColor: C.brandNav, // --c-brand-nav (subtle band separator)
    marginTop: 16,
    marginBottom: 14,
    opacity: 0.4,
  },
  headerInfoRow: {
    flexDirection: "row",
    gap: 32,
  },
  headerInfoItem: {
    flexDirection: "column",
    gap: 2,
  },
  headerInfoLabel: {
    fontSize: 7,
    color: C.brandSub, // --c-brand-sub
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  headerInfoValue: {
    fontSize: 11,
    color: C.white,
    fontFamily: "Helvetica-Bold",
  },
  headerInfoValueSm: {
    fontSize: 9,
    color: C.brandNav, // --c-brand-nav
  },
  headerLogo: {
    width: 137, // pt
    height: 55, // pt
    objectFit: "contain",
  },
  // Body
  body: {
    paddingHorizontal: 36,
    paddingTop: 0,
    gap: 20,
  },

  // Section card
  card: {
    backgroundColor: C.surface, // --c-surface
    borderRadius: 6, // ~--r-sm
    overflow: "hidden",
    border: `1 solid ${C.gray200}`, // --c-gray-200
  },
  cardHeader: {
    backgroundColor: C.brand, // --c-brand
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cardHeaderTeal: {
    backgroundColor: C.link, // --c-link (deep blue for clinical sections)
  },
  cardHeaderAccent: {
    backgroundColor: C.brandAccent, // --c-brand-accent
  },
  cardHeaderText: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: C.white,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  cardBody: {
    padding: 14,
  },

  // Grid layouts
  row2: {
    flexDirection: "row",
    gap: 12,
  },
  col: {
    flex: 1,
  },
  col2: {
    flex: 2,
  },

  // Field
  field: {
    marginBottom: 10,
  },
  fieldLast: {
    marginBottom: 0,
  },
  fieldLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: C.gray500, // --c-gray-500
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  fieldValue: {
    fontSize: 9,
    color: C.gray900, // --c-gray-900
    lineHeight: 1.5,
  },
  fieldValueEmpty: {
    fontSize: 9,
    color: C.gray300, // --c-gray-300
    fontStyle: "italic",
  },
  fieldUnderline: {
    borderBottom: `1 solid ${C.gray200}`, // --c-gray-200
    paddingBottom: 6,
  },
  fieldTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: C.gray700, // --c-gray-700
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 3,
  },

  // Pill chip
  pill: {
    backgroundColor: C.brandLight, // --c-brand-light
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: "flex-start",
  },
  pillText: {
    fontSize: 8,
    color: C.brandAccent, // --c-brand-accent
    fontFamily: "Helvetica-Bold",
  },
  pillTeal: {
    backgroundColor: C.infoBg, // --c-info-bg
  },
  pillTealText: {
    color: C.link, // --c-link
  },

  // Family member card
  memberCard: {
    //padding: 10,
    marginBottom: 8,
  },
  memberCardLast: {
    marginBottom: 0,
  },
  memberName: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: C.gray700, // --c-gray900
    marginBottom: 6,
  },

  // Evolution note
  noteCard: {
    //paddingTop: 6,
    paddingBottom: 6,
    paddingRight: 8,
  },
  noteCardLast: {
    marginBottom: 0,
  },
  noteDate: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: C.gray900, // --c-grey900
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  noteText: {
    fontSize: 9,
    color: C.gray900, // --c-gray-900
    lineHeight: 1.6,
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 16,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTop: `1 solid ${C.gray200}`, // --c-gray-200
    paddingTop: 8,
  },
  footerText: {
    fontSize: 7,
    color: C.gray500, // --c-gray-500
    letterSpacing: 0.3,
  },
  footerBrand: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: C.brand, // --c-brand
    letterSpacing: 0.4,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: C.gray200, // --c-gray-200
    marginVertical: 10,
  },

  // Empty state
  emptyText: {
    fontSize: 8,
    color: C.gray300, // --c-gray-300
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 10,
  },

  // Section label strip
  sectionStrip: {
    backgroundColor: C.gray50, // --c-gray-50
    borderBottom: `1 solid ${C.gray200}`, // --c-gray-200
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  sectionStripText: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: C.gray500, // --c-gray-500
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
});
