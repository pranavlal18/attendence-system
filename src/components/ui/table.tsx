"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-table";
import { cn } from "@/lib/utils";

export interface TableProps {
  className?: string;
  children: React.ReactNode;
}

const Table = React.forwardRef<HTMLDivElement, TableProps>({
  className,
  children,
  ...props,
}) => {
  const Comp = Slot;
  return (
    <Comp className={cn("w-full divide-y divide-border/20")} {...props}>
      {children}
    </Comp>
  );
});

Table.displayName = "Table";

export { Table };

export interface TableHeaderProps {
  className?: string;
  children: React.ReactNode;
}

const TableHeader = React.forwardRef<HTMLDivElement, TableHeaderProps>({
  className,
  children,
  ...props,
}) => {
  const Comp = Slot;
  return (
    <Comp className={cn("divide-y divide-border/20")} {...props}>
      {children}
    </Comp>
  );
});

TableHeader.displayName = "TableHeader";

export { TableHeader };

export interface TableRowProps {
  className?: string;
  children: React.ReactNode;
}

const TableRow = React.forwardRef<HTMLDivElement, TableRowProps>({
  className,
  children,
  ...props,
}) => {
  const Comp = Slot;
  return (
    <Comp className={cn("hover:bg-muted/50")} {...props}>
      {children}
    </Comp>
  );
});

TableRow.displayName = "TableRow";

export { TableRow };

export interface TableCellProps extends React.TableCellProps {
  className?: string;
}

const TableCell = React.forwardRef<HTMLTableCellElement, TableCellProps>({
  className,
  ...props,
}) => {
  const Comp = Slot;
  return (
    <Comp
      className={cn(
        "px-6 py-3 align-middle font-medium text-sm",
        "text-muted-foreground",
      )}
      {...props}
    >
      {props.children}
    </Comp>
  );
});

TableCell.displayName = "TableCell";

export { TableCell };

export interface TableHeadProps {
  className?: string;
  children: React.ReactNode;
}

const TableHead = React.forwardRef<HTMLTableCellElement, TableHeadProps>({
  className,
  children,
  ...props,
}) => {
  const Comp = Slot;
  return (
    <Comp
      className={cn(
        "px-6 py-3 align-middle text-xs font-medium text-muted-foreground uppercase",
      )}
      {...props}
    >
      {props.children}
    </Comp>
  );
});

TableHead.displayName = "TableHead";

export { TableHead };