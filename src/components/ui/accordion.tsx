"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-accordion";
import { cn } from "@/lib/utils";

export interface AccordionItemProps {
  className?: string;
  children: React.ReactNode;
  ...props: any;
}

const AccordionItem = React.forwardRef<HTMLDivElement, AccordionItemProps>({
  className,
  children,
  ...props,
}) => {
  const Comp = Slot;
  return (
    <Comp className={cn("rounded-md bg-background border-y")} {...props}>
      {children}
    </Comp>
  );
});

AccordionItem.displayName = "AccordionItem";

export { AccordionItem };

export interface AccordionHeaderProps extends React.HTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

const AccordionHeader = React.forwardRef<HTMLButtonElement, AccordionHeaderProps>({
  className,
  children,
  ...props,
}) => {
  const Comp = Slot;
  return (
    <Comp
      className={cn(
        "flex w-full justify-between rounded-md px-3 py-2 text-left",
        "gap-3",
        "data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
        "data-[state=closed]:bg-transparent data-[state=closed]:text-muted-foreground",
        "active:bg-muted/50",
      )}
      {...props}
    >
      {children}
    </Comp>
  );
});

AccordionHeader.displayName = "AccordionHeader";

export { AccordionHeader };

export interface AccordionContentProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
}

const AccordionContent = React.forwardRef<HTMLDivElement, AccordionContentProps>({
  className,
  children,
  ...props,
}) => {
  const Comp = Slot;
  return (
    <Comp
      className={cn(
        "px-3 py-2",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[state=closed]:slide-out-to-left-0 data-[state=closed]:slide-out-to-top-0 data-[state=closed]:slide-out-from-left-0 data-[state=closed]:slide-out-from-top-0",
        "data-[state=open]:slide-in-from-left-0 data-[state=open]:slide-in-from-top-0",
        "data-[state=open]:from-0 data-[state=open]:to-0",
        "sm:p-4",
      )}
      {...props}
    >
      {children}
    </Comp>
  );
});

AccordionContent.displayName = "AccordionContent";

export { AccordionContent };