"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-scroll-area";
import { cn } from "@/lib/utils";

export interface ScrollingTextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  asChild?: boolean;
}

const ScrollingTextArea = React.forwardRef<HTMLTextAreaElement, ScrollingTextAreaProps>({
  className,
  children,
  ...props,
}) => {
  const Comp = Slot;
  return (
    <Comp
      className={cn(
        "flex h-64 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      )}
      {...props}
    >
      {children}
    </Comp>
  );
});

ScrollingTextArea.displayName = "ScrollingTextArea";

export { ScrollingTextArea };