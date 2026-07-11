import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", type = "text", ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={`w-full bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2.5 text-white text-sm font-mono focus:border-slate-600 focus:outline-none placeholder:text-slate-500/80 transition-all ${className}`}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
