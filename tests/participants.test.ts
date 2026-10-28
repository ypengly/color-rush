import { describe, expect, it } from 'vitest';
import {
  COLOR_PALETTE,
  MAX_NAME_LENGTH,
  MAX_PARTICIPANTS,
  MIN_PARTICIPANTS,
  addParticipant,
  createDefaultParticipants,
  removeParticipant,
  sanitizeForRace,
  updateParticipant,
  validateParticipants,
} from '../src/game/participants';
import type { Participant } from '../src/types/game';

const p = (id: string, name: string, color: string): Participant => ({ id, name, color });

describe('defaults', () => {
  it('creates the six example racers with unique ids, names and colours', () => {
    const list = createDefaultParticipants();
    expect(list.map((x) => x.name)).toEqual([
      'Red Dragon', 'Blue Shark', 'Golden Tiger', 'Green Ninja', 'Purple Ghost', 'Orange Fox',
    ]);
    expect(new Set(list.map((x) => x.id)).size).toBe(6);
    expect(validateParticipants(list).valid).toBe(true);
  });

  it('restoring defaults yields fresh ids each time', () => {
    const a = createDefaultParticipants();
    const b = createDefaultParticipants();
    expect(a.map((x) => x.id)).not.toEqual(b.map((x) => x.id));
  });
});

describe('add / remove / update', () => {
  it('adds participants with unique names and colours up to the maximum', () => {
    let list = createDefaultParticipants();
    for (let i = 0; i < 40; i++) list = addParticipant(list);
    expect(list).toHaveLength(MAX_PARTICIPANTS);
    expect(validateParticipants(list).valid).toBe(true);
    expect(new Set(list.map((x) => x.color)).size).toBe(MAX_PARTICIPANTS);
    expect(COLOR_PALETTE.length).toBeGreaterThanOrEqual(MAX_PARTICIPANTS);
  });

  it('never removes below the minimum', () => {
    let list = createDefaultParticipants();
    for (const item of list.slice()) list = removeParticipant(list, item.id);
    expect(list).toHaveLength(MIN_PARTICIPANTS);
  });

  it('updates only the targeted participant and does not mutate the input', () => {
    const list = [p('1', 'A', '#111111'), p('2', 'B', '#222222')];
    const next = updateParticipant(list, '2', { name: 'Bee' });
    expect(next[1].name).toBe('Bee');
    expect(next[0]).toBe(list[0]);
    expect(list[1].name).toBe('B');
  });
});

describe('validation', () => {
  it('flags too few participants', () => {
    const r = validateParticipants([p('1', 'Solo', '#111111')]);
    expect(r.valid).toBe(false);
    expect(r.global.length).toBeGreaterThan(0);
  });

  it('flags too many participants', () => {
    const list = Array.from({ length: 21 }, (_, i) => p(`${i}`, `N${i}`, `#${(i + 1).toString(16).padStart(6, '0')}`));
    expect(validateParticipants(list).valid).toBe(false);
  });

  it('flags empty and over-long names', () => {
    const r = validateParticipants([p('1', '   ', '#111111'), p('2', 'x'.repeat(MAX_NAME_LENGTH + 1), '#222222')]);
    expect(r.byId['1']).toBeDefined();
    expect(r.byId['2']).toBeDefined();
    expect(r.valid).toBe(false);
  });

  it('flags duplicate names regardless of case and spacing', () => {
    const r = validateParticipants([p('1', 'Red  Dragon', '#111111'), p('2', 'red dragon ', '#222222'), p('3', 'Other', '#333333')]);
    expect(r.byId['1']).toBeDefined();
    expect(r.byId['2']).toBeDefined();
    expect(r.byId['3']).toBeUndefined();
  });

  it('flags duplicate and invalid colours', () => {
    const r = validateParticipants([p('1', 'A', '#ABCDEF'), p('2', 'B', '#abcdef'), p('3', 'C', 'red')]);
    expect(r.byId['1']).toBeDefined();
    expect(r.byId['2']).toBeDefined();
    expect(r.byId['3']).toBeDefined();
  });

  it('accepts a clean list', () => {
    expect(validateParticipants([p('1', 'A', '#111111'), p('2', 'B', '#222222')]).valid).toBe(true);
  });
});

describe('sanitizeForRace', () => {
  it('trims names, lowercases colours and falls back for blanks', () => {
    const out = sanitizeForRace([p('1', '  Zed  ', '#ABCDEF'), p('2', '', 'nope')]);
    expect(out[0]).toEqual({ id: '1', name: 'Zed', color: '#abcdef' });
    expect(out[1].name).toBe('Ball 2');
    expect(out[1].color).toBe('#ffffff');
  });
});
