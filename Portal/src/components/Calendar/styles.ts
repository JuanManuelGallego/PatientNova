export
  const calendarStyles = {
    viewToggle: {
      display: "flex",
      borderRadius: 8,
      overflow: "hidden",
      border: "1px solid var(--c-gray-200)",
    } as React.CSSProperties,

    viewToggleBtn: {
      padding: "5px 14px",
      fontSize: 13,
      fontWeight: 500,
      background: "transparent",
      border: "none",
      borderRight: "1px solid var(--c-gray-200)",
      cursor: "pointer",
      color: "var(--c-gray-600)",
      transition: "background 0.15s",
      whiteSpace: "nowrap" as const,
    } as React.CSSProperties,

    viewToggleBtnActive: {
      background: "var(--c-brand)",
      color: "#fff",
    } as React.CSSProperties,

    viewToggleBtnDisabled: {
      background: "transparent",
      color: "var(--c-gray-600)",
    } as React.CSSProperties,


    weekGrid: {
      display: "grid",
      gridTemplateColumns: "56px repeat(7, 1fr)",
      minWidth: 640,
    } as React.CSSProperties,

    weekGutter: {
      borderBottom: "2px solid var(--c-gray-200)",
      background: "var(--c-gray-50)",
    } as React.CSSProperties,

    weekDayHeader: {
      display: "flex",
      flexDirection: "column" as const,
      alignItems: "center",
      padding: "8px 4px",
      gap: 2,
      borderLeft: "1px solid var(--c-gray-100)",
      userSelect: "none" as const,
      minWidth: 0,
      overflow: "hidden",
    } as React.CSSProperties,

    weekDayName: {
      fontSize: 11,
      fontWeight: 600,
      textTransform: "uppercase" as const,
      color: "var(--c-gray-400)",
      letterSpacing: "0.05em",
    } as React.CSSProperties,

    weekDayNum: {
      fontSize: 18,
      fontWeight: 600,
      color: "var(--c-gray-700)",
      lineHeight: 1,
      cursor: "pointer",
      borderRadius: "50%",
      width: 32,
      height: 32,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "background 0.15s",
    } as React.CSSProperties,

    weekDayNumToday: {
      background: "var(--c-brand)",
      color: "#fff",
    } as React.CSSProperties,

    weekDayCount: {
      fontSize: 12,
      background: "var(--c-brand)",
      color: "#fff",
      borderRadius: 10,
      padding: "1px 6px",
      fontWeight: 600,
      lineHeight: 1.6,
    } as React.CSSProperties,

    weekTimeLabel: {
      fontSize: 11,
      color: "var(--c-gray-400)",
      fontWeight: 500,
      textAlign: "right" as const,
      paddingRight: 8,
      paddingTop: 6,
      borderTop: "1px solid var(--c-gray-100)",
      userSelect: "none" as const,
    } as React.CSSProperties,

    weekSlot: {
      minHeight: 48,
      borderTop: "1px solid var(--c-gray-100)",
      borderLeft: "1px solid var(--c-gray-100)",
      padding: "3px 4px",
      cursor: "pointer",
      display: "flex",
      flexDirection: "column" as const,
      gap: 2,
      transition: "background 0.1s",
      minWidth: 0,
      overflow: "hidden",
    } as React.CSSProperties,


    dayGrid: {
      display: "flex",
      flexDirection: "column" as const,
    } as React.CSSProperties,

    dayRow: {
      display: "grid",
      gridTemplateColumns: "64px 1fr",
      borderTop: "1px solid var(--c-gray-100)",
      minHeight: 52,
    } as React.CSSProperties,

    dayTimeLabel: {
      fontSize: 12,
      color: "var(--c-gray-400)",
      fontWeight: 500,
      textAlign: "right" as const,
      paddingRight: 12,
      paddingTop: 8,
      userSelect: "none" as const,
    } as React.CSSProperties,

    daySlot: {
      padding: "4px 8px",
      cursor: "pointer",
      display: "flex",
      flexDirection: "column" as const,
      gap: 3,
      transition: "background 0.1s",
      borderRadius: 4,
    } as React.CSSProperties,

    dayEmpty: {
      color: "var(--c-gray-400)",
      fontSize: 14,
      padding: "32px 0",
      textAlign: "center" as const,
    } as React.CSSProperties,
  } satisfies Record<string, React.CSSProperties>;
