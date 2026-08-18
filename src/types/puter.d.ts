interface PuterAi {
  img2txt(source: string, options?: { provider?: string }): Promise<string>;
}

interface PuterApi {
  ai: PuterAi;
  print(message: unknown): void;
}

interface Window {
  puter?: PuterApi;
}