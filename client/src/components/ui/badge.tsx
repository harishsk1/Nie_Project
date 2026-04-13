import * as React from "react";
import { cn } from "../../lib/utils";
// import { cn } from "../../utils/constants";
// import { cn } from "../../utils/helpers";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "warning" | "critical";
}

const badgeVariants = {
  default: "bg-green-100 text-green-800",
  warning: "bg-yellow-100 text-yellow-800",
  critical: "bg-red-100 text-red-800",
};

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = "default", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "text-xs font-medium px-2 py-1 rounded-full inline-block",
        badgeVariants[variant],
        className
      )}
      {...props}
    />
  )
);
Badge.displayName = "Badge";

export { Badge };
