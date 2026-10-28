import type { Participant } from '../types/game';

export const MIN_PARTICIPANTS = 2;
export const MAX_PARTICIPANTS = 20;
export const MAX_NAME_LENGTH = 20;

/** 20 clearly distinct colours, used for defaults and for newly added participants. */
export const COLOR_PALETTE: readonly string[] = [
  '#ef4444', '#3b82f6', '#fbbf24', '#22c55e', '#a855f7',
  '#f97316', '#ec4899', '#14b8a6', '#84cc16', '#06b6d4',
  '#e11d48', '#6366f1', '#eab308', '#10b981', '#8b5cf6',
  '#0ea5e9', '#d946ef', '#fb7185', '#a3e635', '#e5e7eb',
];

const EXTRA_NAMES: readonly string[] = [
  'Pink Comet', 'Teal Turtle', 'Lime Lizard', 'Cyan Eagle', 'Crimson Wolf', 'Indigo Owl',
  'Amber Bee', 'Mint Panda', 'Violet Viper', 'Sky Falcon', 'Magenta Moth', 'Coral Crab',
  'Olive Otter', 'Silver Swan',
];

/** The six example racers from the brief. */
export const DEFAULT_ROSTER: ReadonlyArray<{ name: string; color: string }> = [
  { name: 'Red Dragon', color: '#ef4444' },
  { name: 'Blue Shark', color: '#3b82f6' },
  { name: 'Golden Tiger', color: '#fbbf24' },
  { name: 'Green Ninja', color: '#22c55e' },
  { name: 'Purple Ghost', color: '#a855f7' },
  { name: 'Orange Fox', color: '#f97316' },
];

let idCounter = 0;
export function createId(): string {
  idCounter += 1;
  return `p${Date.now().toString(36)}${idCounter.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

export function createDefaultParticipants(): Participant[] {
  return DEFAULT_ROSTER.map((r) => ({ id: createId(), name: r.name, color: r.color }));
}

export const normalizeName = (name: string): string => name.trim().replace(/\s+/g, ' ').toLowerCase();
export const normalizeColor = (color: string): string => color.trim().toLowerCase();
export const isValidHexColor = (color: string): boolean => /^#[0-9a-f]{6}$/i.test(color.trim());

export function pickNextColor(list: readonly Participant[]): string {
  const used = new Set(list.map((p) => normalizeColor(p.color)));
  const free = COLOR_PALETTE.find((c) => !used.has(c));
  if (free) return free;
  for (let i = 0; i < 50; i++) {
    const c = `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`;
    if (!used.has(c)) return c;
  }
  return '#ffffff';
}

export function pickNextName(list: readonly Participant[]): string {
  const used = new Set(list.map((p) => normalizeName(p.name)));
  const free = EXTRA_NAMES.find((n) => !used.has(normalizeName(n)));
  if (free) return free;
  let n = list.length + 1;
  while (used.has(normalizeName(`Racer ${n}`))) n++;
  return `Racer ${n}`;
}

/** Returns a new list with one more participant (unchanged if already at the maximum). */
export function addParticipant(list: readonly Participant[]): Participant[] {
  if (list.length >= MAX_PARTICIPANTS) return list.slice();
  return [...list, { id: createId(), name: pickNextName(list), color: pickNextColor(list) }];
}

/** Returns a new list without `id` (unchanged if at the minimum or the id is unknown). */
export function removeParticipant(list: readonly Participant[], id: string): Participant[] {
  if (list.length <= MIN_PARTICIPANTS) return list.slice();
  return list.filter((p) => p.id !== id);
}

export function updateParticipant(
  list: readonly Participant[],
  id: string,
  patch: Partial<Pick<Participant, 'name' | 'color'>>,
): Participant[] {
  return list.map((p) => (p.id === id ? { ...p, ...patch } : p));
}

export interface ValidationResult {
  valid: boolean;
  /** Problems that are not tied to one row (e.g. too few participants). */
  global: string[];
  /** Problems per participant id. */
  byId: Record<string, string[]>;
}

export function validateParticipants(list: readonly Participant[]): ValidationResult {
  const global: string[] = [];
  const byId: Record<string, string[]> = {};
  const add = (id: string, msg: string) => {
    (byId[id] ??= []).push(msg);
  };

  if (list.length < MIN_PARTICIPANTS) global.push(`Add at least ${MIN_PARTICIPANTS} participants to race.`);
  if (list.length > MAX_PARTICIPANTS) global.push(`A race supports at most ${MAX_PARTICIPANTS} participants.`);

  const nameCounts = new Map<string, number>();
  const colorCounts = new Map<string, number>();
  for (const p of list) {
    const n = normalizeName(p.name);
    if (n) nameCounts.set(n, (nameCounts.get(n) ?? 0) + 1);
    if (isValidHexColor(p.color)) {
      const c = normalizeColor(p.color);
      colorCounts.set(c, (colorCounts.get(c) ?? 0) + 1);
    }
  }

  for (const p of list) {
    const trimmed = p.name.trim();
    if (!trimmed) add(p.id, 'Name is required.');
    else if (trimmed.length > MAX_NAME_LENGTH) add(p.id, `Name must be ${MAX_NAME_LENGTH} characters or fewer.`);
    else if ((nameCounts.get(normalizeName(p.name)) ?? 0) > 1) add(p.id, 'Another participant already has this name.');

    if (!isValidHexColor(p.color)) add(p.id, 'Pick a valid color.');
    else if ((colorCounts.get(normalizeColor(p.color)) ?? 0) > 1) add(p.id, 'Another participant already uses this color.');
  }

  const valid = global.length === 0 && Object.keys(byId).length === 0;
  return { valid, global, byId };
}

/** Names are trimmed before they reach the engine; blank names get a safe fallback. */
export function sanitizeForRace(list: readonly Participant[]): Participant[] {
  return list.map((p, i) => ({
    id: p.id,
    name: p.name.trim() || `Ball ${i + 1}`,
    color: isValidHexColor(p.color) ? p.color.trim().toLowerCase() : '#ffffff',
  }));
}
