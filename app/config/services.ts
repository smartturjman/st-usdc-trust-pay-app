export type ServiceItem = {
  id: string;
  label: string;
  serviceLabel?: string;
  partner?: string;
  partnerId: string;
  priceUSDC: number;
  partnerAddress?: string;
  defaultTrustScore?: number;
};

export const SERVICES: ServiceItem[] = [
  {
    id: "mofa-legal-translation",
    label: "Legal Translation — MOFA",
    serviceLabel: "Legal Translation — MOFA",
    partnerId: "translator-023",
    priceUSDC: 1.0,
    partnerAddress: "",
    defaultTrustScore: 84,
  },
  {
    id: "mofaic-attestation",
    label: "Document Attestation — MOFAIC",
    serviceLabel: "Document Attestation — MOFAIC",
    partnerId: "attest-011",
    priceUSDC: 1.25,
    partnerAddress: "",
    defaultTrustScore: 82,
  },
  {
    id: "public-prosecution",
    label: "Public Prosecution Assistance",
    serviceLabel: "Public Prosecution Assistance",
    partnerId: "legal-008",
    priceUSDC: 0.75,
    partnerAddress: "",
    defaultTrustScore: 83,
  },
  {
    id: "business-setup-ded",
    label: "Business Setup — DED",
    serviceLabel: "Business Setup — DED",
    partnerId: "biz-021",
    priceUSDC: 1.0,
    partnerAddress: "",
    defaultTrustScore: 85,
  },
  {
    id: "golden-visa",
    label: "Golden Visa Application",
    serviceLabel: "Golden Visa Application",
    partnerId: "gov-007",
    priceUSDC: 1.0,
    partnerAddress: "",
    defaultTrustScore: 86,
  },
];

export function findService(id: string): ServiceItem | undefined {
  return SERVICES.find((service) => service.id === id);
}
