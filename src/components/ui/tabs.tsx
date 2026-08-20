"use client";

import * as React from "react";

export interface TabsProps {
  className?: string;
  defaultValue?: string;
  children: React.ReactNode;
}

const Tabs = ({ className, defaultValue, children, ...rest }: TabsProps) => {
  return (
    <div className={className} {...rest}>
      {children}
    </div>
  );
};

Tabs.displayName = "Tabs";

export interface TabsTriggerProps extends React.HTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

const TabsTrigger = ({ className, children, ...rest }: TabsTriggerProps) => {
  return (
    <button className={className} {...rest}>
      {children}
    </button>
  );
};

TabsTrigger.displayName = "TabsTrigger";