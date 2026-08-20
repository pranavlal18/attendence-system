"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";

export interface DropdownMenuProps {
  asChild?: boolean;
}

const DropdownMenu = React.forwardRef<HTMLDivElement, DropdownMenuProps>({
  className,
  children,
  ...props,
}) => {
  const Comp = Slot;
  return (
    <Comp className={cn("flex flex-col gap-2")} {...props}>
      {children}
    </Comp>
  );
});

DropdownMenu.displayName = "DropdownMenu";

export { DropdownMenu };

export interface DropdownMenuTriggerProps extends React.HTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

const DropdownMenuTrigger = React.forwardRef<HTMLButtonElement, DropdownMenuTriggerProps>({
  className,
  children,
  ...props,
}) => {
  const Comp = Slot;
  return (
    <Comp className={cn("flex items-center rounded-md bg-background p-2 text-sm")} {...props}>
      {children}
    </Comp>
  );
});

DropdownMenuTrigger.displayName = "DropdownMenuTrigger";

export { DropdownMenuTrigger };

export interface DropdownMenuContentProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
}

const DropdownMenuContent = React.forwardRef<HTMLDivElement, DropdownMenuContentProps>({
  className,
  children,
  ...props,
}) => {
  const Comp = Slot;
  return (
    <Comp
      className={cn("z-10 rounded-md bg-popover p-1 shadow-md ring-offset-background"),
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-0 data-[state=open]:fade-in-0",
        "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-100",
        "data-[state=closed]:slide-out-to-left-0 data-[state=open]:slide-in-from-left-0",
        "data-[state=closed]:slide-out-to-top-[var(--dh)] data-[state=open]:slide-in-from-top-0",
        "sm:rounded-lg sm:py-1"},
      {...props}
    >
      {children}
    </Comp>
  );
});

DropdownMenuContent.displayName = "DropdownMenuContent";

export { DropdownMenuContent };

export interface DropdownMenuItemProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
}

const DropdownMenuItem = React.forwardRef<HTMLDivElement, DropdownMenuItemProps>({
  className,
  children,
  ...props,
}) => {
  const Comp = Slot;
  return (
    <Comp
      className={cn("flex cursor-default select-none items-center rounded-sm py-1.5 pr-8 pl-2 text-sm outline-none focus-data-[state=selected]:bg-primary data-[state=selected]:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&>span]:pointer-events-none [&>span]:flex [&>span]:items-center [&>span]:rounded-md [&>span]:bg-muted [&>span]:text-muted-foreground")} {...props}>
      {children}
    </Comp>
  );
});

DropdownMenuItem.displayName = "DropdownMenuItem";

export { DropdownMenuItem };

export interface DropdownMenuSeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
}

const DropdownMenuSeparator = React.forwardRef<HTMLDivElement, DropdownMenuSeparatorProps>({
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

DropdownMenuSeparator.displayName = "DropdownMenuSeparator";

export { DropdownMenuSeparator };