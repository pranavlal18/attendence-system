"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

export interface DialogProps {
  asChild?: boolean;
}

const Dialog = React.forwardRef<HTMLDialogElement, DialogProps>({
  className,
  children,
  ...props,
}) => {
  const Comp = Slot;
  return (
    <Comp className={cn("modal")} {...props}>
      {children}
    </Comp>
  );
});

Dialog.displayName = "Dialog";

export { Dialog };

export interface DialogTriggerProps extends React.HTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

const DialogTrigger = React.forwardRef<HTMLButtonElement, DialogTriggerProps>({
  className,
  children,
  ...props,
}) => {
  const Comp = Slot;
  return (
    <Comp className={cn("btn btn-ghost icon-bottom")} {...props}>
      {children}
    </Comp>
  );
});

DialogTrigger.displayName = "DialogTrigger";

export { DialogTrigger };

export interface DialogContentProps extends React.HTMLAttributes<HTMLDialogElement> {
  asChild?: boolean;
}

const DialogContent = React.forwardRef<HTMLDialogElement, DialogContentProps>({
  openClassName,
  closedClassName,
  className,
  children,
  ...props,
}) => {
  const Comp = Slot;
  return (
    <Comp
      openClassName={openClassName}
      closedClassName={closedClassName}
      className={cn(
        "fixed bottom-0 left-0 right-0 max-w-lg p-4 bd-yellow bd bd-solid bd-rounded-md",
        "from-transparent via-white/10 to-transparent",
        "pb-8",
      )}
      {...props}
    >
      {children}
    </Comp>
  );
});

DialogContent.displayName = "DialogContent";

export { DialogContent };

export interface DialogFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
}

const DialogFooter = React.forwardRef<HTMLDivElement, DialogFooterProps>({
  className,
  children,
  ...props,
}) => {
  const Comp = Slot;
  return (
    <Comp className={cn("flex justify-end space-x-2 pt-2")} {...props}>
      {children}
    </Comp>
  );
});

DialogFooter.displayName = "DialogFooter";

export { DialogFooter };