import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Input,
  Button,
  Alert,
} from "../components/ui";
import { Sun, LogIn, Mail, Lock, Eye, EyeOff } from "lucide-react";

interface ParsedApiError {
  message: string;
  details: string[];
}

function parseApiError(err: any, fallback: string): ParsedApiError {
  const data = err?.response?.data;
  const message = data?.error || fallback;
  const details = Array.isArray(data?.details)
    ? data.details
        .map((d: any) =>
          typeof d === "string"
            ? d
            : d?.path
            ? `${d.path}: ${d.message}`
            : String(d?.message || "")
        )
        .filter(Boolean)
    : [];
  return { message, details };
}

export const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [apiError, setApiError] = useState<ParsedApiError | null>(null);
  const [loading, setLoading] = useState(false);
  const { user, login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      if (user.role === "CLIENT") navigate("/dashboard/client", { replace: true });
      else if (user.role === "PROVIDER") navigate("/dashboard/provider", { replace: true });
      else navigate("/dashboard/admin", { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);
    setLoading(true);

    try {
      const res = await api.post("/auth/login", {
        email: email.trim(),
        password,
      });
      login(res.data.token, res.data.user);
      toast.success(`Bem-vindo de volta, ${res.data.user.name}!`);

      if (res.data.user.role === "CLIENT") {
        navigate("/dashboard/client");
      } else if (res.data.user.role === "PROVIDER") {
        navigate("/dashboard/provider");
      } else {
        navigate("/dashboard/admin");
      }
    } catch (err: any) {
      const parsed = parseApiError(err, "Falha ao entrar. Verifique suas credenciais.");
      setApiError(parsed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center px-4 py-12">
      <Card variant="elevated" className="w-full max-w-sm">
        <CardHeader className="text-center py-5">
          <div className="w-9 h-9 mx-auto mb-3 rounded-md bg-[var(--kuara-primary)] text-[var(--kuara-primary-fg)] flex items-center justify-center shadow-panel">
            <Sun className="w-5 h-5" />
          </div>
          <CardTitle className="text-base font-semibold">Acessar a Kuara</CardTitle>
          <CardDescription>
            Entre para acompanhar seus pedidos, propostas e entregas com segurança
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {apiError && (
            <Alert
              variant="danger"
              compact
              title={apiError.message}
              description={
                apiError.details.length > 0 ? (
                  <ul className="list-disc pl-4 mt-1 space-y-0.5 text-[11px]">
                    {apiError.details.map((detail, idx) => (
                      <li key={idx}>{detail}</li>
                    ))}
                  </ul>
                ) : undefined
              }
            />
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <Input
              label="E-mail"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              leftIcon={<Mail className="w-3.5 h-3.5" />}
            />

            <Input
              label="Senha"
              type={showPassword ? "text" : "password"}
              required
              minLength={1}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              leftIcon={<Lock className="w-3.5 h-3.5" />}
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  className="p-1 rounded text-[var(--kuara-fg-subtle)] hover:text-[var(--kuara-fg)] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              }
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={loading}
              leftIcon={<LogIn className="w-3.5 h-3.5" />}
            >
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="justify-center text-xs text-[var(--kuara-fg-muted)]">
          <span>
            Ainda não tem conta?{" "}
            <Link to="/register" className="font-medium text-[var(--kuara-primary)] hover:underline">
              Cadastre-se
            </Link>
          </span>
        </CardFooter>
      </Card>
    </div>
  );
};
