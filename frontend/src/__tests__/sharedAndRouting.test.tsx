import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "../api/client";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { ThemeProvider } from "../contexts/ThemeContext";
import { ToastProvider } from "../contexts/ToastContext";
import { PixModal } from "../components/PixModal";
import { Stepper } from "../components/Stepper";
import { ThemeToggle } from "../components/ThemeToggle";
import { App } from "../App";
import { mockAdminUser, mockClientUser } from "./testUtils";

const AuthProbe: React.FC = () => {
  const { user, loading } = useAuth();
  return (
    <div>
      <span data-testid="auth-loading">{String(loading)}</span>
      <span data-testid="auth-user">{user ? `${user.role}:${user.email}` : "null"}</span>
    </div>
  );
};

describe("Shared Components, AuthContext & ProtectedRoute", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.history.pushState({}, "", "/");
  });

  describe("PixModal", () => {
    it("generates a stable Pix copy-paste string across re-renders and copy clicks, and supports PIX vs CARD", async () => {
      const user = userEvent.setup();
      const writeTextSpy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
      const onConfirmPayment = vi.fn().mockResolvedValue(undefined);

      const { rerender } = render(
        <ThemeProvider>
          <ToastProvider>
            <PixModal
              isOpen={true}
              onClose={vi.fn()}
              onConfirmPayment={onConfirmPayment}
              amountCents={45000}
              loading={false}
            />
          </ToastProvider>
        </ThemeProvider>
      );

      expect(screen.getByText(/R\$\s*450,00/)).toBeInTheDocument();
      expect(screen.getByText(/Inclui taxa Kuara \(5%\)/)).toBeInTheDocument();
      expect(screen.getByText(/R\$\s*22,50/)).toBeInTheDocument();
      expect(screen.getByText(/R\$\s*427,50/)).toBeInTheDocument();

      const pixCodeEl = screen.getByText((content) =>
        content.startsWith("00020126580014br.gov.bcb.pix0136kuara-escrow-")
      );
      const initialPixCode = pixCodeEl.textContent;
      expect(initialPixCode).toBeTruthy();

      // Re-render with same isOpen & amountCents -> string must NOT randomly mutate
      rerender(
        <ThemeProvider>
          <ToastProvider>
            <PixModal
              isOpen={true}
              onClose={vi.fn()}
              onConfirmPayment={onConfirmPayment}
              amountCents={45000}
              loading={false}
            />
          </ToastProvider>
        </ThemeProvider>
      );

      expect(
        screen.getByText((content) =>
          content.startsWith("00020126580014br.gov.bcb.pix0136kuara-escrow-")
        ).textContent
      ).toBe(initialPixCode);

      // Click Copiar -> string stays identical and clipboard receives the same string
      await user.click(screen.getByRole("button", { name: "Copiar" }));
      expect(writeTextSpy).toHaveBeenCalledWith(initialPixCode);
      expect(screen.getByRole("button", { name: "Copiado" })).toBeInTheDocument();
      expect(
        screen.getByText((content) =>
          content.startsWith("00020126580014br.gov.bcb.pix0136kuara-escrow-")
        ).textContent
      ).toBe(initialPixCode);

      // Confirm PIX payment
      await user.click(screen.getByRole("button", { name: "Confirmar Pagamento Pix" }));
      expect(onConfirmPayment).toHaveBeenCalledWith("PIX");

      // Switch to CARD method
      await user.click(screen.getByRole("button", { name: /Cartão de Crédito/ }));
      expect(screen.getByLabelText("Nome impresso no cartão")).toBeInTheDocument();
      expect(screen.getByLabelText("Número do cartão (ambiente simulado)")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Autorizar Cartão em Custódia" }));
      expect(onConfirmPayment).toHaveBeenCalledWith("CARD");
    });

    it("splits labor custody from immediate materials release when materialAmountCents > 0 and computes 5% fee on labor only", () => {
      render(
        <ThemeProvider>
          <ToastProvider>
            <PixModal
              isOpen={true}
              onClose={vi.fn()}
              onConfirmPayment={vi.fn()}
              amountCents={50000}
              laborAmountCents={30000}
              materialAmountCents={20000}
              loading={false}
            />
          </ToastProvider>
        </ThemeProvider>
      );

      expect(screen.getByText(/R\$\s*500,00/)).toBeInTheDocument();
      expect(screen.getByText(/Mão de obra \(retida em custódia\):/)).toBeInTheDocument();
      expect(screen.getByText(/R\$\s*300,00/)).toBeInTheDocument();
      expect(screen.getByText(/Materiais \(liberação imediata p\/ compra\):/)).toBeInTheDocument();
      expect(screen.getByText(/R\$\s*200,00/)).toBeInTheDocument();
      expect(screen.getByText(/Taxa Kuara \(5% s\/ mão de obra\):/)).toBeInTheDocument();
      expect(screen.getByText(/R\$\s*15,00/)).toBeInTheDocument();
      expect(screen.getByText(/R\$\s*285,00/)).toBeInTheDocument();
    });
  });

  describe("Stepper", () => {
    it("does NOT claim a refund when status=CANCELLED and hasEscrow=false", () => {
      render(<Stepper status="CANCELLED" hasEscrow={false} />);

      expect(
        screen.getByText("Serviço cancelado antes da realização do depósito em custódia.")
      ).toBeInTheDocument();
      expect(document.body.textContent).not.toMatch(/estornad/i);
    });

    it("accurately describes refund when status=CANCELLED and hasEscrow=true or escrowStatus=REFUNDED", () => {
      render(<Stepper status="CANCELLED" hasEscrow={true} escrowStatus="REFUNDED" />);

      expect(
        screen.getByText(
          "Serviço cancelado. O valor depositado em custódia foi estornado integralmente ao contratante."
        )
      ).toBeInTheDocument();
    });
  });

  describe("ThemeToggle", () => {
    it("has no infinite spin animation class in light or dark mode", async () => {
      const user = userEvent.setup();
      render(
        <ThemeProvider>
          <ThemeToggle showLabel />
        </ThemeProvider>
      );

      const toggleBtn = screen.getByRole("button", { name: "Alternar tema" });
      expect(toggleBtn.innerHTML).not.toMatch(/animate-spin|animate-\[spin/);

      // Switch to dark mode (renders <Sun />) and verify no spin class on button or icon
      await user.click(toggleBtn);
      expect(document.documentElement.classList.contains("dark")).toBe(true);
      expect(toggleBtn.innerHTML).not.toMatch(/animate-spin|animate-\[spin/);
    });
  });

  describe("AuthContext", () => {
    it("recovers cleanly from malformed JSON in localStorage without crashing", async () => {
      localStorage.setItem("@kuara:token", "broken-token");
      localStorage.setItem("@kuara:user", "{malformed-json:::");

      render(
        <AuthProvider>
          <AuthProbe />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("auth-loading")).toHaveTextContent("false");
      });

      expect(screen.getByTestId("auth-user")).toHaveTextContent("null");
      expect(localStorage.getItem("@kuara:token")).toBeNull();
      expect(localStorage.getItem("@kuara:user")).toBeNull();
    });

    it("clears incomplete session JSON missing id or role cleanly", async () => {
      localStorage.setItem("@kuara:token", "partial-token");
      localStorage.setItem("@kuara:user", JSON.stringify({ name: "Sem Role" }));

      render(
        <AuthProvider>
          <AuthProbe />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("auth-loading")).toHaveTextContent("false");
      });

      expect(screen.getByTestId("auth-user")).toHaveTextContent("null");
      expect(localStorage.getItem("@kuara:token")).toBeNull();
      expect(localStorage.getItem("@kuara:user")).toBeNull();
    });
  });

  describe("ProtectedRoute in App.tsx", () => {
    beforeEach(() => {
      vi.spyOn(api, "get").mockImplementation(async (url: string) => {
        if (url === "/auth/me") {
          const raw = localStorage.getItem("@kuara:user");
          return { data: raw ? JSON.parse(raw) : mockAdminUser };
        }
        if (url === "/admin/metrics") {
          return {
            data: {
              financial: {
                totalGMVCents: 0,
                totalRevenueKuaraCents: 0,
                activeEscrowCents: 0,
                disputedEscrowCents: 0,
                refundedTotalCents: 0,
              },
              counts: { totalOrders: 0, totalUsers: 1, verifiedProviders: 0, ordersByStatus: {} },
            },
          };
        }
        return { data: [] };
      });
    });

    it("blocks ADMIN from /dashboard/client and redirects to /dashboard/admin", async () => {
      localStorage.setItem("@kuara:token", "admin-token");
      localStorage.setItem("@kuara:user", JSON.stringify(mockAdminUser));
      window.history.pushState({}, "", "/dashboard/client");

      render(<App />);

      await waitFor(() => {
        expect(window.location.pathname).toBe("/dashboard/admin");
        expect(screen.getByText("Operações & Mediação Admin")).toBeInTheDocument();
      });

      expect(screen.queryByText("Painel do Contratante")).not.toBeInTheDocument();
    });

    it("blocks ADMIN from /dashboard/provider and redirects to /dashboard/admin", async () => {
      localStorage.setItem("@kuara:token", "admin-token");
      localStorage.setItem("@kuara:user", JSON.stringify(mockAdminUser));
      window.history.pushState({}, "", "/dashboard/provider");

      render(<App />);

      await waitFor(() => {
        expect(window.location.pathname).toBe("/dashboard/admin");
        expect(screen.getByText("Operações & Mediação Admin")).toBeInTheDocument();
      });

      expect(screen.queryByText("Painel do Profissional")).not.toBeInTheDocument();
    });

    it("blocks CLIENT from /dashboard/admin and redirects to /dashboard/client", async () => {
      localStorage.setItem("@kuara:token", "client-token");
      localStorage.setItem("@kuara:user", JSON.stringify(mockClientUser));
      window.history.pushState({}, "", "/dashboard/admin");

      render(<App />);

      await waitFor(() => {
        expect(window.location.pathname).toBe("/dashboard/client");
        expect(screen.getByText("Painel do Contratante")).toBeInTheDocument();
      });

      expect(screen.queryByText("Operações & Mediação Admin")).not.toBeInTheDocument();
    });

    it("redirects unauthenticated visitors on /dashboard/client to /login", async () => {
      window.history.pushState({}, "", "/dashboard/client");

      render(<App />);

      await waitFor(() => {
        expect(window.location.pathname).toBe("/login");
        expect(screen.getByText("Acessar a Kuara")).toBeInTheDocument();
      });
    });
  });
});
