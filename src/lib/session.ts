import { randomBytes } from 'crypto';

export type Session = {
  email: string;
  expiresAt: number;
};

const sessionStore = new Map<string, Session>();

export function createSession(email: string): string {
  const token = randomBytes(32).toString('hex');
  sessionStore.set(token, {
    email,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 días
  });
  return token;
}

export function getSession(token: string | undefined): Session | null {
  if (!token) return null;
  const session = sessionStore.get(token);
  if (!session || session.expiresAt < Date.now()) {
    sessionStore.delete(token);
    return null;
  }
  return session;
}

export function deleteSession(token: string): void {
  sessionStore.delete(token);
}
