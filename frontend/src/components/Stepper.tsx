import React from "react";
import { Check } from "lucide-react";
import { Alert } from "./ui/Alert";
import { cn } from "./ui/cn";

export interface StepperProps {
  status: string;
  /** Whether an escrow payment existed/was funded (used to describe cancellation accurately). */
  hasEscrow?: boolean;
  escrowStatus?: string;
  className?: string;
}

const STEPS = [
  { key: "OPEN", label: "Aberto" },
  { key: "PROPOSALS_RECEIVED", label: "Orçamentos" },
  { key: "ESCROW_PENDING", label: "Custódia" },
  { key: "IN_PROGRESS", label: "Execução" },
  { key: "COMPLETED_PENDING_APPROVAL", label: "Inspeção (72h)" },
  { key: "FINISHED", label: "Concluído" },
];

const STATUS_ORDER: Record<string, number> = {
  OPEN: 0,
  PROPOSALS_RECEIVED: 1,
  ESCROW_PENDING: 2,
  IN_PROGRESS: 3,
  COMPLETED_PENDING_APPROVAL: 4,
  FINISHED: 5,
  IN_DISPUTE: 4,
  CANCELLED: -1,
};

export const Stepper: React.FC<StepperProps> = ({
  status,
  hasEscrow,
  escrowStatus,
  className,
}) => {
  const currentIndex = STATUS_ORDER[status] ?? 0;
  const isDispute = status === "IN_DISPUTE";
  const isCancelled = status === "CANCELLED";

  const wasRefunded = escrowStatus === "REFUNDED" || hasEscrow === true;
  const cancelMessage = wasRefunded
    ? "Serviço cancelado. O valor depositado em custódia foi estornado integralmente ao contratante."
    : hasEscrow === false
    ? "Serviço cancelado antes da realização do depósito em custódia."
    : "Serviço cancelado e encerrado na plataforma.";

  return (
    <div className={cn("w-full space-y-3 py-1", className)}>
      {isDispute && (
        <Alert
          variant="danger"
          compact
          description="Serviço sob Mediação Arbitral pelo Administrador Kuara. O valor permanece retido em custódia."
        />
      )}

      {isCancelled && <Alert variant="neutral" compact description={cancelMessage} />}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {STEPS.map((step, idx) => {
          const isDone =
            !isCancelled &&
            (currentIndex > idx || (idx === 5 && status === "FINISHED"));
          const isCurrent = !isCancelled && !isDone && currentIndex === idx;

          return (
            <div key={step.key} className="space-y-1.5">
              <div
                className={cn(
                  "h-1 w-full rounded-full transition-colors",
                  isDone
                    ? "bg-emerald-500"
                    : isCurrent
                    ? isDispute
                      ? "bg-rose-500"
                      : "bg-amber-500"
                    : "bg-[var(--kuara-border)]"
                )}
              />

              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className={cn(
                    "w-4 h-4 rounded-full border inline-flex items-center justify-center text-[10px] font-semibold tabular-nums shrink-0",
                    isDone
                      ? "bg-[var(--kuara-success-soft)] border-[var(--kuara-success-border)] text-[var(--kuara-success-text)]"
                      : isCurrent
                      ? isDispute
                        ? "bg-[var(--kuara-danger-soft)] border-[var(--kuara-danger-border)] text-[var(--kuara-danger-text)]"
                        : "bg-[var(--kuara-warning-soft)] border-[var(--kuara-warning-border)] text-[var(--kuara-warning-text)]"
                      : "bg-[var(--kuara-surface-muted)] border-[var(--kuara-border)] text-[var(--kuara-fg-subtle)]"
                  )}
                >
                  {isDone ? <Check className="w-2.5 h-2.5" /> : idx + 1}
                </span>

                <span
                  className={cn(
                    "text-[11px] truncate",
                    isDone
                      ? "text-[var(--kuara-success-text)] font-medium"
                      : isCurrent
                      ? isDispute
                        ? "text-[var(--kuara-danger-text)] font-semibold"
                        : "text-[var(--kuara-warning-text)] font-semibold"
                      : "text-[var(--kuara-fg-subtle)]"
                  )}
                >
                  {step.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
