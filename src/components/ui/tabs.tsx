"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export interface TabsProps {
  className?: string;
  defaultValue?: string;
  ...props: any;
}

const Tabs = React.forwardRef<HTMLDivElement, TabsProps>({
  className,
  defaultValue,
  children,
  ...props,
}) => {
  const Comp = Slot;
  return (
    <Comp className={cn("flex border-b bg-muted/50")} {...props}>
      {children}
    </Comp>
  );
});

Tabs.displayName = "Tabs";

export { Tabs };

export interface TabsListProps extends React.HTMLAttributes<HTMLUListElement> {
  asChild?: boolean;
}

const TabsList = React.forwardRef<HTMLUListElement, TabsListProps>({
  className,
  ...props,
}) => {
  const Comp = Slot;
  return (
    <Comp
      className={cn(
        "flex w- flex-1 rounded-md bg-transparent p-1",
        "data-[state=active]:bg-accent data-[state=active]:text-accent-foreground",
        "data-[state=inactive]:bg-transparent data-[state=inactive]:text-muted-foreground",
        "data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:w-full data-[state=active]:after:h-0.5 data-[state=active]:after:content-[''] data-[state=active]:after:bg-accent",
        "data-[state=after]:after:after:after:after:after after:after:transition-colors-[var(--animated-transition,$default-duration,$default-transition)]",
      )}
      {...props}
    >
      {children}
    </Comp>
  );
});

TabsList.displayName = "TabsList";

export { TabsList };

export interface TabsProps as TabsHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  ...props: any;
}

const TabsTabs = React.forwardRef<HTMLDivElement, TabsProps>({
  className,
  ...props,
}) => {
  const Comp = Slot;
  return (
    <Comp className={cn("flex w-full")} {...props}>
      {children}
    </Comp>
  );
});

TabsTabs.displayName = "TabsTabs";

export { TabsTabs };

export interface TabsTriggerProps extends React.HTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>({
  className,
  children,
  ...props,
}) => {
  const Comp = Slot;
  return (
    <Comp
      className={cn(
        "flex-1 rounded-md px-2 py-1.5 text-sm font-medium color-foreground transition-colors",
        "data-[state=active]:bg-accent data-[state=active]:text-accent-foreground",
        "data-[state=inactive]:bg-transparent data-[state=inactive]:text-muted-foreground",
        "data-[state=active]:after:bottom-0 data-[state=active]:after:left-0 data-[state=active]:after:w-full data-[state=active]:after:h-0.5 data-[state=active]:after:content-[''] data-[state=active]:after:bg-accent",
      )}
      {...props}
    >
      {children}
    </Comp>
  );
});

TabsTrigger.displayName = "TabsTrigger";

export { TabsTrigger };