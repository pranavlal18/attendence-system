"use client";

import * as React from "react";

export interface ScrollingTextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  children: React.ReactNode;
}

const ScrollingTextArea = ({ className, children, ...rest }: ScrollingTextAreaProps) => {
  return (
    <textarea className={className} {...rest} />
  );
};

ScrollingTextArea.displayName = "ScrollingTextArea";

export { ScrollingTextArea };