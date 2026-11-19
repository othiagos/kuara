import React from "react";
import { cn } from "./ui/cn";

export type BadgeTone = "neutral" | "emerald" | "amber" | "rose" | "blue" | "violet";

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral:
    "bg-[var(--kuara-surface-muted)] border-[var(--kuara-border)] text-[var(--kuara-fg-muted)]",
  emerald:
    "bg-[var(--kuara-success-soft)] border-[var(--kuara-success-border)] text-[var(--kuara-success-text)]",
  amber:
    "bg-[var(--kuara-warning-soft)] border-[var(--kuara-warning-border)] text-[var(--kuara-warning-text)]",
  rose:
    "bg-[var(--kuara-danger-soft)] border-[var(--kuara-danger-border)] text-[var(--kuara-danger-text)]",
  blue:
    "bg-[var(--kuara-info-soft)] border-[var(--kuara-info-border)] text-[var(--kuara-info-text)]",
  violet:
    "bg-[var(--kuara-violet-soft)] border-[var(--kuara-violet-border)] text-[var(--kuara-violet-text)]",
};

const DOT_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-[var(--kuara-fg-subtle)]",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  blue: "bg-blue-500",
  violet: "bg-violet-500",
};

const STATUS_MAP: Record<string, { tone: BadgeTone; label: string }> = {
  // Provider verification statuses
  VERIFIED: { tone: "emerald", label: "Verificado" },
  PENDING_VERIFICATION: { tone: "amber", label: "Aguardando Verificação" },
  REJECTED: { tone: "rose", label: "Não Aprovado" },
  SUSPENDED: { tone: "rose", label: "Suspenso" },

  // Service order lifecycle statuses
  OPEN: { tone: "neutral", label: "Aberto" },
  PROPOSALS_RECEIVED: { tone: "blue", label: "Orçamentos Recebidos" },
  ESCROW_PENDING: { tone: "violet", label: "Aguardando Custódia" },
  IN_PROGRESS: { tone: "amber", label: "Em Andamento (Custódia Retida)" },
  COMPLETED_PENDING_APPROVAL: { tone: "amber", label: "Inspeção Ativa (72h)" },
  IN_DISPUTE: { tone: "rose", label: "Em Disputa" },
  FINISHED: { tone: "emerald", label: "Concluído & Pago" },
  CANCELLED: { tone: "neutral", label: "Cancelado / Estornado" },

  // Dispute / Escrow / Proposal / Role auxiliary statuses
  PENDING_REVIEW: { tone: "rose", label: "Mediação Pendente" },
  RESOLVED: { tone: "emerald", label: "Resolvida" },
  PENDING: { tone: "amber", label: "Pendente" },
  HELD: { tone: "amber", label: "Retido em Custódia" },
  RELEASED: { tone: "emerald", label: "Liberado" },
  REFUNDED: { tone: "neutral", label: "Estornado" },
  DISPUTED: { tone: "rose", label: "Contestado" },
  ACCEPTED: { tone: "emerald", label: "Aceita" },
  CLIENT: { tone: "neutral", label: "Contratante" },
  PROVIDER: { tone: "amber", label: "Prestador" },
  ADMIN: { tone: "violet", label: "Administrador" },
};

export interface BadgeDotProps {
  tone?: BadgeTone;
  className?: string;
}

export const BadgeDot: React.FC<BadgeDotProps> = ({ tone = "neutral", className }) => (
  <span
    aria-hidden="true"
    className={cn("w-1.5 h-1.5 rounded-full shrink-0", DOT_CLASSES[tone], className)}
  />
);

export interface BadgeProps {
  status: string;
  label?: string;
  showDot?: boolean;
  size?: "xs" | "sm";
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  status,
  label,
  showDot = true,
  size = "sm",
  className,
}) => {
  const mapped = STATUS_MAP[status] || { tone: "neutral" as BadgeTone, label: status };
  const displayLabel = label ?? mapped.label;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded border font-medium whitespace-nowrap leading-none",
        size === "xs" ? "h-5 px-1.5 text-[10px]" : "h-[22px] px-2 text-[11px]",
        TONE_CLASSES[mapped.tone],
        className
      )}
    >
      {showDot && <BadgeDot tone={mapped.tone} />}
      <span>{displayLabel}</span>
    </span>
  );
};

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  icon?: React.ReactNode;
}

/**
 * Neutral GPUI-Kit Tag chip for categories, roles, and compact metadata labels.
 */
export const Tag: React.FC<TagProps> = ({
  tone = "neutral",
  icon,
  className,
  children,
  ...props
}) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 h-5 px-1.5 rounded border text-[11px] font-medium whitespace-nowrap leading-none",
      TONE_CLASSES[tone],
      className
    )}
    {...props}
  >
    {icon && <span className="inline-flex shrink-0">{icon}</span>}
    <span>{children}</span>
  </span>
);
