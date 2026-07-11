import React from "react";

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className = "", ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={`text-[12.5px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block ${className}`}
        {...props}
      />
    );
  }
);
Label.displayName = "Label";
