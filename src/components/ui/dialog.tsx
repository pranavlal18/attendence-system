"use client";

import * as React from "react";

export interface DialogProps {
  className?: string;
  children: React.ReactNode;
}

const Dialog = ({ className, children, ...rest }: DialogProps) => {
  return (
    <dialog className={className} {...rest}>
      {children}
    </dialog>
  );
};

Dialog.displayName = "Dialog";

export interface DialogTriggerProps extends React.HTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

const DialogTrigger = ({ className, children, ...rest }: DialogTriggerProps) => {
  return (
    <button className={className} {...rest}>
      {children}
    </button>
  );
};

DialogTrigger.displayName = "DialogTrigger";

export interface DialogContentProps {
  className?: string;
  children: React.ReactNode;
}

const DialogContent = ({ className, children, ...rest }: DialogContentProps) => {
  return (
    <dialog className={className} {...rest}>
      {children}
    </dialog>
  );
};

DialogContent.displayName = "DialogContent";

export interface DialogFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const DialogFooter = ({ className, children, ...rest }: DialogFooterProps) => {
  return <div className={className} {...rest}>{children}</div>;
};

DialogFooter.displayName = "DialogFooter";

export { DialogTrigger, DialogContent, DialogFooter };