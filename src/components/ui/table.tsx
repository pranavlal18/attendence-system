"use client";

import * as React from "react";

export interface TableProps {
  className?: string;
  children: React.ReactNode;
}

function Table({ className, children, ...rest }: TableProps) {
  return (
    <div className={className} {...rest}>
      {children}
    </div>
  );
}

Table.displayName = "Table";

export interface TableHeaderProps {
  className?: string;
  children: React.ReactNode;
}

function TableHeader({ className, children, ...rest }: TableHeaderProps) {
  return (
    <div className={className} {...rest}>
      {children}
    </div>
  );
}

TableHeader.displayName = "TableHeader";

export interface TableRowProps {
  className?: string;
  children: React.ReactNode;
}

function TableRow({ className, children, ...rest }: TableRowProps) {
  return (
    <div className={className} {...rest}>{children}</div>
  );
}

TableRow.displayName = "TableRow";

export interface TableCellProps {
  className?: string;
  children: React.ReactNode;
}

function TableCell({ className, children, ...rest }: TableCellProps) {
  return (
    <div className={className} {...rest}>{children}</div>
  );
}

TableCell.displayName = "TableCell";

export interface TableHeadProps {
  className?: string;
  children: React.ReactNode;
}

function TableHead({ className, children, ...rest }: TableHeadProps) {
  return (
    <div className={className} {...rest}>{children}</div>
  );
}

TableHead.displayName = "TableHead";

export { Table, TableHeader, TableRow, TableCell, TableHead };