export interface AppConfig {
  apiToken: string;
  apiBaseUrl: string;
  showConversionRate: boolean;
  modelos: string[];
}

const CONFIG_KEY = "nsgraph_config";

const DEFAULT_CONFIG: AppConfig = {
  apiToken: import.meta.env.VITE_API_TOKEN || "",
  apiBaseUrl:
    import.meta.env.VITE_API_BASE_URL ||
    "https://api.meuerponline.com.br/publica",
  showConversionRate: true,
  modelos: ["65", "55", "59", "PV"],
};

export function getConfig(): AppConfig {
  try {
    const stored = localStorage.getItem(CONFIG_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<AppConfig>;
      return { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch {
    // ignore parse errors
  }
  return DEFAULT_CONFIG;
}

export function saveConfig(config: Partial<AppConfig>): void {
  const current = getConfig();
  const updated = { ...current, ...config };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(updated));
}

export function hasToken(): boolean {
  const config = getConfig();
  return config.apiToken.length > 0;
}
