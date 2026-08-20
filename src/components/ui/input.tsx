"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  asChild?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>({
  className,
  ...props,
}) => {
  const Comp = Slot;
  return (
    <Comp
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder-muted [&>:not(:first-child)]:after:content-[''] [&>:not(:first-child)]:after:absolute [&>:not(:first-child)]:after:right-0 after:-translate-y-1/2 after:mr-1 after:h-0.5 after:w-0.5 after:rounded-md after:bg-border",
        "&:focus",
        "ring-2 ring-ring",
        "data-[state=open]:after:transition-opacity",
        "data-[state=open]:after:opacity-100",
      )}
      {...props}
    >
      {props.children}
    </Comp>
  );
});

Input.displayName = "Input";

export { Input };