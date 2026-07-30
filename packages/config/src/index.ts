export interface RuntimeConfig {
  appName: string;
  apiBaseUrl: string;
}

export function getPublicWebConfig(): RuntimeConfig {
  return {
    appName: process.env.NEXT_PUBLIC_APP_NAME ?? "SupportDesk",
    apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001",
  };
}
