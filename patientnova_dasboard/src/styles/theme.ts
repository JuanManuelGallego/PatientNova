import { CSSProperties } from "react";

/**
 * Shared Ant Design ConfigProvider theme.
 * Hex values here intentionally mirror the CSS variables in globals.css
 * (Ant Design's token system requires raw JS values, not CSS variables).
 *
 * If you update a color in globals.css, update the matching value here:
 *   colorPrimary         → --c-brand          #1E3A5F
 *   colorBorder          → --c-gray-200        #E5E7EB
 *   colorBgContainer     → --c-input-bg        #FAFAFA
 *   colorText            → --c-gray-900        #111827
 *   colorTextPlaceholder → --c-gray-400        #9CA3AF
 *   cellActiveWithRangeBg / cellHoverBg → --c-brand-light #EFF6FF
 *   borderRadius         → --r-lg              10px
 */
export const antThemeConfig = {
    token: {
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 14,
        colorPrimary: "#1E3A5F",
        colorBorder: "#E5E7EB",
        colorBgContainer: "#FAFAFA",
        borderRadius: 10,
        controlHeight: 40,
        colorText: "#111827",
        colorTextPlaceholder: "#9CA3AF",
    },
    components: {
        DatePicker: {
            activeBorderColor: "#1E3A5F",
            hoverBorderColor: "#1E3A5F",
            cellActiveWithRangeBg: "#EFF6FF",
            cellHoverBg: "#EFF6FF",
        },
    },
};


export const sectionGridStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 18,
};
