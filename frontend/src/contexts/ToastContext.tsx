import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from "react";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";
import { cn } from "../components/ui";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  success: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
  warning: (msg: string) => void;
}

const ToastContext = createContext<ToastContextType>({} as ToastContextType);

const TOAST_STYLES: Record<
  ToastType,
  {
    accentBar: string;
    iconBox: string;
    icon: React.ReactNode;
  }
> = {
  success: {
    accentBar: "bg-emerald-500",
    iconBox:
      "bg-[var(--kuara-success-soft)] border-[var(--kuara-success-border)] text-[var(--kuara-success-text)]",
    icon: <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />,
  },
  error: {
    accentBar: "bg-rose-500",
    iconBox:
      "bg-[var(--kuara-danger-soft)] border-[var(--kuara-danger-border)] text-[var(--kuara-danger-text)]",
    icon: <AlertCircle className="w-3.5 h-3.5 shrink-0" />,
  },
  warning: {
    accentBar: "bg-amber-500",
    iconBox:
      "bg-[var(--kuara-warning-soft)] border-[var(--kuara-warning-border)] text-[var(--kuara-warning-text)]",
    icon: <AlertTriangle className="w-3.5 h-3.5 shrink-0" />,
  },
  info: {
    accentBar: "bg-blue-500",
    iconBox:
      "bg-[var(--kuara-info-soft)] border-[var(--kuara-info-border)] text-[var(--kuara-info-text)]",
    icon: <Info className="w-3.5 h-3.5 shrink-0" />,
  },
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (type: ToastType, message: string) => {
      counterRef.current += 1;
      const id = `toast-${Date.now()}-${counterRef.current}`;
      setToasts((prev) => [...prev.slice(-4), { id, type, message }]);
      const timer = setTimeout(() => {
        timersRef.current.delete(id);
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
      timersRef.current.set(id, timer);
    },
    []
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const toastApi = useMemo<ToastContextType>(
    () => ({
      success: (msg) => addToast("success", msg),
      error: (msg) => addToast("error", msg),
      info: (msg) => addToast("info", msg),
      warning: (msg) => addToast("warning", msg),
    }),
    [addToast]
  );

  return (
    <ToastContext.Provider value={toastApi}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 max-w-sm w-[calc(100vw-2rem)] sm:w-full pointer-events-none"
      >
        {toasts.map((t) => {
          const style = TOAST_STYLES[t.type];
          return (
            <div
              key={t.id}
              role={t.type === "error" ? "alert" : "status"}
              className={cn(
                "pointer-events-auto relative overflow-hidden flex items-start gap-2.5 p-3 rounded-lg border border-[var(--kuara-border)]",
                "bg-[var(--kuara-surface-elevated)] text-[var(--kuara-fg)] shadow-modal text-xs transition-all"
              )}
            >
              <span aria-hidden="true" className={cn("absolute left-0 top-0 bottom-0 w-[3px]", style.accentBar)} />

              <span
                className={cn(
                  "ml-1 w-6 h-6 rounded-md border flex items-center justify-center shrink-0",
                  style.iconBox
                )}
              >
                {style.icon}
              </span>

              <span className="flex-1 min-w-0 leading-relaxed font-medium pt-0.5 break-words">
                {t.message}
              </span>

              <button
                type="button"
                onClick={() => removeToast(t.id)}
                aria-label="Fechar notificação"
                className="h-6 w-6 rounded inline-flex items-center justify-center text-[var(--kuara-fg-subtle)] hover:text-[var(--kuara-fg)] hover:bg-[var(--kuara-surface-hover)] transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--kuara-ring)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
