import { afterEach, describe, expect, it, vi } from 'vitest';
import { entriesByLanguage, meaningsFor, summaryFor } from '@/lib/meanings';

const fixture = {
  slug: 'isha',
  generatedAt: '2026-05-03T00:00:00.000Z',
  sources: [
    {
      id: 'gambhirananda',
      citation: 'Swāmī Gambhīrānanda, Eight Upaniṣads vol. I, Advaita Ashrama.',
      license: 'permission',
      isPrimary: true,
    },
    {
      id: 'sringeri-ml',
      citation: 'Śrī Śāradā Pīṭham, Sringeri — Malayalam edition.',
      license: 'permission',
    },
  ],
  units: {
    IS_C01_V01: {
      key: 'IS_C01_V01',
      entries: [
        {
          language: 'en',
          text: 'All this — whatsoever moves on the earth — should be covered by the Lord.',
          sourceId: 'gambhirananda',
        },
        {
          language: 'ml',
          text: 'ഈ ലോകത്തിലെ സകലതും ഈശ്വരനാൽ ആവൃതമാണ്…',
          sourceId: 'sringeri-ml',
        },
      ],
    },
  },
};

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);
afterEach(() => fetchMock.mockReset());

describe('meaningsFor', () => {
  it('returns empty when no slug', async () => {
    const r = await meaningsFor(undefined, 'IS_C01_V01', 0);
    expect(r.root).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('loads + returns entries for a known unit', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => fixture });
    const r = await meaningsFor('isha-meanings', 'IS_C01_V01', 0);
    expect(r.root).toHaveLength(2);
    expect(r.root[0].language).toBe('en');
    expect(r.sources['gambhirananda'].citation).toMatch(/Gambhīrānanda/);
  });

  it('handles 404 gracefully', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false });
    const r = await meaningsFor('isha-meanings-missing', 'IS_C01_V01', 0);
    expect(r.root).toEqual([]);
  });
});

describe('entriesByLanguage', () => {
  it('partitions entries by language', () => {
    const out = entriesByLanguage(fixture.units.IS_C01_V01.entries as never);
    expect(out.en).toHaveLength(1);
    expect(out.ml).toHaveLength(1);
  });
});

describe('summaryFor', () => {
  it('returns the first English + Malayalam entries', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => fixture });
    const s = await summaryFor('isha-meanings-summary', 'IS_C01_V01');
    expect(s.en?.text).toMatch(/All this/);
    expect(s.ml?.text).toMatch(/ലോകത്തിലെ/);
  });
});
