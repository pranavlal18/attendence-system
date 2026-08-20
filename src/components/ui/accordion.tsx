"use client";

import * as React from "react";

export interface AccordionItemProps {
  className?: string;
  children: React.ReactNode;
}

const AccordionItem = ({ className, children, ...rest }: AccordionItemProps) => {
  return (
    <div className={className} {...rest}>{children}</div>
  );
};

AccordionItem.displayName = "AccordionItem";

export interface AccordionHeaderProps extends React.HTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

const AccordionHeader = ({ className, children, ...rest }: AccordionHeaderProps & React.HTMLAttributes<HTMLButtonElement>) => {
  return (
    <button className={className} {...rest}>
      {children}
    </button>
  );
};

AccordionHeader.displayName = "AccordionHeader";

export interface AccordionContentProps {
  className?: string;
  children: React.ReactNode;
}

const AccordionContent = ({ className, children, ...rest }: AccordionContentProps) => {
  return (
    <div className={className} {...rest}>{children}</div>
  );
};

AccordionContent.displayName = "AccordionContent";

export { AccordionContent };