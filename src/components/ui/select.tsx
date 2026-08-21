"use client";

import * as React from "react";

export const Select = ({ children, ...rest }: { children?: React.ReactNode; [key: string]: any }) => {
  return <div {...rest}>{children}</div>;
};
Select.displayName = "Select";

export interface SelectTriggerProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

const SelectTrigger = ({ className, children, ...rest }: SelectTriggerProps) => {
  return (
    <div className={className} {...rest}>
      {children}
    </div>
  );
};

SelectTrigger.displayName = "SelectTrigger";

export interface SelectValueProps extends React.HTMLAttributes<HTMLSpanElement> {
  children?: React.ReactNode;
}

const SelectValue = ({ className, children, ...rest }: SelectValueProps) => {
  return (
    <span className={className} {...rest}>
      {children}
    </span>
  );
};

SelectValue.displayName = "SelectValue";

export interface SelectContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

const SelectContent = ({ className, children, ...rest }: SelectContentProps) => {
  return (
    <div className={className} {...rest}>
      {children}
    </div>
  );
};

SelectContent.displayName = "SelectContent";

export interface SelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  value?: string;
  defaultSelected?: boolean;
}

const SelectItem = ({ className, children, ...rest }: SelectItemProps) => {
  return (
    <div className={className} {...rest}>
      {children}
    </div>
  );
};

SelectItem.displayName = "SelectItem";

export interface SelectSeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

const SelectSeparator = ({ className, children, ...rest }: SelectSeparatorProps) => {
  return <div className={className} {...rest} />;
};

SelectSeparator.displayName = "SelectSeparator";

export { SelectTrigger, SelectValue, SelectContent, SelectItem, SelectSeparator };