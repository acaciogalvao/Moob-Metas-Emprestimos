import React from "react";

export interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  value: number[];
  onValueChange?: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
}

export const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className = "", value = [0], onValueChange, min = 0, max = 100, step = 1, ...props }, ref) => {
    const currentValue = value[0] ?? 0;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const num = Number(e.target.value);
      if (onValueChange) {
        onValueChange([num]);
      }
    };

    return (
      <div className={`w-full flex items-center ${className}`}>
        <input
          ref={ref}
          type="range"
          min={min}
          max={max}
          step={step}
          value={currentValue}
          onChange={handleChange}
          className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-amber-500 border border-slate-800"
          {...props}
        />
      </div>
    );
  }
);
Slider.displayName = "Slider";
