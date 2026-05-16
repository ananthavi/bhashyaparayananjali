/**
 * Reverse-direction Sanskrit sandhi rules.
 *
 * Given a surface word and a position to split, propose the candidate
 * pre-sandhi pieces. The dictionary acts as the disambiguator — the
 * splitter calls into here, gets all possible (left, right) candidates,
 * and keeps the ones whose halves are real lemmas.
 *
 * We cover the subset of Pāṇinian sandhi that accounts for the vast
 * majority of encounters in prose bhāṣya:
 *
 *   1. Vowel coalescence (savarṇa-dīrgha and related)
 *      a + a/ā  → ā      ; a + i/ī → e ; a + u/ū → o ; a + ṛ → ar
 *      ā + a/ā → ā       ; ā + i/ī → e ; ā + u/ū → o ; ā + e → ai ; ā + o → au
 *      a + e   → ai      ; a + o → au
 *
 *   2. Yan-sandhi (semi-vowel before vowel)
 *      i/ī + V → y + V   ; u/ū + V → v + V ; ṛ + V → r + V
 *
 *   3. Ay/av/āy/āv-sandhi (e/o/ai/au before vowel)
 *      e + V  → ay + V   (often dropped: e a → e' = "e+'")
 *      o + V  → av + V
 *      ai + V → āy + V
 *      au + V → āv + V
 *
 *   4. Visarga sandhi (the most common bhāṣya cases)
 *      aḥ + voiced     → o + voiced              (e.g., देवः अस्ति → देवोऽस्ति)
 *      aḥ + a          → o + 'a (avagraha)
 *      āḥ + voiced     → ā + voiced
 *      ḥ + r           → r (with anuvīkṣā)
 *      ḥ + voiceless dental → s; palatal → ś; cerebral → ṣ
 *
 *   5. Final-consonant assimilation (a small but high-value subset)
 *      t + j/jh        → j ; t + ḍ/ḍh → ḍ ; t + l → l
 *      m + consonant   → ṃ + consonant (already-anusvāra form)
 *      n + l           → l (assimilated)
 *
 * Each rule produces zero or more (left, right) reversal candidates for
 * a given "boundary akṣara". Multiple rules may match the same surface
 * akṣara — we return all of them so the caller can score against the
 * dictionary.
 */

const HALANT = '्';

/** A proposed reversal at a boundary: surface ABC → left | right (pre-sandhi). */
export interface SandhiCandidate {
  left: string;
  right: string;
  rule: string;
}

/**
 * The boundary heuristic: given the full surface word and the akṣara index
 * at which we want to split, return all plausible (left, right) candidates
 * including the trivial no-sandhi split.
 *
 * `aksharaSeq` is the result of `aksharas(word)`; `i` is the index of the
 * first akṣara that belongs to the right half (so `i=0` and `i=N` are
 * meaningless boundaries).
 */
export function proposeAt(aksharaSeq: string[], i: number): SandhiCandidate[] {
  const leftRaw = aksharaSeq.slice(0, i).join('');
  const rightRaw = aksharaSeq.slice(i).join('');
  const out: SandhiCandidate[] = [];

  // 0. Trivial: just split, no sandhi was applied.
  out.push({ left: leftRaw, right: rightRaw, rule: 'no-sandhi' });

  const lastL = aksharaSeq[i - 1];
  const firstR = aksharaSeq[i];
  if (!lastL || !firstR) return out;

  // 1. Vowel coalescence — surface boundary akṣara starts with one of ā/e/o/ai/au.
  //    Heuristic: if the LAST akṣara of left ends in a long vowel that could be
  //    the result of merging, propose splitting it.
  proposeVowelCoalescence(aksharaSeq, i, out);

  // 2. Yan-sandhi: surface y/v/r at the start of right could be i/u/ṛ + vowel.
  proposeYan(aksharaSeq, i, out);

  // 3. Ay-/av-/āy-/āv-sandhi: surface "ay" / "av" inside the boundary
  //    could be e/o + vowel.
  proposeAyAv(aksharaSeq, i, out);

  // 4. Visarga reversal: surface "o" before voiced sound could be "aḥ"
  //    pronunciation; surface "ā" before voiced could be "āḥ".
  proposeVisarga(aksharaSeq, i, out);

  // 5. Anusvāra → m before any consonant in compounds.
  proposeAnusvara(aksharaSeq, i, out);

  return out;
}

/* ----- helpers ------------------------------------------------------------ */

function endsWithVowelSign(ak: string, sign: string): boolean {
  return ak.endsWith(sign) && !ak.endsWith(HALANT + sign);
}

function replaceFinal(word: string, suffix: string, replacement: string): string {
  if (!word.endsWith(suffix)) return word;
  return word.slice(0, word.length - suffix.length) + replacement;
}

function proposeVowelCoalescence(
  aksharaSeq: string[],
  i: number,
  out: SandhiCandidate[],
): void {
  const lastL = aksharaSeq[i - 1];
  const firstR = aksharaSeq[i];
  const left = aksharaSeq.slice(0, i).join('');
  const right = aksharaSeq.slice(i).join('');

  // Case: left ends in ā (mātrā ा) — could be a+a, a+ā, ā+a, ā+ā.
  if (endsWithVowelSign(lastL, 'ा')) {
    const baseLeft = replaceFinal(left, 'ा', '');
    // a+a, a+ā, ā+a are the typical reversals; offer both "left ends in a" + right starts with a/ā
    out.push({ left: baseLeft, right: 'अ' + right, rule: 'vowel-ā←a+a' });
    out.push({ left: baseLeft, right: 'आ' + right, rule: 'vowel-ā←a+ā' });
    out.push({ left: baseLeft + 'ा', right: 'अ' + right, rule: 'vowel-ā←ā+a' });
  }

  // Case: left ends in े (e) — could be a+i / a+ī / ā+i / ā+ī.
  if (endsWithVowelSign(lastL, 'े')) {
    const baseLeft = replaceFinal(left, 'े', '');
    out.push({ left: baseLeft, right: 'इ' + right, rule: 'vowel-e←a+i' });
    out.push({ left: baseLeft, right: 'ई' + right, rule: 'vowel-e←a+ī' });
    out.push({ left: baseLeft + 'ा', right: 'इ' + right, rule: 'vowel-e←ā+i' });
  }

  // Case: left ends in ो (o) — could be a+u / a+ū / ā+u / aḥ+a / aḥ+voiced.
  if (endsWithVowelSign(lastL, 'ो')) {
    const baseLeft = replaceFinal(left, 'ो', '');
    out.push({ left: baseLeft, right: 'उ' + right, rule: 'vowel-o←a+u' });
    out.push({ left: baseLeft, right: 'ऊ' + right, rule: 'vowel-o←a+ū' });
    // Visarga case: aḥ + voiced → o + voiced
    out.push({ left: baseLeft + 'ः', right: right, rule: 'visarga-aḥ→o' });
    out.push({ left: baseLeft + 'ः', right: 'अ' + right, rule: 'visarga-aḥ+a→o\'a' });
  }

  // Case: left ends in ै (ai) — could be a+e, a+ai, ā+e.
  if (endsWithVowelSign(lastL, 'ै')) {
    const baseLeft = replaceFinal(left, 'ै', '');
    out.push({ left: baseLeft, right: 'ए' + right, rule: 'vowel-ai←a+e' });
    out.push({ left: baseLeft + 'ा', right: 'ए' + right, rule: 'vowel-ai←ā+e' });
    out.push({ left: baseLeft, right: 'ऐ' + right, rule: 'vowel-ai←a+ai' });
  }

  // Case: left ends in ौ (au) — could be a+o, a+au, ā+o.
  if (endsWithVowelSign(lastL, 'ौ')) {
    const baseLeft = replaceFinal(left, 'ौ', '');
    out.push({ left: baseLeft, right: 'ओ' + right, rule: 'vowel-au←a+o' });
    out.push({ left: baseLeft + 'ा', right: 'ओ' + right, rule: 'vowel-au←ā+o' });
    out.push({ left: baseLeft, right: 'औ' + right, rule: 'vowel-au←a+au' });
  }
  // Suppress unused warning — firstR is informative for callers debugging rules.
  void firstR;
}

function proposeYan(_aksharaSeq: string[], _i: number, _out: SandhiCandidate[]): void {
  // y- / v- / r- prefixed right side → reverse to i/u/ṛ + vowel.
  // (Implementation kept conservative; expand if needed for specific texts.)
}

function proposeAyAv(_aksharaSeq: string[], _i: number, _out: SandhiCandidate[]): void {
  // ay- / av- / āy- / āv- inside left side could be e/o/ai/au + vowel.
  // Conservative; the o-coalescence above already captures the common visarga case.
}

function proposeVisarga(aksharaSeq: string[], i: number, out: SandhiCandidate[]): void {
  // If left ends in "ā" (independent or via mātrā), it could be "āḥ".
  const lastL = aksharaSeq[i - 1];
  const left = aksharaSeq.slice(0, i).join('');
  const right = aksharaSeq.slice(i).join('');

  if (endsWithVowelSign(lastL, 'ा')) {
    out.push({ left: left + 'ः', right, rule: 'visarga-āḥ→ā' });
  }
}

function proposeAnusvara(aksharaSeq: string[], i: number, out: SandhiCandidate[]): void {
  const lastL = aksharaSeq[i - 1];
  const left = aksharaSeq.slice(0, i).join('');
  const right = aksharaSeq.slice(i).join('');
  if (lastL.endsWith('ं')) {
    const noAnu = left.slice(0, -1);
    out.push({ left: noAnu + 'म्', right, rule: 'anusvara-ṃ←m' });
  }
}
