import type { BhashyaText } from '@/types';

/**
 * Canonical catalog of the 13 Prasthanatrayi bhashyas authored by
 * Adi Shankaracharya, in the traditional sequence used by parayanam
 * practitioners. `sourceCode` matches the path segment used by
 * advaitasharada.sringeri.net (.../display/bhashya/<sourceCode>/devanagari).
 */
export const BHASHYA_CATALOG: Array<
  Pick<BhashyaText, 'slug' | 'sourceCode' | 'titleSa' | 'titleIast' | 'titleEn' | 'group'>
> = [
  {
    slug: 'isha',
    sourceCode: 'Isha',
    titleSa: 'ईशावास्योपनिषद्भाष्यम्',
    titleIast: 'Īśāvāsyopaniṣad-bhāṣyam',
    titleEn: 'Isha Upanishad Bhashya',
    group: 'upanishad',
  },
  {
    slug: 'kena-pada',
    sourceCode: 'Kena_pada',
    titleSa: 'केनोपनिषत्पदभाष्यम्',
    titleIast: 'Kenopaniṣat-pada-bhāṣyam',
    titleEn: 'Kena Upanishad Pada Bhashya',
    group: 'upanishad',
  },
  {
    slug: 'kena-vakya',
    sourceCode: 'Kena_vakya',
    titleSa: 'केनोपनिषद्वाक्यभाष्यम्',
    titleIast: 'Kenopaniṣad-vākya-bhāṣyam',
    titleEn: 'Kena Upanishad Vakya Bhashya',
    group: 'upanishad',
  },
  {
    slug: 'katha',
    sourceCode: 'Kathaka',
    titleSa: 'कठोपनिषद्भाष्यम्',
    titleIast: 'Kaṭhopaniṣad-bhāṣyam',
    titleEn: 'Katha Upanishad Bhashya',
    group: 'upanishad',
  },
  {
    slug: 'prashna',
    sourceCode: 'Prashna',
    titleSa: 'प्रश्नोपनिषद्भाष्यम्',
    titleIast: 'Praśnopaniṣad-bhāṣyam',
    titleEn: 'Prashna Upanishad Bhashya',
    group: 'upanishad',
  },
  {
    slug: 'mundaka',
    sourceCode: 'Mundaka',
    titleSa: 'मुण्डकोपनिषद्भाष्यम्',
    titleIast: 'Muṇḍakopaniṣad-bhāṣyam',
    titleEn: 'Mundaka Upanishad Bhashya',
    group: 'upanishad',
  },
  {
    slug: 'mandukya',
    sourceCode: 'Mandukya',
    titleSa: 'माण्डूक्योपनिषद्भाष्यम्',
    titleIast: 'Māṇḍūkyopaniṣad-bhāṣyam',
    titleEn: 'Mandukya Upanishad Bhashya',
    group: 'upanishad',
  },
  {
    slug: 'taittiriya',
    sourceCode: 'Taitiriya',
    titleSa: 'तैत्तिरीयोपनिषद्भाष्यम्',
    titleIast: 'Taittirīyopaniṣad-bhāṣyam',
    titleEn: 'Taittiriya Upanishad Bhashya',
    group: 'upanishad',
  },
  {
    slug: 'aitareya',
    sourceCode: 'Aitareya',
    titleSa: 'ऐतरेयोपनिषद्भाष्यम्',
    titleIast: 'Aitareyopaniṣad-bhāṣyam',
    titleEn: 'Aitareya Upanishad Bhashya',
    group: 'upanishad',
  },
  {
    slug: 'chandogya',
    sourceCode: 'Chandogya',
    titleSa: 'छान्दोग्योपनिषद्भाष्यम्',
    titleIast: 'Chāndogyopaniṣad-bhāṣyam',
    titleEn: 'Chandogya Upanishad Bhashya',
    group: 'upanishad',
  },
  {
    slug: 'brihadaranyaka',
    sourceCode: 'Brha',
    titleSa: 'बृहदारण्यकोपनिषद्भाष्यम्',
    titleIast: 'Bṛhadāraṇyakopaniṣad-bhāṣyam',
    titleEn: 'Brihadaranyaka Upanishad Bhashya',
    group: 'upanishad',
  },
  {
    slug: 'gita',
    sourceCode: 'Gita',
    titleSa: 'श्रीमद्भगवद्गीताभाष्यम्',
    titleIast: 'Śrīmad-bhagavadgītā-bhāṣyam',
    titleEn: 'Bhagavad Gita Bhashya',
    group: 'gita',
  },
  {
    slug: 'brahma-sutra',
    sourceCode: 'BS',
    titleSa: 'ब्रह्मसूत्रभाष्यम्',
    titleIast: 'Brahmasūtra-bhāṣyam',
    titleEn: 'Brahma Sutra Bhashya',
    group: 'brahma-sutra',
  },
];

export const SOURCE_ATTRIBUTION = {
  name: 'Advaita Sharada — Dakshinamnaya Sri Sharada Peetham, Sringeri',
  url: 'https://advaitasharada.sringeri.net/',
  note: 'Sanskrit text of the bhashyas is drawn from the digital edition maintained by the Sringeri Sharada Peetham. This reader is an independent parayanam-focused interface over that public corpus; all credit for the editorial work belongs to Advaita Sharada.',
} as const;
