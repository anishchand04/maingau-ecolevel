import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Pro Ansicht genau eine Primäraktion (variant "primary"), alles andere outline/ghost/link.
const pillVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-5 [&_svg]:shrink-0 [&_svg]:stroke-[1.75]",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline: "border-2 border-foreground bg-transparent text-foreground hover:bg-accent",
        ghost: "text-foreground hover:bg-accent",
        link: "px-0 text-primary underline-offset-4 hover:underline",
      },
      size: {
        md: "min-h-12 px-6 text-[15px]",
        sm: "min-h-9 px-4 text-sm [&_svg]:size-4",
        icon: "size-12 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface PillButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof pillVariants> {
  asChild?: boolean;
}

export const PillButton = React.forwardRef<HTMLButtonElement, PillButtonProps>(
  ({ className, variant, size, asChild = false, type = "button", ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp ref={ref} type={asChild ? undefined : type} className={cn(pillVariants({ variant, size }), className)} {...props} />;
  },
);
PillButton.displayName = "PillButton";

export { pillVariants };
