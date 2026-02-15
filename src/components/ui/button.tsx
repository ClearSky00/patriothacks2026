import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold tracking-tight transition-all duration-200 cursor-pointer disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/85",
        destructive:
          "bg-destructive text-white hover:bg-destructive/85",
        outline:
          "border border-black/10 bg-transparent text-muted-foreground hover:bg-black/3 hover:text-foreground hover:border-black/20",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/70",
        ghost:
          "hover:bg-black/5 hover:text-foreground text-muted-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        primary:
          "bg-[#111] text-white shadow-[0_2px_12px_rgba(0,0,0,0.15)] hover:not-disabled:bg-[#222] hover:not-disabled:-translate-y-px active:translate-y-0",
        accent:
          "bg-[#111] text-white font-bold shadow-[0_2px_12px_rgba(0,0,0,0.15)] hover:not-disabled:bg-[#333] hover:not-disabled:-translate-y-px active:translate-y-0",
        "icon-ghost":
          "bg-transparent text-muted-foreground hover:text-destructive",
      },
      size: {
        default: "h-10 px-5 py-2.5 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-lg px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 rounded-lg gap-1.5 px-3.5 has-[>svg]:px-2.5 text-xs",
        lg: "h-12 rounded-xl px-7 has-[>svg]:px-5 text-base",
        icon: "size-9 rounded-xl",
        "icon-xs": "size-6 rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8 rounded-lg",
        "icon-lg": "size-10 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
