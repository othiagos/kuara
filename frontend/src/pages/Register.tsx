import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
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
  ButtonGroup,
  Input,
  Select,
  Textarea,
  Button,
  Alert,
  Divider,
} from "../components/ui";
import { Sun, UserCheck, Briefcase, Eye, EyeOff } from "lucide-react";

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

const CATEGORY_OPTIONS = [
  { value: "Elétrica", label: "Elétrica" },
  { value: "Hidráulica", label: "Hidráulica" },
  { value: "Pintura", label: "Pintura" },
  { value: "Alvenaria", label: "Alvenaria" },
  { value: "Climatização", label: "Climatização" },
  { value: "Marcenaria", label: "Marcenaria" },
  { value: "Outros", label: "Outros" },
];

export const Register: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialRole = searchParams.get("role") === "PROVIDER" ? "PROVIDER" : "CLIENT";

  const [role, setRole] = useState<"CLIENT" | "PROVIDER">(initialRole);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState("");

  // Provider fields
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [category, setCategory] = useState("Elétrica");
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("São Paulo");

  const [apiError, setApiError] = useState<ParsedApiError | null>(null);
  const [loading, setLoading] = useState(false);
  const { user, login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const paramRole = searchParams.get("role");
    if (paramRole === "PROVIDER" || paramRole === "CLIENT") {
      setRole(paramRole);
    }
  }, [searchParams]);

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

    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length < 8) {
      setApiError({
        message: "Informe um telefone válido com DDD (mínimo 8 dígitos).",
        details: [],
      });
      return;
    }

    if (role === "PROVIDER") {
      const docDigits = cpfCnpj.replace(/\D/g, "");
      if (docDigits.length !== 11 && docDigits.length !== 14) {
        setApiError({
          message: "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.",
          details: [],
        });
        return;
      }
    }

    setLoading(true);

    try {
      const cleanEmail = email.trim();
      const payload: Record<string, any> = {
        name: name.trim(),
        email: cleanEmail,
        password,
        phone: phone.trim(),
        role,
      };

      if (role === "PROVIDER") {
        payload.cpfCnpj = cpfCnpj.trim();
        payload.pixKey = pixKey.trim();
        payload.categories = [category];
        payload.serviceAreas = [city.trim() || "São Paulo"];
        payload.bio = bio.trim();
      }

      const regRes = await api.post("/auth/register", payload);
      if (regRes.data?.token && regRes.data?.user) {
        login(regRes.data.token, regRes.data.user);
      } else {
        const loginRes = await api.post("/auth/login", { email: cleanEmail, password });
        login(loginRes.data.token, loginRes.data.user);
      }

      toast.success("Conta criada com sucesso na Kuara!");

      if (role === "CLIENT") {
        navigate("/dashboard/client");
      } else {
        navigate("/dashboard/provider");
      }
    } catch (err: any) {
      const parsed = parseApiError(err, "Erro ao realizar cadastro.");
      setApiError(parsed);
      toast.error(parsed.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center px-4 py-10">
      <Card variant="elevated" className="w-full max-w-lg">
        <CardHeader className="text-center py-5">
          <div className="w-9 h-9 mx-auto mb-3 rounded-md bg-[var(--kuara-primary)] text-[var(--kuara-primary-fg)] flex items-center justify-center shadow-panel">
            <Sun className="w-5 h-5" />
          </div>
          <CardTitle className="text-base font-semibold">Criar Conta na Kuara</CardTitle>
          <CardDescription>
            Contrate reparos para sua casa ou atenda clientes reais sem pagar por contatos frios
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <ButtonGroup
            variant="segmented"
            size="md"
            fullWidth
            value={role}
            onChange={(val) => {
              setRole(val);
              setApiError(null);
            }}
            options={[
              {
                value: "CLIENT",
                label: "Contratante",
                icon: <UserCheck className="w-3.5 h-3.5 text-[var(--kuara-primary)]" />,
              },
              {
                value: "PROVIDER",
                label: "Prestador",
                icon: <Briefcase className="w-3.5 h-3.5 text-[var(--kuara-primary)]" />,
              },
            ]}
          />

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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Nome Completo"
                type="text"
                required
                minLength={2}
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome completo"
              />

              <Input
                label="Telefone / WhatsApp"
                type="tel"
                required
                minLength={8}
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(11) 99999-9999"
                hint="Mínimo 8 dígitos com DDD"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="E-mail"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
              />

              <Input
                label="Senha"
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                hint="Mínimo de 6 caracteres"
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
            </div>

            {role === "PROVIDER" && (
              <div className="space-y-3 pt-1">
                <Divider label="Dados Profissionais" />

                <div className="p-3.5 rounded-md border border-[var(--kuara-border)] bg-[var(--kuara-surface-muted)]/60 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label="CPF ou CNPJ"
                      type="text"
                      required
                      minLength={11}
                      maxLength={18}
                      value={cpfCnpj}
                      onChange={(e) => setCpfCnpj(e.target.value)}
                      placeholder="000.000.000-00"
                      hint="11 dígitos (CPF) ou 14 (CNPJ)"
                    />

                    <Input
                      label="Chave Pix"
                      type="text"
                      required
                      minLength={5}
                      value={pixKey}
                      onChange={(e) => setPixKey(e.target.value)}
                      placeholder="E-mail, CPF ou chave aleatória"
                      hint="Usada para repasses após aprovação"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Select
                      label="Especialidade Principal"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      options={CATEGORY_OPTIONS}
                    />

                    <Input
                      label="Cidade Principal"
                      type="text"
                      required
                      minLength={2}
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Ex: São Paulo"
                    />
                  </div>

                  <Textarea
                    label="Apresentação / Bio"
                    rows={2}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Resuma seus anos de experiência, especialidades e regiões atendidas..."
                  />

                  <Alert
                    variant="info"
                    compact
                    description="Após criar sua conta, envie os documentos no painel para liberar o envio de orçamentos."
                  />
                </div>
              </div>
            )}

            <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
              {loading ? "Cadastrando..." : "Concluir Cadastro"}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="justify-center text-xs text-[var(--kuara-fg-muted)]">
          <span>
            Já possui conta?{" "}
            <Link to="/login" className="font-medium text-[var(--kuara-primary)] hover:underline">
              Fazer login
            </Link>
          </span>
        </CardFooter>
      </Card>
    </div>
  );
};
