/// <reference types="@cloudflare/workers-types" />

declare interface Env {
  DB: D1Database;
  AI: Ai;
  ENVIRONMENT: string;
  OPENDART_API_KEY?: string;
  OPENAI_API_KEY?: string;
  KRX_API_KEY?: string;
  KRX_KOSPI_API_URL?: string;
  KRX_KOSDAQ_API_URL?: string;
  KRX_SOURCE?: string;
  KRX_PUBLIC_KOSPI_URL?: string;
  KRX_PUBLIC_KOSDAQ_URL?: string;
  KRX_USE_MOCK?: string;
}
