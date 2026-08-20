"use client";

import * as React from "react";

export interface DropdownMenuProps {
  className?: string;
  children: React.ReactNode;
}

const DropdownMenu = ({ className, children, ...rest }: DropdownMenuProps) => {
  return (
    <div className={className} {...rest}>
      {children}
    </div>
  );
};

DropdownMenu.displayName = "DropdownMenu";

export interface DropdownMenuTriggerProps extends React.HTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

const DropdownMenuTrigger = ({ className, children, ...rest }: DropdownMenuTriggerProps) => {
  return (
    <button className={className} {...rest}>
      {children}
    </button>
  );
};

DropdownMenuTrigger.displayName = "DropdownMenuTrigger";

export interface DropdownMenuContentProps {
  className?: string;
  children: React.ReactNode;
}

const DropdownMenuContent = ({ className, children, ...rest }: DropdownMenuContentProps) => {
  return (
    <div className={className} {...rest}>
      {children}
    </div>
  );
};

DropdownMenuContent.displayName = "DropdownMenuContent";

export interface DropdownMenuItemProps {
  className?: string;
  children: React.ReactNode;
}

const DropdownMenuItem = ({ className, children, ...rest }: DropdownMenuItemProps) => {
  return (
    <div className={className} {...rest}>
      {children}
    </div>
  );
};

DropdownMenuItem.displayName = "DropdownMenuItem";

export interface DropdownMenuSeparatorProps {
  className?: string;
  children: React.ReactNode;
}

const DropdownMenuSeparator = ({ className, children, ...rest }: DropdownMenuSeparatorProps) => {
  return <div className={className} {...rest} />;
};

DropdownMenuSeparator.displayName = "DropdownMenuSeparator";

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator };