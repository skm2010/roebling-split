import { kv } from "@vercel/kv";
import { BILL_ID } from "./bill";

// Claims state: { [itemId]: string[] }  where string[] is array of person ids
export type ClaimsState = Record<string, string[]>;

const KEY = `bill:${BILL_ID}:claims`;

// In-memory fallback for local dev when KV isn't configured.
// Production on Vercel with KV env vars will use the real store.
const hasKV =
  !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN;

let memoryStore: ClaimsState = {};

export async function readClaims(): Promise<ClaimsState> {
  if (!hasKV) return memoryStore;
  try {
    const data = (await kv.get<ClaimsState>(KEY)) || {};
    return data;
  } catch (e) {
    console.error("KV read error:", e);
    return {};
  }
}

export async function writeClaims(state: ClaimsState): Promise<void> {
  if (!hasKV) {
    memoryStore = state;
    return;
  }
  try {
    await kv.set(KEY, state);
  } catch (e) {
    console.error("KV write error:", e);
  }
}

export async function resetClaims(): Promise<void> {
  if (!hasKV) {
    memoryStore = {};
    return;
  }
  try {
    await kv.del(KEY);
  } catch (e) {
    console.error("KV reset error:", e);
  }
}
