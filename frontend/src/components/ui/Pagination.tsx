import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./Button";
import { cn } from "./cn";

export interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (nextPage: number) => void;
  itemLabel?: string;
  loading?: boolean;
  hideWhenSinglePage?: boolean;
  className?: string;
}

type PageToken = number | "ellipsis-left" | "ellipsis-right";

function buildPageList(current: number, totalPages: number): PageToken[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, idx) => idx + 1);
  }

  if (current <= 3) {
    return [1, 2, 3, 4, "ellipsis-right", totalPages];
  }

  if (current >= totalPages - 2) {
    return [1, "ellipsis-left", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [
    1,
    "ellipsis-left",
    current - 1,
    current,
    current + 1,
    "ellipsis-right",
    totalPages,
  ];
}

export function Pagination({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
  itemLabel = "itens",
  loading = false,
  hideWhenSinglePage = true,
  className,
}: PaginationProps) {
  const safeTotalPages = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(1, page), safeTotalPages);

  if (total <= 0) return null;
  if (hideWhenSinglePage && safeTotalPages <= 1) return null;

  const startItem = (safePage - 1) * limit + 1;
  const endItem = Math.min(total, safePage * limit);
  const tokens = buildPageList(safePage, safeTotalPages);

  return (
    <nav
      aria-label="Paginação"
      className={cn(
        "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 px-3 py-2.5 rounded-lg",
        "bg-[var(--kuara-surface)] border border-[var(--kuara-border)] text-xs",
        className
      )}
    >
      <div className="text-[11px] text-[var(--kuara-fg-muted)] font-mono tabular-nums">
        Mostrando{" "}
        <span className="font-semibold text-[var(--kuara-fg)]">
          {startItem}–{endItem}
        </span>{" "}
        de <span className="font-semibold text-[var(--kuara-fg)]">{total}</span> {itemLabel}
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        <Button
          type="button"
          variant="outline"
          size="xs"
          disabled={loading || safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          aria-label="Página anterior"
          leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
        >
          Anterior
        </Button>

        <div className="flex items-center gap-1">
          {tokens.map((token) =>
            typeof token === "number" ? (
              <Button
                key={token}
                type="button"
                variant={token === safePage ? "primary" : "ghost"}
                size="xs"
                disabled={loading}
                onClick={() => token !== safePage && onPageChange(token)}
                aria-label={`Página ${token}`}
                aria-current={token === safePage ? "page" : undefined}
                className={cn(
                  "min-w-[26px] font-mono tabular-nums",
                  token !== safePage && "text-[var(--kuara-fg-muted)]"
                )}
              >
                {token}
              </Button>
            ) : (
              <span
                key={token}
                aria-hidden="true"
                className="px-1 text-[11px] text-[var(--kuara-fg-subtle)] select-none font-mono"
              >
                ...
              </span>
            )
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          size="xs"
          disabled={loading || safePage >= safeTotalPages}
          onClick={() => onPageChange(safePage + 1)}
          aria-label="Próxima página"
          rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
        >
          Próxima
        </Button>
      </div>
    </nav>
  );
}
