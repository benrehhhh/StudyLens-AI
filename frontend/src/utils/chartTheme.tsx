// Shared recharts styling so charts follow the theme tokens in light and dark mode.

// Render inside a recharts chart (e.g. <BarChart>) to define the gradient fill.
export function ChartGradientDefs() {
  return (
    <defs>
      <linearGradient id="brand-bar-gradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#6366f1" />
        <stop offset="100%" stopColor="#10b981" />
      </linearGradient>
    </defs>
  );
}
