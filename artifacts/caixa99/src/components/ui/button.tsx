import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "primary", size = "md", ...props }, ref) => {
    let baseStyle = "inline-flex items-center justify-center font-bold tracking-wide rounded-lg transition-all duration-200 focus:outline-none cursor-pointer active:scale-95 disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100";
    
    let sizeStyle = "px-4 py-2 text-xs";
    if (size === "sm") sizeStyle = "px-2.5 py-1.5 text-[14.5px]";
    if (size === "lg") sizeStyle = "px-6 py-3 text-sm";

    let variantStyle = "bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600/20 shadow-md shadow-amber-500/5";
    if (variant === "secondary") {
      variantStyle = "bg-slate-800 hover:bg-slate-750 text-slate-100 border border-slate-700/80";
    } else if (variant === "outline") {
      variantStyle = "bg-transparent hover:bg-slate-800/40 text-slate-300 border border-slate-700/80";
    } else if (variant === "ghost") {
      variantStyle = "bg-transparent hover:bg-slate-800/40 text-slate-300";
    } else if (variant === "destructive") {
      variantStyle = "bg-rose-650 hover:bg-rose-550 text-white border border-rose-700/30";
    }

    return (
      <button
        ref={ref}
        className={`${baseStyle} ${sizeStyle} ${variantStyle} ${className}`}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
