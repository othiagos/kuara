import React from "react";
import { render, RenderOptions } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { ThemeProvider } from "../contexts/ThemeContext";
import { ToastProvider } from "../contexts/ToastContext";
import type { User } from "../contexts/AuthContext";

export const mockClientUser: User = {
  id: "client-1",
  name: "Maria Contratante",
  email: "maria@kuara.test",
  phone: "(11) 98888-1111",
  role: "CLIENT",
  ratingAverage: 4.8,
  ratingCount: 5,
};

export const mockProviderVerified: User = {
  id: "provider-1",
  name: "Carlos Eletricista",
  email: "carlos@kuara.test",
  phone: "(11) 97777-2222",
  role: "PROVIDER",
  providerProfile: {
    id: "profile-1",
    cpfCnpj: "123.456.789-00",
    pixKey: "carlos@pix.test",
    bio: "Eletricista residencial",
    status: "VERIFIED",
    rejectionReason: null,
    documentUrl: "https://docs.kuara.test/rg.pdf",
    addressProofUrl: "https://docs.kuara.test/comp.pdf",
    ratingAverage: 4.9,
    ratingCount: 14,
    categories: ["Elétrica"],
    serviceAreas: ["São Paulo"],
  },
};

export const mockProviderRejected: User = {
  ...mockProviderVerified,
  id: "provider-rej",
  providerProfile: {
    ...mockProviderVerified.providerProfile!,
    id: "profile-rej",
    status: "REJECTED",
    rejectionReason: "Documento com foto ilegível e fora da validade.",
    documentUrl: null,
    addressProofUrl: null,
  },
};

export const mockProviderSuspended: User = {
  ...mockProviderVerified,
  id: "provider-susp",
  providerProfile: {
    ...mockProviderVerified.providerProfile!,
    id: "profile-susp",
    status: "SUSPENDED",
    rejectionReason: "Tentativa reiterada de desintermediação.",
    documentUrl: "https://docs.kuara.test/rg.pdf",
    addressProofUrl: "https://docs.kuara.test/comp.pdf",
  },
};

export const mockProviderPending: User = {
  ...mockProviderVerified,
  id: "provider-pend",
  providerProfile: {
    ...mockProviderVerified.providerProfile!,
    id: "profile-pend",
    status: "PENDING_VERIFICATION",
    rejectionReason: null,
    documentUrl: null,
    addressProofUrl: null,
  },
};

export const mockAdminUser: User = {
  id: "admin-1",
  name: "Admin Kuara",
  email: "admin@kuara.test",
  phone: "(11) 90000-0000",
  role: "ADMIN",
};

export const LocationProbe: React.FC = () => {
  const location = useLocation();
  return (
    <div data-testid="location-probe" data-pathname={location.pathname} data-search={location.search}>
      {location.pathname}
      {location.search}
    </div>
  );
};

interface RenderWithProvidersOptions extends Omit<RenderOptions, "wrapper"> {
  initialEntries?: string[];
  includeLocationProbe?: boolean;
}

export function renderWithProviders(
  ui: React.ReactElement,
  { initialEntries = ["/"], includeLocationProbe = true, ...options }: RenderWithProvidersOptions = {}
) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <ThemeProvider>
        <ToastProvider>
          {ui}
          {includeLocationProbe && <LocationProbe />}
        </ToastProvider>
      </ThemeProvider>
    </MemoryRouter>,
    options
  );
}
