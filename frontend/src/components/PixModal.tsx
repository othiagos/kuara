import React, { useEffect, useMemo, useState } from "react";
import { QrCode, Copy, Check, ShieldCheck, CreditCard, Lock } from "lucide-react";
import { Modal } from "./ui/Modal";
import { Alert } from "./ui/Alert";
import { Button } from "./ui/Button";
import { ButtonGroup } from "./ui/ButtonGroup";
import { Input } from "./ui/Input";

export type EscrowPaymentMethod = "PIX" | "CARD";

export interface PixModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmPayment: (paymentMethod: EscrowPaymentMethod) => Promise<void>;
  amountCents: number;
  laborAmountCents?: number;
  materialAmountCents?: number;
  loading: boolean;
  defaultMethod?: EscrowPaymentMethod;
}

const formatBRL = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export const PixModal: React.FC<PixModalProps> = ({
  isOpen,
  onClose,
  onConfirmPayment,
  amountCents,
  laborAmountCents,
  materialAmountCents = 0,
  loading,
  defaultMethod = "PIX",
}) => {
  const [paymentMethod, setPaymentMethod] = useState<EscrowPaymentMethod>(defaultMethod);
  const [copied, setCopied] = useState(false);
  const [cardHolder, setCardHolder] = useState("");
  const [cardLastDigits, setCardLastDigits] = useState("•••• •••• •••• 4242");
  const [cardExpiry, setCardExpiry] = useState("12/29");

  const effectiveMaterialsCents = Math.max(0, Math.round(materialAmountCents));
  const effectiveLaborCents =
    laborAmountCents !== undefined
      ? Math.max(0, Math.round(laborAmountCents))
      : Math.max(0, amountCents - effectiveMaterialsCents);
  const feeCents = Math.round(effectiveLaborCents * 0.05);
  const netLaborCents = Math.max(0, effectiveLaborCents - feeCents);
  const hasMaterialsAdvance = effectiveMaterialsCents > 0;

  useEffect(() => {
    if (isOpen) {
      setPaymentMethod(defaultMethod);
      setCopied(false);
    }
  }, [isOpen, defaultMethod]);

  const pixKeySimulated = useMemo(() => {
    const token = Math.random().toString(36).substring(2, 10);
    return `00020126580014br.gov.bcb.pix0136kuara-escrow-${token}520400005303986540${(
      amountCents / 100
    ).toFixed(2)}5802BR5915KUARA PLATAFORMA6009SAO PAULO62070503***6304`;
  }, [isOpen, amountCents]);

  const handleCopy = () => {
    navigator.clipboard?.writeText(pixKeySimulated);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Depósito em Custódia Segura"
      subtitle="Escolha Pix ou Cartão de Crédito para liberar o início do serviço"
      icon={
        paymentMethod === "PIX" ? (
          <QrCode className="w-4 h-4" />
        ) : (
          <CreditCard className="w-4 h-4" />
        )
      }
      size="md"
      footer={
        <>
          <Button variant="ghost" size="md" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            variant="success"
            size="md"
            loading={loading}
            onClick={() => onConfirmPayment(paymentMethod)}
          >
            {loading
              ? "Processando..."
              : paymentMethod === "PIX"
              ? "Confirmar Pagamento Pix"
              : "Autorizar Cartão em Custódia"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <ButtonGroup<EscrowPaymentMethod>
          variant="segmented"
          size="md"
          fullWidth
          value={paymentMethod}
          onChange={setPaymentMethod}
          options={[
            {
              value: "PIX",
              label: "Pix (Instantâneo)",
              icon: <QrCode className="w-3.5 h-3.5" />,
            },
            {
              value: "CARD",
              label: "Cartão de Crédito",
              icon: <CreditCard className="w-3.5 h-3.5" />,
            },
          ]}
        />

        <Alert
          variant="warning"
          compact
          icon={<ShieldCheck className="w-4 h-4 shrink-0" />}
          description={
            hasMaterialsAdvance
              ? "A mão de obra fica retida em custódia até sua aprovação. O valor de materiais é liberado imediatamente no pagamento para compra dos insumos."
              : "O valor fica retido na custódia da Kuara e só é repassado ao prestador após sua aprovação do serviço entregue."
          }
        />

        <div className="rounded-md border border-[var(--kuara-border)] bg-[var(--kuara-surface-muted)] py-3 px-4 text-center space-y-1.5">
          <span className="text-[11px] font-medium text-[var(--kuara-fg-muted)] block">
            {hasMaterialsAdvance ? "Total do pagamento" : "Total protegido em custódia"}
          </span>
          <p className="text-2xl font-bold text-[var(--kuara-fg)] tracking-tight tabular-nums">
            {formatBRL(amountCents)}
          </p>

          {hasMaterialsAdvance ? (
            <div className="pt-2 border-t border-[var(--kuara-border)] space-y-1 text-[11px] text-left tabular-nums">
              <div className="flex justify-between text-[var(--kuara-fg-muted)]">
                <span>Mão de obra (retida em custódia):</span>
                <strong className="text-[var(--kuara-fg)]">{formatBRL(effectiveLaborCents)}</strong>
              </div>
              <div className="flex justify-between text-[var(--kuara-success-text)]">
                <span>Materiais (liberação imediata p/ compra):</span>
                <strong>{formatBRL(effectiveMaterialsCents)}</strong>
              </div>
              <div className="flex justify-between text-[var(--kuara-fg-subtle)]">
                <span>Taxa Kuara (5% s/ mão de obra):</span>
                <span>
                  {formatBRL(feeCents)} • Líq. entrega: {formatBRL(netLaborCents)}
                </span>
              </div>
            </div>
          ) : (
            <span className="text-[11px] text-[var(--kuara-fg-subtle)] block tabular-nums">
              Inclui taxa Kuara (5%): {formatBRL(feeCents)} • Repasse ao profissional:{" "}
              {formatBRL(netLaborCents)}
            </span>
          )}
        </div>

        {paymentMethod === "PIX" ? (
          <>
            <div className="flex justify-center p-4 bg-white rounded-md border border-[var(--kuara-border)]">
              <svg
                className="w-32 h-32"
                viewBox="0 0 100 100"
                aria-label="QR Code Pix para pagamento em custódia"
              >
                <rect width="100" height="100" fill="white" />
                <path
                  d="M10 10h30v30h-30zM15 15h20v20h-20zM20 20h10v10h-10zM60 10h30v30h-30zM65 15h20v20h-20zM70 20h10v10h-10zM10 60h30v30h-30zM15 65h20v20h-20zM20 70h10v10h-10zM50 15h5v5h-5zM45 25h10v5h-10zM55 35h5v15h-5zM60 50h10v5h-10zM75 55h15v5h-15zM50 70h10v10h-10zM70 70h20v5h-20zM65 80h10v10h-10zM80 85h10v5h-10z"
                  fill="#09090b"
                />
              </svg>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[var(--kuara-fg)]">
                Código Pix Copia e Cola
              </label>
              <div className="flex items-center gap-2 h-9 px-2.5 rounded-md border border-[var(--kuara-border)] bg-[var(--kuara-surface-muted)] text-xs font-mono text-[var(--kuara-fg-muted)]">
                <span className="truncate flex-1 select-all">{pixKeySimulated}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={handleCopy}
                  leftIcon={
                    copied ? (
                      <Check className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )
                  }
                >
                  {copied ? "Copiado" : "Copiar"}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-3 rounded-md border border-[var(--kuara-border)] bg-[var(--kuara-surface)] p-3.5">
            <Input
              label="Nome impresso no cartão"
              placeholder="Como consta no cartão"
              value={cardHolder}
              onChange={(e) => setCardHolder(e.target.value)}
            />
            <div className="grid grid-cols-3 gap-2.5">
              <Input
                containerClassName="col-span-2"
                label="Número do cartão (ambiente simulado)"
                value={cardLastDigits}
                onChange={(e) => setCardLastDigits(e.target.value)}
                className="font-mono"
              />
              <Input
                label="Validade"
                value={cardExpiry}
                onChange={(e) => setCardExpiry(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--kuara-fg-muted)] pt-1">
              <Lock className="w-3 h-3 text-[var(--kuara-fg-subtle)] shrink-0" />
              <span>Pré-autorização em 1x à vista vinculada à custódia Kuara (ambiente MVP simulado).</span>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
