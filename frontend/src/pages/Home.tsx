import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Badge, Tag } from "../components/Badge";
import {
  buttonVariants,
  ButtonGroup,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Divider,
} from "../components/ui";
import {
  ShieldCheck,
  Unlock,
  CheckCircle2,
  Clock,
  FileCheck2,
  MessageSquareLock,
  Scale,
  ArrowRight,
  Zap,
  Wrench,
  Paintbrush,
  Hammer,
  Wind,
  Plug,
} from "lucide-react";

type EscrowStageKey = "OPEN" | "QUOTES" | "HELD" | "APPROVED";

interface EscrowStagePreview {
  key: EscrowStageKey;
  tabLabel: string;
  protocol: string;
  status: string;
  title: string;
  location: string;
  summary: string;
  metrics: { label: string; value: string; tone?: "default" | "success" | "warning" }[];
  safeguardTitle: string;
  safeguardText: string;
  contactUnlocked: boolean;
}

const ESCROW_STAGES: Record<EscrowStageKey, EscrowStagePreview> = {
  OPEN: {
    key: "OPEN",
    tabLabel: "1. Pedido",
    protocol: "#KRA-4812",
    status: "OPEN",
    title: "Troca de quadro elétrico residencial",
    location: "Pinheiros · São Paulo, SP",
    summary:
      "Descreva o problema em casa e anexe fotos sem divulgar seu telefone ou endereço completo para desconhecidos.",
    metrics: [
      { label: "Endereço da casa", value: "Oculto" },
      { label: "Orçamentos", value: "Até 4" },
      { label: "Prospecção", value: "Sem moedas" },
    ],
    safeguardTitle: "Privacidade antes de contratar",
    safeguardText:
      "Telefone, e-mail e endereço exato ficam protegidos enquanto profissionais verificados avaliam o reparo.",
    contactUnlocked: false,
  },
  QUOTES: {
    key: "QUOTES",
    tabLabel: "2. Propostas",
    protocol: "#KRA-4812",
    status: "PROPOSALS_RECEIVED",
    title: "Troca de quadro elétrico residencial",
    location: "Pinheiros · São Paulo, SP",
    summary:
      "Compare até 4 propostas completas por escopo técnico, prazo e reputação — sem disputa predatória só por preço.",
    metrics: [
      { label: "Profissionais", value: "Verificados" },
      { label: "Escopo e prazo", value: "Detalhados" },
      { label: "Dúvidas prévias", value: "Chat seguro" },
    ],
    safeguardTitle: "Comparação transparente",
    safeguardText:
      "Converse pelo chat protegido e tire dúvidas técnicas com cada candidato antes de decidir quem vai à sua casa.",
    contactUnlocked: false,
  },
  HELD: {
    key: "HELD",
    tabLabel: "3. Execução",
    protocol: "#KRA-4812",
    status: "IN_PROGRESS",
    title: "Troca de quadro elétrico residencial",
    location: "Rua dos Pinheiros · São Paulo, SP",
    summary:
      "Com o acordo formalizado, contatos e endereço são liberados para a visita e eventuais insumos já ficam disponíveis para compra.",
    metrics: [
      { label: "Acordo digital", value: "Registrado", tone: "warning" },
      { label: "Insumos da obra", value: "Disponíveis", tone: "success" },
      { label: "Contatos e endereço", value: "Liberados", tone: "success" },
    ],
    safeguardTitle: "Combinado formalizado para os dois lados",
    safeguardText:
      "O que foi contratado fica documentado na plataforma, com insumos liberados para compra e entrega protegida.",
    contactUnlocked: true,
  },
  APPROVED: {
    key: "APPROVED",
    tabLabel: "4. Entrega",
    protocol: "#KRA-4812",
    status: "FINISHED",
    title: "Troca de quadro elétrico residencial",
    location: "Rua dos Pinheiros · São Paulo, SP",
    summary:
      "O profissional envia fotos do trabalho pronto, você confere se está tudo certo em até 72h e ambos registram avaliação.",
    metrics: [
      { label: "Entrega", value: "Com fotos", tone: "success" },
      { label: "Conferência em casa", value: "Janela de 72h" },
      { label: "Avaliação mútua", value: "Registrada", tone: "success" },
    ],
    safeguardTitle: "Garantia pós-serviço e mediação",
    safeguardText:
      "Se algo fugir do combinado durante a conferência de 72h, você pode acionar a mediação da Kuara antes de concluir.",
    contactUnlocked: true,
  },
};

const WORKFLOW_STEPS = [
  {
    step: "01",
    title: "Descreva o problema",
    description:
      "Explique o reparo com fotos e bairro sem expor telefone ou endereço exato antes da escolha.",
  },
  {
    step: "02",
    title: "Compare até 4 propostas",
    description:
      "Profissionais verificados enviam escopo detalhado, prazo de execução e definição clara dos materiais.",
  },
  {
    step: "03",
    title: "Formalize o acordo",
    description:
      "Confirme o candidato ideal para liberar contatos, garantir os insumos da obra e acompanhar o serviço.",
  },
  {
    step: "04",
    title: "Confira a entrega em 72h",
    description:
      "Teste o serviço finalizado com fotos na sua casa, registre sua avaliação ou conte com suporte se houver defeito.",
  },
];

const SPECIALTIES = [
  { label: "Elétrica", icon: <Zap className="w-3.5 h-3.5" /> },
  { label: "Hidráulica", icon: <Wrench className="w-3.5 h-3.5" /> },
  { label: "Pintura", icon: <Paintbrush className="w-3.5 h-3.5" /> },
  { label: "Alvenaria", icon: <Hammer className="w-3.5 h-3.5" /> },
  { label: "Climatização", icon: <Wind className="w-3.5 h-3.5" /> },
  { label: "Instalações", icon: <Plug className="w-3.5 h-3.5" /> },
];

export const Home: React.FC = () => {
  const { user } = useAuth();
  const [activeStage, setActiveStage] = useState<EscrowStageKey>("HELD");

  const stage = ESCROW_STAGES[activeStage];

  const getCategoryRequestLink = (category: string) => {
    if (!user) return "/register?role=CLIENT";
    if (user.role === "CLIENT") {
      const params = new URLSearchParams({
        tab: "orders",
        newRequest: "1",
        category,
      });
      return `/dashboard/client?${params.toString()}`;
    }
    if (user.role === "PROVIDER") return "/dashboard/provider?tab=mural";
    return "/dashboard/admin";
  };

  const renderHeroActions = () => {
    if (!user) {
      return (
        <>
          <Link
            to="/register?role=CLIENT"
            className={buttonVariants({ variant: "primary", size: "lg" })}
          >
            <span>Solicitar Orçamento</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            to="/register?role=PROVIDER"
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            Cadastrar como Prestador
          </Link>
        </>
      );
    }

    if (user.role === "CLIENT") {
      return (
        <>
          <Link
            to="/dashboard/client?newRequest=1"
            className={buttonVariants({ variant: "primary", size: "lg" })}
          >
            <span>Nova Solicitação de Serviço</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            to="/dashboard/client"
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            Acompanhar Meus Pedidos
          </Link>
        </>
      );
    }

    if (user.role === "PROVIDER") {
      return (
        <>
          <Link
            to="/dashboard/provider?tab=mural"
            className={buttonVariants({ variant: "primary", size: "lg" })}
          >
            <span>Ver Oportunidades Abertas</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            to="/dashboard/provider?tab=active_jobs"
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            Meus Serviços Ativos
          </Link>
        </>
      );
    }

    return (
      <Link
        to="/dashboard/admin"
        className={buttonVariants({ variant: "primary", size: "lg" })}
      >
        <span>Abrir Painel Operacional</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    );
  };

  return (
    <div className="pb-16">
      {/* Hero Split Assimétrico */}
      <section className="border-b border-[var(--kuara-border)] bg-[var(--kuara-surface)] py-10 sm:py-14 lg:py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          {/* Coluna Editorial (Esquerda) */}
          <div className="lg:col-span-6 xl:col-span-7 space-y-5 pt-1">
            <div className="inline-flex items-center gap-2 h-6 px-2.5 rounded-md border border-[var(--kuara-border)] bg-[var(--kuara-surface-muted)] text-[11px] font-medium text-[var(--kuara-fg-muted)]">
              <ShieldCheck className="w-3.5 h-3.5 text-[var(--kuara-primary)] shrink-0" />
              <span>Manutenção e reformas residenciais sem improviso</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-[40px] font-bold tracking-[-0.025em] text-[var(--kuara-fg)] leading-[1.12] max-w-xl">
              Resolva reparos em casa com profissionais verificados e serviço garantido
            </h1>

            <p className="text-sm sm:text-[15px] text-[var(--kuara-fg-muted)] leading-relaxed max-w-xl">
              Encontre alguém de confiança para receber em casa, compare até 4 propostas claras por
              escopo e prazo e conte com acompanhamento formal do pedido à entrega.
            </p>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              {renderHeroActions()}
            </div>

            <div className="pt-4 border-t border-[var(--kuara-border)] grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-xl">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-[var(--kuara-fg)] block">
                  Perfis verificados
                </span>
                <span className="text-[11px] text-[var(--kuara-fg-muted)] block">
                  Documento e comprovante conferidos antes de atender na sua casa
                </span>
              </div>
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-[var(--kuara-fg)] block">
                  Acordo formalizado
                </span>
                <span className="text-[11px] text-[var(--kuara-fg-muted)] block">
                  Escopo, prazo e materiais definidos por escrito antes da execução
                </span>
              </div>
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-[var(--kuara-fg)] block">
                  Garantia pós-serviço
                </span>
                <span className="text-[11px] text-[var(--kuara-fg-muted)] block">
                  Conferência de 72 horas na entrega e mediação se algo der errado
                </span>
              </div>
            </div>
          </div>

          {/* Coluna Workbench Interativo (Direita) */}
          <div className="lg:col-span-6 xl:col-span-5">
            <Card variant="elevated" className="shadow-panel overflow-hidden">
              <div className="px-4 py-2.5 border-b border-[var(--kuara-border)] bg-[var(--kuara-surface-muted)] flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-[11px] font-semibold text-[var(--kuara-fg-muted)]">
                    {stage.protocol}
                  </span>
                  <span className="text-[var(--kuara-border-strong)]">/</span>
                  <span className="text-[11px] font-medium text-[var(--kuara-fg-muted)] truncate">
                    Acompanhamento de um serviço na Kuara
                  </span>
                </div>
                <Badge status={stage.status} size="xs" />
              </div>

              <div className="p-4 space-y-4">
                <ButtonGroup<EscrowStageKey>
                  variant="segmented"
                  size="xs"
                  fullWidth
                  value={activeStage}
                  onChange={setActiveStage}
                  options={[
                    { value: "OPEN", label: ESCROW_STAGES.OPEN.tabLabel },
                    { value: "QUOTES", label: ESCROW_STAGES.QUOTES.tabLabel },
                    { value: "HELD", label: ESCROW_STAGES.HELD.tabLabel },
                    { value: "APPROVED", label: ESCROW_STAGES.APPROVED.tabLabel },
                  ]}
                />

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h2 className="text-sm font-semibold text-[var(--kuara-fg)]">
                      {stage.title}
                    </h2>
                    <Tag>Elétrica</Tag>
                  </div>
                  <p className="text-[11px] text-[var(--kuara-fg-subtle)]">{stage.location}</p>
                  <p className="text-xs text-[var(--kuara-fg-muted)] leading-relaxed pt-1">
                    {stage.summary}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {stage.metrics.map((m) => (
                    <div
                      key={m.label}
                      className="p-2.5 rounded-md border border-[var(--kuara-border)] bg-[var(--kuara-surface-muted)]/70"
                    >
                      <span className="text-[10px] text-[var(--kuara-fg-subtle)] block truncate">
                        {m.label}
                      </span>
                      <span
                        className={`text-xs font-semibold tabular-nums mt-0.5 block truncate ${
                          m.tone === "success"
                            ? "text-[var(--kuara-success-text)]"
                            : m.tone === "warning"
                            ? "text-[var(--kuara-warning-text)]"
                            : "text-[var(--kuara-fg)]"
                        }`}
                      >
                        {m.value}
                      </span>
                    </div>
                  ))}
                </div>

                <div
                  className={`p-3 rounded-md border text-xs flex items-start gap-2.5 ${
                    stage.contactUnlocked
                      ? "border-[var(--kuara-success-border)] bg-[var(--kuara-success-soft)]"
                      : "border-[var(--kuara-border)] bg-[var(--kuara-surface-muted)]"
                  }`}
                >
                  {stage.contactUnlocked ? (
                    <Unlock className="w-4 h-4 text-[var(--kuara-success-text)] shrink-0 mt-0.5" />
                  ) : (
                    <MessageSquareLock className="w-4 h-4 text-[var(--kuara-warning-text)] shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-0.5 min-w-0">
                    <p
                      className={`font-semibold text-[11px] ${
                        stage.contactUnlocked
                          ? "text-[var(--kuara-success-text)]"
                          : "text-[var(--kuara-fg)]"
                      }`}
                    >
                      {stage.safeguardTitle}
                    </p>
                    <p className="text-[11px] text-[var(--kuara-fg-muted)] leading-relaxed">
                      {stage.safeguardText}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Fluxo Sequencial em 4 Etapas */}
      <section id="como-funciona" className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 space-y-5">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-[var(--kuara-fg)] tracking-tight">
            Como funciona do pedido à conclusão
          </h2>
          <p className="text-xs text-[var(--kuara-fg-muted)] max-w-2xl">
            Um processo pensado para acabar com a insegurança de contratar desconhecidos e com o
            desperdício de contatos sem retorno.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border border-[var(--kuara-border)] rounded-lg bg-[var(--kuara-surface)] divide-y sm:divide-y-0 sm:divide-x divide-[var(--kuara-border)] overflow-hidden">
          {WORKFLOW_STEPS.map((item) => (
            <div key={item.step} className="p-5 space-y-2">
              <span className="font-mono text-[11px] font-semibold text-[var(--kuara-primary)] block">
                {item.step}
              </span>
              <h3 className="text-xs font-semibold text-[var(--kuara-fg)]">{item.title}</h3>
              <p className="text-xs text-[var(--kuara-fg-muted)] leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Garantias Bilaterais + Especialidades */}
      <section id="garantias" className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[var(--kuara-success-text)]" />
                <CardTitle>Para quem precisa do reparo</CardTitle>
              </div>
              <CardDescription>
                Tranquilidade para receber um profissional em casa, comparar propostas e garantir a entrega.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-[var(--kuara-fg-muted)]">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--kuara-success-text)] shrink-0 mt-0.5" />
                <span>
                  Profissionais com documento de identidade e comprovante de residência auditados pela equipe Kuara.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--kuara-success-text)] shrink-0 mt-0.5" />
                <span>
                  Termo digital registrando o que será feito, o prazo e quem fornece os materiais — sem combinados soltos.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--kuara-success-text)] shrink-0 mt-0.5" />
                <span>
                  Telefone e endereço completo só ficam visíveis para o profissional escolhido após a contratação.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <Scale className="w-3.5 h-3.5 text-[var(--kuara-warning-text)] shrink-0 mt-0.5" />
                <span>
                  Suporte e mediação com registro de fotos caso o serviço apresente defeito ou fique incompleto.
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-[var(--kuara-primary)]" />
                <CardTitle>Para profissionais autônomos</CardTitle>
              </div>
              <CardDescription>
                Clientes reais prontos para fechar, valorização do seu trabalho técnico e zero compra de moedas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-[var(--kuara-fg-muted)]">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--kuara-primary)] shrink-0 mt-0.5" />
                <span>
                  Fim dos pacotes de moedas para falar com contatos frios que não respondem ou anúncios antigos.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--kuara-primary)] shrink-0 mt-0.5" />
                <span>
                  Solicitações detalhadas com fotos do problema para orçar com precisão e evitar disputa predatória só por preço.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <Clock className="w-3.5 h-3.5 text-[var(--kuara-primary)] shrink-0 mt-0.5" />
                <span>
                  Materiais inclusos liberados na contratação para comprar na loja sem tirar do próprio bolso.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--kuara-primary)] shrink-0 mt-0.5" />
                <span>
                  Escopo comprovado por escrito e avaliações técnicas que fortalecem sua reputação a cada entrega.
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card variant="muted" padding="md">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-xs font-semibold text-[var(--kuara-fg)]">
                Especialidades de manutenção residencial atendidas
              </h3>
              <p className="text-[11px] text-[var(--kuara-fg-muted)]">
                Escolha a categoria do seu problema em casa para iniciar a solicitação no painel.
              </p>
            </div>

            <Divider className="lg:hidden" />

            <div className="flex flex-wrap items-center gap-2">
              {SPECIALTIES.map((spec) => (
                <Link
                  key={spec.label}
                  to={getCategoryRequestLink(spec.label)}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  {spec.icon}
                  <span>{spec.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
};
