import React from "react";

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number; // 0 to 100
}

export const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className = "", value = 0, ...props }, ref) => {
    const clampedValue = Math.min(100, Math.max(0, value));

    return (
      <div
        ref={ref}
        className={`relative w-full h-2 overflow-hidden bg-slate-950 border border-slate-800/80 rounded-full ${className}`}
        {...props}
      >
        <div
          className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-300 rounded-full"
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    );
  }
);
Progress.displayName = "Progress";
