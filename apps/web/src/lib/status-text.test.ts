import { describe, expect, it } from 'vitest';
import { getDictionary } from '@/i18n';
import { describeStatus, describeToday } from './status-text';

const pl = getDictionary('pl');
const en = getDictionary('en');

describe('describeStatus', () => {
  it('describes an open kiosk', () => {
    expect(describeStatus({ state: 'open', closesAt: '18:00', closesInMinutes: 120 }, en)).toEqual({
      tone: 'open',
      label: 'Open',
      detail: 'until 18:00',
    });
  });

  it('warns when closing within 30 minutes', () => {
    expect(describeStatus({ state: 'open', closesAt: '18:00', closesInMinutes: 30 }, pl)).toEqual({
      tone: 'closing',
      label: 'Wkrótce zamykamy',
      detail: 'do 18:00',
    });
  });

  it('describes the next opening today, tomorrow and later in the week', () => {
    const base = { date: '2026-11-02', weekday: 'mon' as const, opensAt: '06:30' };
    expect(describeStatus({ state: 'closed', next: { ...base, daysAhead: 0 } }, en).detail).toBe('opens today at 06:30');
    expect(describeStatus({ state: 'closed', next: { ...base, daysAhead: 1 } }, pl).detail).toBe('otwieramy jutro o 06:30');
    expect(
      describeStatus({ state: 'closed', next: { ...base, weekday: 'tue', daysAhead: 2 } }, pl).detail,
    ).toBe('otwieramy we wtorek o 06:30');
    expect(describeStatus({ state: 'closed', next: { ...base, daysAhead: 2 } }, en).detail).toBe(
      'opens on Monday at 06:30',
    );
  });

  it('handles no upcoming opening', () => {
    expect(describeStatus({ state: 'closed', next: null }, en)).toEqual({
      tone: 'closed',
      label: 'Closed',
      detail: 'no upcoming opening hours',
    });
  });
});

describe('describeToday', () => {
  it('lists today’s intervals or says closed', () => {
    expect(describeToday([{ open: '06:30', close: '18:00' }], en)).toBe('Today: 06:30–18:00');
    expect(describeToday([], pl)).toBe('Dziś nieczynne');
  });
});
