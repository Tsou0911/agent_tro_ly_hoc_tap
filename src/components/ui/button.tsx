import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 disabled:pointer-events-none disabled:opacity-50", {
  variants: {
    variant: {
      default: "bg-primary text-white hover:bg-[#0f3d31]",
      outline: "border border-border bg-white text-foreground hover:bg-muted",
      secondary: "bg-[#e1eddb] text-primary hover:bg-[#cfdfc9]",
      ghost: "text-primary hover:bg-muted",
      destructive: "bg-red-700 text-white hover:bg-red-800",
      link: "text-primary underline-offset-4 hover:underline"
    },
    size: { default: "h-11 px-5 text-sm", sm: "h-9 px-3 text-sm", lg: "h-12 px-6 text-base", icon: "h-10 w-10" }
  }, defaultVariants: {variant: "default", size: "default"}
});
type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & { asChild?: boolean };
export const Button = React.forwardRef<HTMLButtonElement, Props>(({asChild, className, variant, size, ...props}, ref) => {
  const Component = asChild ? Slot : "button";
  return <Component ref={ref} className={cn(buttonVariants({variant, size}), className)} {...props} />;
});
Button.displayName = "Button";
