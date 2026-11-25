// Shared recharts styling constants so charts follow the theme tokens in light and dark mode.
export const chartTooltipProps = {
  contentStyle: {
    backgroundColor: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: "12px",
    color: "var(--foreground)",
    fontSize: "11px",
    boxShadow: "0 8px 24px rgb(0 0 0 / 0.15)",
  },
  labelStyle: { color: "var(--foreground)", fontWeight: 700 },
  itemStyle: { color: "var(--foreground)" },
  cursor: { fill: "var(--structure)" },
};

export const BRAND_BAR_FILL = "url(#brand-bar-gradient)";
