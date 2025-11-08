declare namespace NodeJS {
  interface ProcessEnv {
    ARC_RPC_URL: string;
    ARC_CHAIN_ID: string;
    ARC_EXPLORER_BASE: string;
    USDC_ADDRESS: string;
    USDC_DECIMALS: string;
    SERVICE_PRIVATE_KEY: string;
    MERCHANT_ADDRESS: string;
    CIRCLE_API_BASE: string;
    CIRCLE_API_KEY: string;
    BRIDGE_ENV: string;
    NEXT_PUBLIC_ARC_EXPLORER_BASE?: string;
    NEXT_PUBLIC_BASE_URL?: string;
  }
}
