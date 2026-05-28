export type ContractCompatibilityDto = {
  contractId: string | null;
  currentVersion: string | null;
  requiredVersion: string;
  supported: boolean;
  schema: string | null;
  reason: string;
  recommendation: string;
  method?: string;
};

export type ContractCompatibilityFlow =
  | "linkMetadata"
  | "paymentLinkStatus"
  | "quote"
  | "compose";
