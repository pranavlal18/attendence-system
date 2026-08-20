"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

export interface SelectTriggerProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
}

const SelectTrigger = React.forwardRef<HTMLDivElement, SelectTriggerProps>({
  className,
  children,
  ...props,
}) => {
  const Comp = Slot;
  return (
    <Comp className={cn("relative flex cursor-default select-none items-center rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&>span]:pointer-events-none [>span]:flex [>span]:items-center [>span]:rounded-md [>span]:bg-muted [>span]:text-muted-foreground")} {...props}>
      {children}
    </Comp>
  );
});

SelectTrigger.displayName = "SelectTrigger";

export { SelectTrigger };

export interface SelectValueProps extends React.HTMLAttributes<HTMLSpanElement> {
  asChild?: boolean;
}

const SelectValue = React.forwardRef<HTMLSpanElement, SelectValueProps>({
  className,
  children,
  ...props,
}) => {
  const Comp = Slot;
  return (
    <Comp className={cn("flex items-center rounded-md bg-background px-3 py-2 text-sm")} {...props}>
      {children}
    </Comp>
  );
});

SelectValue.displayName = "SelectValue";

export { SelectValue };

export interface SelectContentProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
}

const SelectContent = React.forwardRef<HTMLDivElement, SelectContentProps>({
  className,
  children,
  ...props,
}) => {
  const Comp = Slot;
  return (
    <Comp className={cn("z-50 rounded-md bg-popover p-2 text-sm shadow-md ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=open]:invisible data-[state=closed]:visible fade-in")} {...props}>
      {children}
    </Comp>
  );
});

SelectContent.displayName = "SelectContent";

export { SelectContent };

export interface SelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
}

const SelectItem = React.forwardRef<HTMLDivElement, SelectItemProps>({
  className,
  children,
  ...props,
}) => {
  const Comp = Slot;
  return (
    <Comp className={cn("relative flex cursor-default select-none items-center rounded-sm py-1.5 pr-8 pl-2 text-sm outline-none focus-data-[state=selected]:bg-primary data-[state=selected]:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&>span]:pointer-events-none [&>span]:flex [&>span]:items-center [&>span]:rounded-md [&>span]:bg-muted [&>span]:text-muted-foreground")} {...props}>
      {children}
    </Comp>
  );
});

SelectItem.displayName = "SelectItem";

export { SelectItem };

export interface SelectSeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
}

const SelectSeparator = React.forwardRef<HTMLDivElement, SelectSeparatorProps>({
  className,
  children,
  ...props,
}) => {
  const Comp = Slot;
  return (
    <Comp className={cn("h-px my-0 mx-2 bg-muted")} {...props}>
      {children}
    </Comp>
  );
});

SelectSeparator.displayName = "SelectSeparator";

export { SelectSeparator };