import React from "react";
import { cn } from "./cn";

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  wrapperClassName?: string;
}

export const Table: React.FC<TableProps> = ({ wrapperClassName, className, children, ...props }) => (
  <div
    className={cn(
      "rounded-lg border border-[var(--kuara-border)] bg-[var(--kuara-surface)] overflow-hidden",
      wrapperClassName
    )}
  >
    <div className="overflow-x-auto">
      <table className={cn("w-full border-collapse text-left text-xs", className)} {...props}>
        {children}
      </table>
    </div>
  </div>
);

export const TableHeader: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  className,
  children,
  ...props
}) => (
  <thead
    className={cn(
      "bg-[var(--kuara-surface-muted)] border-b border-[var(--kuara-border)]",
      className
    )}
    {...props}
  >
    {children}
  </thead>
);

export const TableBody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  className,
  children,
  ...props
}) => (
  <tbody className={cn("divide-y divide-[var(--kuara-border)]", className)} {...props}>
    {children}
  </tbody>
);

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  interactive?: boolean;
}

export const TableRow: React.FC<TableRowProps> = ({
  interactive = true,
  className,
  children,
  ...props
}) => (
  <tr
    className={cn(
      "transition-colors",
      interactive && "hover:bg-[var(--kuara-surface-hover)]/60",
      className
    )}
    {...props}
  >
    {children}
  </tr>
);

export interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  align?: "left" | "center" | "right";
}

const ALIGN_CLASSES = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

export const TableHead: React.FC<TableHeadProps> = ({
  align = "left",
  className,
  children,
  ...props
}) => (
  <th
    className={cn(
      "h-9 px-3.5 text-[11px] font-medium text-[var(--kuara-fg-muted)] whitespace-nowrap select-none",
      ALIGN_CLASSES[align],
      className
    )}
    {...props}
  >
    {children}
  </th>
);

export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  align?: "left" | "center" | "right";
  numeric?: boolean;
}

export const TableCell: React.FC<TableCellProps> = ({
  align = "left",
  numeric = false,
  className,
  children,
  ...props
}) => (
  <td
    className={cn(
      "px-3.5 py-2.5 text-xs text-[var(--kuara-fg)] align-middle",
      ALIGN_CLASSES[align],
      numeric && "tabular-nums",
      className
    )}
    {...props}
  >
    {children}
  </td>
);

export interface TableEmptyProps {
  colSpan: number;
  children: React.ReactNode;
}

export const TableEmpty: React.FC<TableEmptyProps> = ({ colSpan, children }) => (
  <tr>
    <td colSpan={colSpan} className="p-0">
      {children}
    </td>
  </tr>
);
