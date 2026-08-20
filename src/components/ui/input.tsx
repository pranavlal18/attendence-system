"use client";

import * as React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  children: React.ReactNode;
}

const Input = ({ className, children, ...rest }: InputProps) => {
  return (
    <input className={className} {...rest} />
  );
};

Input.displayName = "Input";

export { Input };