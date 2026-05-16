//! WASM bindings over Vidyut for the bhāṣya-pārāyaṇa app.
//!
//! Three exported operations matching `src/lib/panini/types.ts`:
//!
//! * `inflect(lemma_devanagari, morph_json)` — forward Pāṇinian
//!   derivation through `vidyut-prakriya`. Returns every valid
//!   surface form for the given lemma + morphology, with a sūtra
//!   trace per derivation. Real and authoritative.
//! * `verify(surface, lemma, morph_json)` — re-derives `lemma` with
//!   the proposed `morph` and reports whether `surface` falls out.
//!   The analyser uses this to validate heuristic guesses against
//!   Pāṇinian rules — Vidyut serves as the oracle.
//! * `analyze(word)` — placeholder. True reverse analysis needs
//!   `vidyut-cheda` (lexicon-backed segmenter), which isn't WASM-
//!   ready upstream. Returns an empty array; the heuristic chain
//!   in `src/lib/analysis.ts` runs unchanged when this is empty.
//!
//! See `docs/paninian-engine-plan.md` §3.1 (engine survey) and §4
//! (analyser-chain integration).

use serde::{Deserialize, Serialize};
use vidyut_prakriya::args::{
    BaseKrt, Dhatu, Gana, Krdanta, Krt, Lakara, Linga, Pratipadika,
    Prayoga, Purusha, Subanta, Tinanta, Vacana, Vibhakti,
};
use vidyut_prakriya::Vyakarana;
use wasm_bindgen::prelude::*;

#[derive(Serialize, Deserialize, Clone)]
struct Morph {
    #[serde(default)]
    lakara: Option<String>,
    #[serde(default)]
    purusha: Option<u8>,
    #[serde(default)]
    vacana: Option<String>,
    #[serde(default)]
    pada: Option<String>,
    #[serde(default)]
    vibhakti: Option<u8>,
    #[serde(default)]
    linga: Option<String>,
    #[serde(default)]
    pratyaya: Option<String>,
    /// `gana` is needed when generating verb forms — the lemma alone
    /// doesn't disambiguate which class the dhātu belongs to. Default
    /// to bhvAdi (1) which covers the majority of common roots.
    #[serde(default)]
    gana: Option<u8>,
}

#[derive(Serialize, Deserialize, Clone)]
struct DerivationStep {
    /// Source kind (Ashtadhyayi / Varttika / Dhatupatha / …).
    source: String,
    /// Sūtra identifier within that source, e.g. "3.1.68".
    code: String,
    /// Surface form after the rule fired.
    result: String,
}

#[derive(Serialize, Deserialize, Clone)]
struct Derivation {
    text: String,
    steps: Vec<DerivationStep>,
}

#[wasm_bindgen(js_name = paniniName)]
pub fn name() -> String {
    "vidyut-prakriya-wasm".to_string()
}

#[wasm_bindgen(js_name = paniniVersion)]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[wasm_bindgen(js_name = paniniAvailable)]
pub fn available() -> bool {
    true
}

#[wasm_bindgen(start)]
pub fn _on_load() {
    #[cfg(feature = "debug")]
    console_error_panic_hook::set_once();
}

/// Convert a script string between Devanāgarī, IAST, and SLP1 via
/// vidyut-lipi. Accepted scheme strings: "devanagari", "iast",
/// "slp1", "harvard-kyoto", "wx", "itrans". Anything else returns
/// the input unchanged.
#[wasm_bindgen(js_name = paniniTransliterate)]
pub fn transliterate(text: &str, from: &str, to: &str) -> String {
    use vidyut_lipi::{Lipika, Scheme};
    let from_s = match scheme(from) {
        Some(s) => s,
        None => return text.to_string(),
    };
    let to_s = match scheme(to) {
        Some(s) => s,
        None => return text.to_string(),
    };
    let mut lipika = Lipika::new();
    let _ = (from_s, to_s);
    lipika.transliterate(text, from_s, to_s)
}

fn scheme(name: &str) -> Option<vidyut_lipi::Scheme> {
    use vidyut_lipi::Scheme;
    match name.to_ascii_lowercase().as_str() {
        "devanagari" | "deva" => Some(Scheme::Devanagari),
        "iast" => Some(Scheme::Iast),
        "slp1" => Some(Scheme::Slp1),
        "harvard-kyoto" | "hk" => Some(Scheme::HarvardKyoto),
        "wx" => Some(Scheme::Wx),
        "itrans" => Some(Scheme::Itrans),
        _ => None,
    }
}

/// Forward inflection. Given a lemma (in Devanāgarī) and a
/// morphology spec, returns every surface form Vidyut can derive,
/// with the sūtra trace per derivation.
#[wasm_bindgen(js_name = paniniInflect)]
pub fn inflect(lemma_dev: &str, morph_json: &str) -> Result<JsValue, JsValue> {
    let morph: Morph = serde_json::from_str(morph_json)
        .map_err(|e| JsValue::from_str(&format!("morph parse: {e}")))?;
    let lemma_slp1 = devanagari_to_slp1(lemma_dev);

    let derivations = if morph.lakara.is_some() {
        derive_tinanta(&lemma_slp1, &morph)
    } else if morph.vibhakti.is_some() || morph.linga.is_some() {
        derive_subanta(&lemma_slp1, &morph)
    } else if morph.pratyaya.is_some() {
        derive_krdanta(&lemma_slp1, &morph)
    } else {
        Vec::new()
    };

    let result: Vec<Derivation> = derivations
        .into_iter()
        .map(|(text, steps)| Derivation {
            text: slp1_to_devanagari(&text),
            steps,
        })
        .collect();
    serde_wasm_bindgen::to_value(&result).map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Verify a heuristic guess against Pāṇinian rules. Returns
/// `{ matched: bool, surface?: string, sutras: string[] }`.
#[wasm_bindgen(js_name = paniniVerify)]
pub fn verify(surface_dev: &str, lemma_dev: &str, morph_json: &str) -> Result<JsValue, JsValue> {
    let morph: Morph = serde_json::from_str(morph_json)
        .map_err(|e| JsValue::from_str(&format!("morph parse: {e}")))?;
    let lemma_slp1 = devanagari_to_slp1(lemma_dev);
    let surface_slp1 = devanagari_to_slp1(surface_dev);

    let derivations = if morph.lakara.is_some() {
        derive_tinanta(&lemma_slp1, &morph)
    } else if morph.vibhakti.is_some() || morph.linga.is_some() {
        derive_subanta(&lemma_slp1, &morph)
    } else if morph.pratyaya.is_some() {
        derive_krdanta(&lemma_slp1, &morph)
    } else {
        Vec::new()
    };

    let mut hit_text: Option<String> = None;
    let mut hit_steps: Option<Vec<DerivationStep>> = None;
    for (text, steps) in derivations {
        if text == surface_slp1 {
            hit_text = Some(slp1_to_devanagari(&text));
            hit_steps = Some(steps);
            break;
        }
    }

    #[derive(Serialize)]
    struct Verification {
        matched: bool,
        surface: Option<String>,
        sutras: Vec<String>,
    }
    let v = Verification {
        matched: hit_text.is_some(),
        surface: hit_text,
        sutras: hit_steps
            .map(|steps| steps.into_iter().map(|s| s.code).collect())
            .unwrap_or_default(),
    };
    serde_wasm_bindgen::to_value(&v).map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Reverse analysis is delegated to the JS-side heuristic chain
/// until vidyut-cheda has a WASM-compatible loader (the upstream
/// `Chedaka::new(&Path)` pulls `std::fs`, blocking WASM build).
#[wasm_bindgen(js_name = paniniAnalyze)]
pub fn analyze(_word: &str) -> Result<JsValue, JsValue> {
    let empty: Vec<()> = Vec::new();
    serde_wasm_bindgen::to_value(&empty).map_err(|e| JsValue::from_str(&e.to_string()))
}

#[wasm_bindgen(js_name = paniniSegment)]
pub fn segment(_utterance: &str) -> Result<JsValue, JsValue> {
    let empty: Vec<Vec<String>> = Vec::new();
    serde_wasm_bindgen::to_value(&empty).map_err(|e| JsValue::from_str(&e.to_string()))
}

/* ----- internal: vidyut-prakriya argument plumbing ----- */

fn devanagari_to_slp1(s: &str) -> String {
    use vidyut_lipi::{Lipika, Scheme};
    let mut l = Lipika::new();
    l.transliterate(s, Scheme::Devanagari, Scheme::Slp1)
}

fn slp1_to_devanagari(s: &str) -> String {
    use vidyut_lipi::{Lipika, Scheme};
    let mut l = Lipika::new();
    l.transliterate(s, Scheme::Slp1, Scheme::Devanagari)
}

fn collect_prakriyas(
    pks: Vec<vidyut_prakriya::Prakriya>,
) -> Vec<(String, Vec<DerivationStep>)> {
    pks.into_iter()
        .map(|pk| {
            let text = pk.text();
            let steps: Vec<DerivationStep> = pk
                .history()
                .iter()
                .map(|step| {
                    let rule = step.rule();
                    let result = step
                        .result()
                        .iter()
                        .map(|t| t.text())
                        .collect::<Vec<_>>()
                        .join("");
                    DerivationStep {
                        source: rule_source(&rule).to_string(),
                        code: rule.code().to_string(),
                        result,
                    }
                })
                .collect();
            (text, steps)
        })
        .collect()
}

fn rule_source(r: &vidyut_prakriya::Rule) -> &'static str {
    use vidyut_prakriya::Rule;
    match r {
        Rule::Ashtadhyayi(_) => "Ashtadhyayi",
        Rule::Varttika(_) => "Varttika",
        Rule::Dhatupatha(_) => "Dhatupatha",
        Rule::Unadipatha(_) => "Unadipatha",
        Rule::Linganushasana(_) => "Linganushasana",
        Rule::Phit(_) => "Phit",
        Rule::Kashika(_) => "Kashika",
        Rule::Kaumudi(_) => "Kaumudi",
    }
}

fn parse_lakara(s: &str) -> Option<Lakara> {
    Some(match s {
        "lat" | "la-T" => Lakara::Lat,
        "lit" | "li-T" => Lakara::Lit,
        "lut" | "lu-T" => Lakara::Lut,
        "lrt" | "lṛ-T" | "lr-T" => Lakara::Lrt,
        "let" | "leT" => Lakara::Let,
        "lot" | "loT" => Lakara::Lot,
        "lan" | "laN" => Lakara::Lan,
        "lin" | "liN" | "vidhi-lin" => Lakara::VidhiLin,
        "ashir-lin" | "Ashir-liN" => Lakara::AshirLin,
        "lun" | "luN" => Lakara::Lun,
        "lrn" | "lṛN" | "lr-N" => Lakara::Lrn,
        _ => return None,
    })
}

fn parse_purusha(p: u8) -> Option<Purusha> {
    Some(match p {
        1 => Purusha::Uttama,
        2 => Purusha::Madhyama,
        3 => Purusha::Prathama,
        _ => return None,
    })
}

fn parse_vacana(s: &str) -> Option<Vacana> {
    Some(match s {
        "eka" => Vacana::Eka,
        "dvi" => Vacana::Dvi,
        "bahu" => Vacana::Bahu,
        _ => return None,
    })
}

fn parse_vibhakti(v: u8) -> Option<Vibhakti> {
    Some(match v {
        1 => Vibhakti::Prathama,
        2 => Vibhakti::Dvitiya,
        3 => Vibhakti::Trtiya,
        4 => Vibhakti::Caturthi,
        5 => Vibhakti::Panchami,
        6 => Vibhakti::Sasthi,
        7 => Vibhakti::Saptami,
        8 => Vibhakti::Sambodhana,
        _ => return None,
    })
}

fn parse_linga(s: &str) -> Option<Linga> {
    Some(match s.to_ascii_lowercase().as_str() {
        "m" => Linga::Pum,
        "f" => Linga::Stri,
        "n" => Linga::Napumsaka,
        _ => return None,
    })
}

fn parse_gana(g: u8) -> Option<Gana> {
    Some(match g {
        1 => Gana::Bhvadi,
        2 => Gana::Adadi,
        3 => Gana::Juhotyadi,
        4 => Gana::Divadi,
        5 => Gana::Svadi,
        6 => Gana::Tudadi,
        7 => Gana::Rudhadi,
        8 => Gana::Tanadi,
        9 => Gana::Kryadi,
        10 => Gana::Curadi,
        _ => return None,
    })
}

fn derive_tinanta(lemma_slp1: &str, m: &Morph) -> Vec<(String, Vec<DerivationStep>)> {
    let lakara = match m.lakara.as_deref().and_then(parse_lakara) {
        Some(l) => l,
        None => return Vec::new(),
    };
    let purusha = match m.purusha.and_then(parse_purusha) {
        Some(p) => p,
        None => return Vec::new(),
    };
    let vacana = match m.vacana.as_deref().and_then(parse_vacana) {
        Some(v) => v,
        None => return Vec::new(),
    };
    let gana = m.gana.and_then(parse_gana).unwrap_or(Gana::Bhvadi);
    let dhatu = match Dhatu::builder()
        .aupadeshika(lemma_slp1)
        .gana(gana)
        .build()
    {
        Ok(d) => d,
        Err(_) => return Vec::new(),
    };
    let tin = Tinanta::new(dhatu, Prayoga::Kartari, lakara, purusha, vacana);
    let v = Vyakarana::new();
    collect_prakriyas(v.derive_tinantas(&tin))
}

fn derive_subanta(lemma_slp1: &str, m: &Morph) -> Vec<(String, Vec<DerivationStep>)> {
    let linga = m.linga.as_deref().and_then(parse_linga).unwrap_or(Linga::Pum);
    let vibhakti = match m.vibhakti.and_then(parse_vibhakti) {
        Some(v) => v,
        None => return Vec::new(),
    };
    let vacana = m
        .vacana
        .as_deref()
        .and_then(parse_vacana)
        .unwrap_or(Vacana::Eka);

    let slp = match lemma_slp1.try_into() {
        Ok(s) => s,
        Err(_) => return Vec::new(),
    };
    let prati = Pratipadika::basic(slp);
    let sub = Subanta::new(prati, linga, vibhakti, vacana);
    let v = Vyakarana::new();
    collect_prakriyas(v.derive_subantas(&sub))
}

fn derive_krdanta(lemma_slp1: &str, m: &Morph) -> Vec<(String, Vec<DerivationStep>)> {
    let pratyaya = match m.pratyaya.as_deref() {
        Some(p) => p,
        None => return Vec::new(),
    };
    let krt = match parse_krt(pratyaya) {
        Some(k) => k,
        None => return Vec::new(),
    };
    let gana = m.gana.and_then(parse_gana).unwrap_or(Gana::Bhvadi);
    let dhatu = match Dhatu::builder()
        .aupadeshika(lemma_slp1)
        .gana(gana)
        .build()
    {
        Ok(d) => d,
        Err(_) => return Vec::new(),
    };
    let krd = Krdanta::new(dhatu, krt);
    let v = Vyakarana::new();
    collect_prakriyas(v.derive_krdantas(&krd))
}

fn parse_krt(s: &str) -> Option<Krt> {
    let base: BaseKrt = match s {
        "kta" => BaseKrt::kta,
        "ktavatu" => BaseKrt::ktavatu,
        "ktva" | "ktvA" => BaseKrt::ktvA,
        "tumun" => BaseKrt::tumun,
        "shatr" | "Satf" => BaseKrt::Satf,
        "shanac" | "SAnac" => BaseKrt::SAnac,
        "lyut" | "lyuw" => BaseKrt::lyuw,
        "ghan" | "Ga" => BaseKrt::Ga,
        _ => return None,
    };
    Some(Krt::Base(base))
}
