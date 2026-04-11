import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]",
  {
    variants: {
      variant: {
        default: "border-white/10 bg-white/5 text-slate-200",
        secondary: "border-sky-500/20 bg-sky-500/10 text-sky-200",
        success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
        destructive: "border-rose-500/20 bg-rose-500/10 text-rose-300",
        outline: "border-white/15 bg-transparent text-slate-300"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
