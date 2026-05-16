import { afterEach, describe, expect, it, vi } from 'vitest';
import { lookupGlosses } from '@/lib/glosses';

const fixture = {
  slug: 'isha',
  generatedAt: '2026-05-03T00:00:00.000Z',
  glossesPerTerm: {
    'लिप्यस': [
      {
        unitId: 'IS_C01_V02',
        snippet: 'कर्मणा न लिप्यस इत्यर्थः',
        rule: 'ity-arthah',
        score: 1.0,
      },
    ],
    'ईश्वर': [
      {
        unitId: 'IS_C01_V08',
        snippet: 'सर्वज्ञ ईश्वर इत्यर्थः',
        rule: 'ity-arthah',
        score: 1.0,
      },
    ],
  },
};

const fetchMock = vi.fn();

vi.stubGlobal('fetch', fetchMock);

afterEach(() => {
  fetchMock.mockReset();
});

describe('lookupGlosses', () => {
  it('returns empty list for missing slug', async () => {
    const r = await lookupGlosses(undefined, 'ईश्वर');
    expect(r).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches the per-text gloss file and resolves a known term', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => fixture,
    });
    // Use a unique slug so we don't hit the module-level cache populated
    // by other tests in the same run.
    const r = await lookupGlosses('isha-gloss-known', 'ईश्वर');
    // Module-level cache means the first hit may be the only fetch.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(r).toHaveLength(1);
    expect(r[0].unitId).toBe('IS_C01_V08');
    expect(r[0].rule).toBe('ity-arthah');
  });

  it('returns empty for unknown term', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => fixture,
    });
    const r = await lookupGlosses('isha-gloss-unknown', 'धर्म');
    expect(r).toEqual([]);
  });

  it('handles missing files gracefully', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false });
    const r = await lookupGlosses('isha-gloss-missing', 'ईश्वर');
    expect(r).toEqual([]);
  });
});
