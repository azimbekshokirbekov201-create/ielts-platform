"use client";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { X, Inbox, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
export function Card({ className, ...props }: React.ComponentProps<"section">) {
  return <section className={cn("card", className)} {...props} />;
}
export function Badge({
  children,
  color = "blue",
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return <span className={`badge ${color}`}>{children}</span>;
}
export function Progress({ value, label }: { value: number; label: string }) {
  return (
    <div
      className="progress-track"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
    >
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}
export function Input(props: React.ComponentProps<"input">) {
  return <input className="input" {...props} />;
}
export function Select({
  label,
  children,
  ...props
}: React.ComponentProps<"select"> & { label: string }) {
  return (
    <label className="field">
      {label}
      <select className="input" {...props}>
        {children}
      </select>
    </label>
  );
}
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="dialog-overlay" />
        <DialogPrimitive.Content className="dialog-content">
          <DialogPrimitive.Title className="dialog-title">
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description
            className={description ? "muted" : "sr-only"}
          >
            {description ?? "Complete the action in this dialog."}
          </DialogPrimitive.Description>
          <DialogPrimitive.Close
            className="icon-button close-dialog"
            aria-label="Close dialog"
          >
            <X size={19} />
          </DialogPrimitive.Close>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
export function Tooltip({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <TooltipPrimitive.Provider>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content className="tooltip" sideOffset={6}>
            {label}
            <TooltipPrimitive.Arrow />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="empty-state">
      <Inbox size={30} />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
export function ErrorState({ children }: { children: React.ReactNode }) {
  return (
    <p className="error-state" role="alert">
      <AlertCircle size={18} />
      {children}
    </p>
  );
}
export function Skeleton() {
  return <div className="skeleton" aria-label="Loading content" />;
}
export function Tabs({
  items,
  value,
  onChange,
}: {
  items: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="tabs" aria-label="View options">
      {items.map((item) => (
        <button
          key={item}
          className={item === value ? "active" : ""}
          aria-pressed={item === value}
          onClick={() => onChange(item)}
        >
          {item}
        </button>
      ))}
    </div>
  );
}
export function Pagination({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (page: number) => void;
}) {
  return (
    <nav className="pagination" aria-label="Pagination">
      <button
        className="button outline small"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Previous
      </button>
      <span>
        {page} / {Math.max(1, total)}
      </span>
      <button
        className="button outline small"
        disabled={page >= total}
        onClick={() => onChange(page + 1)}
      >
        Next
      </button>
    </nav>
  );
}
