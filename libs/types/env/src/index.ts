import { z } from 'zod';

export const WebEnvSchema = z.object({
  VITE_API_BASE_URL: z.string().url().default('http://localhost:8787'),
  VITE_BACKEND_URL: z.string().url().default('http://localhost:8787')
});

export const BackendEnvSchema = z.object({
  BACKEND_URL: z.string().url().default('https://api.ulasim20.com')
});

export type WebEnv = z.infer<typeof WebEnvSchema>;
export type BackendEnv = z.infer<typeof BackendEnvSchema>;
