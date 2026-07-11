import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className = "", ...props }, ref) => (
    <div
      ref={ref}
      className={`bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-xl shadow-lg transition-all ${className}`}
      {...props}
    />
  )
);
Card.displayName = "Card";

export const CardHeader = ({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`p-5 pb-3 border-b border-slate-800/40 flex flex-col gap-1 ${className}`} {...props} />
);
CardHeader.displayName = "CardHeader";

export const CardTitle = ({ className = "", ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={`text-sm font-bold text-slate-100 uppercase tracking-wider ${className}`} {...props} />
);
CardTitle.displayName = "CardTitle";

export const CardDescription = ({ className = "", ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={`text-[14.5px] text-slate-400/80 mt-1 leading-normal ${className}`} {...props} />
);
CardDescription.displayName = "CardDescription";

export const CardContent = ({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`p-5 ${className}`} {...props} />
);
CardContent.displayName = "CardContent";

export const CardFooter = ({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={`p-5 pt-3 border-t border-slate-800/40 flex items-center justify-between ${className}`} {...props} />
);
CardFooter.displayName = "CardFooter";
