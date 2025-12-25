interface CircularProgressProps {
  value: number;
  dayValue?: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  dayColor?: string;
  label: string;
  sublabel?: string;
}

export function CircularProgress({
  value,
  dayValue,
  size = 100,
  strokeWidth = 8,
  color = '#3b82f6',
  dayColor = '#93c5fd',
  label,
  sublabel,
}: CircularProgressProps) {
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = Math.min(value, 100);
  const dayProgress = dayValue !== undefined ? Math.min(dayValue, 100) : 0;
  const offset = circumference - (progress / 100) * circumference;

  const outerRadius = radius + strokeWidth + 2;
  const svgSize = size + 20;
  const offset2 = 10;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          className="transform -rotate-90"
          width={svgSize}
          height={svgSize}
          style={{ marginLeft: -offset2, marginTop: -offset2 }}
        >
          {/* Background circle */}
          <circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
          />
          {/* Day progress (outer thin ring) */}
          {dayValue !== undefined && (
            <circle
              cx={svgSize / 2}
              cy={svgSize / 2}
              r={outerRadius}
              fill="none"
              stroke={dayColor}
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray={`${outerRadius * 2 * Math.PI}`}
              strokeDashoffset={
                outerRadius * 2 * Math.PI -
                (dayProgress / 100) * outerRadius * 2 * Math.PI
              }
              className="transition-all duration-500"
            />
          )}
          {/* Main progress */}
          <circle
            cx={svgSize / 2}
            cy={svgSize / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-500"
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-gray-900">{label}</span>
          {sublabel && <span className="text-xs text-gray-500">{sublabel}</span>}
        </div>
      </div>
      <div className="mt-2 text-center">
        <div className="text-sm font-medium text-gray-700">{Math.round(value)}%</div>
        {dayValue !== undefined && (
          <div className="text-xs text-gray-500">к дню: {Math.round(dayValue)}%</div>
        )}
      </div>
    </div>
  );
}
