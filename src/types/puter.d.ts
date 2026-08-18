interface PuterAi {
  img2txt(source: string, options?: { provider?: string }): Promise<string>;
}

interface PuterAuth {
  isSignedIn(): boolean;
  getToken(): string | null;
}

interface PuterApi {
  ai: PuterAi;
  auth: PuterAuth;
  print(message: unknown): void;
}

interface Window {
  puter?: PuterApi;
}