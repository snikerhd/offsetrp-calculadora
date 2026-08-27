import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest } from "next/server";

export const SESSION_COOKIE = "oc_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 dias

interface Account {
  user: string;
  password: string;
}

// Contas via env: ACCESS_ACCOUNTS="joao:senha1,maria:senha2" ou, mais simples,
// ACCESS_PASSWORD (uma senha única, utilizador fica em branco).
function getAccounts(): Account[] {
  const list: Account[] = [];
  const multi = process.env.ACCESS_ACCOUNTS;
  if (multi) {
    for (const pair of multi.split(",")) {
      const idx = pair.indexOf(":");
      if (idx > 0) list.push({ user: pair.slice(0, idx).trim().toLowerCase(), password: pair.slice(idx + 1).trim() });
      else list.push({ user: "", password: pair.trim() });
    }
  }
  const single = process.env.ACCESS_PASSWORD;
  if (single) list.push({ user: "", password: single.trim() });
  if (list.length === 0) {
    // Sem configuração: senha padrão para não bloquear o dono do site
    // (pode sempre ser substituída pelas env vars ACCESS_PASSWORD / ACCESS_ACCOUNTS).
    list.push({ user: "", password: "offsetrp" });
  }
  return list;
}

function getSecret(): string {
  return process.env.ACCESS_SECRET || process.env.ACCESS_PASSWORD || "offsetrp-secret";
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function verifyCredentials(user: string | undefined, password: string): boolean {
  const u = (user || "").trim().toLowerCase();
  return getAccounts().some((a) => safeEqual(a.password, password) && (!a.user || a.user === u));
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function createSessionToken(): string {
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = String(exp);
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!safeEqual(sig, sign(payload))) return false;
  const exp = Number(payload);
  return Number.isFinite(exp) && Date.now() < exp;
}

export function isAuthed(req: NextRequest): boolean {
  return verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
}

export const SESSION_MAX_AGE_S = Math.floor(SESSION_TTL_MS / 1000);
