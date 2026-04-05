import { kv } from "@vercel/kv";
import { BILL_ID, DEFAULT_PEOPLE, Person } from "./bill";

// Claims state: { [itemId]: string[] }  where string[] is array of person ids
export type ClaimsState = Record<string, string[]>;

const CLAIMS_KEY = `bill:${BILL_ID}:claims`;
const PEOPLE_KEY = `bill:${BILL_ID}:people`;

// In-memory fallback for local dev when KV isn't configured.
// Production on Vercel with KV env vars will use the real store.
const hasKV =
  !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN;

let memoryStore: ClaimsState = {};
let memoryPeopleStore: Person[] | null = null;

export async function readClaims(): Promise<ClaimsState> {
  if (!hasKV) return memoryStore;
  try {
    const data = (await kv.get<ClaimsState>(CLAIMS_KEY)) || {};
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
    await kv.set(CLAIMS_KEY, state);
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
    await kv.del(CLAIMS_KEY);
  } catch (e) {
    console.error("KV reset error:", e);
  }
}

// ---- People ----

export async function readPeople(): Promise<Person[]> {
  if (!hasKV) {
    if (!memoryPeopleStore) memoryPeopleStore = [...DEFAULT_PEOPLE];
    return memoryPeopleStore;
  }
  try {
    const data = await kv.get<Person[]>(PEOPLE_KEY);
    if (data && data.length > 0) return data;
    // Seed with defaults on first read
    await kv.set(PEOPLE_KEY, DEFAULT_PEOPLE);
    return [...DEFAULT_PEOPLE];
  } catch (e) {
    console.error("KV people read error:", e);
    return [...DEFAULT_PEOPLE];
  }
}

export async function addPerson(person: Person): Promise<Person[]> {
  const people = await readPeople();
  if (people.find((p) => p.id === person.id)) return people;
  people.push(person);
  if (!hasKV) {
    memoryPeopleStore = people;
    return people;
  }
  try {
    await kv.set(PEOPLE_KEY, people);
  } catch (e) {
    console.error("KV people write error:", e);
  }
  return people;
}
