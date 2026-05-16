/**
 * Seed glossary of ~200 Vedantic terms for the tap-a-word popover.
 *
 * English glosses are compact paraphrases, not translations. Malayalam glosses
 * cover the most frequently encountered terms; where absent, the popover
 * falls back to the English gloss. All entries are original paraphrases.
 */

export interface SeedEntry {
  iast?: string;
  pos?: string;
  en?: string;
  ml?: string;
}

export interface DictionarySource {
  label: string;
  entries: Record<string, SeedEntry>;
}

export const SEED_GLOSSARY: DictionarySource = {
  label: 'Bhashya Parayana seed glossary',
  entries: {
    // Ultimate reality
    ब्रह्म: {
      iast: 'brahma',
      pos: 'n.',
      en: 'the supreme non-dual reality; the absolute',
      ml: 'പരബ്രഹ്മം; അദ്വൈതമായ പരമതത്ത്വം',
    },
    आत्मन्: {
      iast: 'ātman',
      pos: 'm.',
      en: 'the self; the innermost witness-consciousness',
      ml: 'ആത്മാവ്; സാക്ഷിചൈതന്യം',
    },
    आत्मा: { iast: 'ātmā', pos: 'm.', en: 'self (nom. sg.)', ml: 'ആത്മാ' },
    परमात्मन्: { iast: 'paramātman', pos: 'm.', en: 'the highest self', ml: 'പരമാത്മാ' },
    जीव: { iast: 'jīva', pos: 'm.', en: 'the individual self as conditioned by upadhi', ml: 'ജീവൻ' },
    ईश्वर: { iast: 'īśvara', pos: 'm.', en: 'the Lord; Brahman conditioned by maya', ml: 'ഈശ്വരൻ' },
    ईश: { iast: 'īśa', pos: 'm.', en: 'the Lord, ruler', ml: 'ഈശൻ' },
    परमेश्वर: { iast: 'parameśvara', pos: 'm.', en: 'the supreme Lord', ml: 'പരമേശ്വരൻ' },

    // Liberation & bondage
    मोक्ष: { iast: 'mokṣa', pos: 'm.', en: 'liberation; release from samsara', ml: 'മോക്ഷം' },
    मुक्ति: { iast: 'mukti', pos: 'f.', en: 'release, liberation', ml: 'മുക്തി' },
    बन्ध: { iast: 'bandha', pos: 'm.', en: 'bondage', ml: 'ബന്ധം' },
    संसार: { iast: 'saṃsāra', pos: 'm.', en: 'the cycle of birth and death', ml: 'സംസാരം' },
    निर्वाण: { iast: 'nirvāṇa', pos: 'n.', en: 'extinction of suffering; final release' },

    // Knowledge, ignorance
    विद्या: { iast: 'vidyā', pos: 'f.', en: 'knowledge (esp. liberating knowledge)', ml: 'വിദ്യ' },
    अविद्या: { iast: 'avidyā', pos: 'f.', en: 'ignorance; the root of samsara', ml: 'അവിദ്യ' },
    ज्ञान: { iast: 'jñāna', pos: 'n.', en: 'knowledge', ml: 'ജ്ഞാനം' },
    अज्ञान: { iast: 'ajñāna', pos: 'n.', en: 'ignorance', ml: 'അജ്ഞാനം' },
    विवेक: { iast: 'viveka', pos: 'm.', en: 'discrimination (between real and unreal)', ml: 'വിവേകം' },
    वैराग्य: { iast: 'vairāgya', pos: 'n.', en: 'dispassion; non-attachment', ml: 'വൈരാഗ്യം' },
    मुमुक्षु: { iast: 'mumukṣu', pos: 'm.', en: 'one who desires liberation', ml: 'മുമുക്ഷു' },
    साधक: { iast: 'sādhaka', pos: 'm.', en: 'spiritual aspirant', ml: 'സാധകൻ' },

    // States and upadhis
    जाग्रत्: { iast: 'jāgrat', pos: 'n.', en: 'the waking state', ml: 'ജാഗ്രത്' },
    स्वप्न: { iast: 'svapna', pos: 'm.', en: 'the dream state', ml: 'സ്വപ്നം' },
    सुषुप्ति: { iast: 'suṣupti', pos: 'f.', en: 'the deep-sleep state', ml: 'സുഷുപ്തി' },
    तुरीय: { iast: 'turīya', pos: 'n.', en: 'the "fourth" — pure consciousness beyond the three states', ml: 'തുരീയം' },
    ओङ्कार: { iast: 'oṃkāra', pos: 'm.', en: 'the syllable Om', ml: 'ഓംകാരം' },
    प्रणव: { iast: 'praṇava', pos: 'm.', en: 'the syllable Om', ml: 'പ്രണവം' },

    // Reality levels
    सत्: { iast: 'sat', pos: 'n.', en: 'being, existence; the real', ml: 'സത്' },
    असत्: { iast: 'asat', pos: 'n.', en: 'non-being; the unreal' },
    चित्: { iast: 'cit', pos: 'n.', en: 'consciousness', ml: 'ചിത്' },
    आनन्द: { iast: 'ānanda', pos: 'm.', en: 'bliss', ml: 'ആനന്ദം' },
    सच्चिदानन्द: { iast: 'saccidānanda', pos: 'm.', en: 'being-consciousness-bliss', ml: 'സച്ചിദാനന്ദം' },
    सत्य: { iast: 'satya', pos: 'n.', en: 'truth; the real', ml: 'സത്യം' },
    मिथ्या: { iast: 'mithyā', pos: 'adv.', en: 'false; neither real nor unreal', ml: 'മിഥ്യ' },
    पारमार्थिक: { iast: 'pāramārthika', pos: 'adj.', en: 'pertaining to the absolute reality' },
    व्यावहारिक: { iast: 'vyāvahārika', pos: 'adj.', en: 'empirical; transactional reality' },
    प्रातिभासिक: { iast: 'prātibhāsika', pos: 'adj.', en: 'apparent; dream-level reality' },

    // Key concepts
    माया: { iast: 'māyā', pos: 'f.', en: 'the inscrutable power of appearance', ml: 'മായ' },
    अध्यास: { iast: 'adhyāsa', pos: 'm.', en: 'superimposition of one thing on another', ml: 'അധ്യാസം' },
    उपाधि: { iast: 'upādhi', pos: 'm.', en: 'limiting adjunct', ml: 'ഉപാധി' },
    अध्यारोप: { iast: 'adhyāropa', pos: 'm.', en: 'imposition; provisional ascription' },
    अपवाद: { iast: 'apavāda', pos: 'm.', en: 'de-superimposition; rescission' },
    तादात्म्य: { iast: 'tādātmya', pos: 'n.', en: 'identity; "thatness" with the thing' },
    साक्षिन्: { iast: 'sākṣin', pos: 'm.', en: 'the witness-consciousness', ml: 'സാക്ഷി' },
    प्रत्यगात्मन्: { iast: 'pratyagātman', pos: 'm.', en: 'the inner self', ml: 'പ്രത്യഗാത്മാ' },
    कूटस्थ: { iast: 'kūṭastha', pos: 'adj./m.', en: 'the immutable; the unchanging witness' },
    अद्वैत: { iast: 'advaita', pos: 'n.', en: 'non-duality', ml: 'അദ്വൈതം' },
    द्वैत: { iast: 'dvaita', pos: 'n.', en: 'duality', ml: 'ദ്വൈതം' },

    // Guna, karma
    गुण: { iast: 'guṇa', pos: 'm.', en: 'quality; one of sattva, rajas, tamas', ml: 'ഗുണം' },
    सत्त्व: { iast: 'sattva', pos: 'n.', en: 'the quality of light and clarity' },
    रजस्: { iast: 'rajas', pos: 'n.', en: 'the quality of activity and passion' },
    तमस्: { iast: 'tamas', pos: 'n.', en: 'the quality of inertia and darkness' },
    कर्म: { iast: 'karma', pos: 'n.', en: 'action; ritual act; result of action', ml: 'കർമ്മം' },
    कर्मन्: { iast: 'karman', pos: 'n.', en: 'action, deed', ml: 'കർമ്മം' },
    कर्मयोग: { iast: 'karmayoga', pos: 'm.', en: 'the discipline of action' },
    भक्ति: { iast: 'bhakti', pos: 'f.', en: 'devotion', ml: 'ഭക്തി' },
    योग: { iast: 'yoga', pos: 'm.', en: 'union; discipline', ml: 'യോഗം' },
    ध्यान: { iast: 'dhyāna', pos: 'n.', en: 'meditation', ml: 'ധ്യാനം' },
    समाधि: { iast: 'samādhi', pos: 'm.', en: 'absorptive concentration', ml: 'സമാധി' },

    // People and texts
    गुरु: { iast: 'guru', pos: 'm.', en: 'teacher', ml: 'ഗുരു' },
    शिष्य: { iast: 'śiṣya', pos: 'm.', en: 'student, disciple', ml: 'ശിഷ്യൻ' },
    आचार्य: { iast: 'ācārya', pos: 'm.', en: 'preceptor', ml: 'ആചാര്യൻ' },
    ऋषि: { iast: 'ṛṣi', pos: 'm.', en: 'seer, sage', ml: 'ഋഷി' },
    मुनि: { iast: 'muni', pos: 'm.', en: 'sage; silent one', ml: 'മുനി' },
    श्रुति: { iast: 'śruti', pos: 'f.', en: 'that which is heard; the Veda', ml: 'ശ്രുതി' },
    स्मृति: { iast: 'smṛti', pos: 'f.', en: 'that which is remembered; tradition', ml: 'സ്മൃതി' },
    वेद: { iast: 'veda', pos: 'm.', en: 'the Veda', ml: 'വേദം' },
    वेदान्त: { iast: 'vedānta', pos: 'm.', en: 'the culmination of the Veda; Upanishadic teaching', ml: 'വേദാന്തം' },
    उपनिषद्: { iast: 'upaniṣad', pos: 'f.', en: 'secret teaching that destroys ignorance', ml: 'ഉപനിഷത്ത്' },
    भाष्य: { iast: 'bhāṣya', pos: 'n.', en: 'commentary', ml: 'ഭാഷ്യം' },
    सूत्र: { iast: 'sūtra', pos: 'n.', en: 'aphoristic statement', ml: 'സൂത്രം' },
    मन्त्र: { iast: 'mantra', pos: 'm.', en: 'Vedic formula; sacred utterance', ml: 'മന്ത്രം' },
    श्लोक: { iast: 'śloka', pos: 'm.', en: 'verse', ml: 'ശ്ലോകം' },
    वाक्य: { iast: 'vākya', pos: 'n.', en: 'sentence; statement', ml: 'വാക്യം' },

    // Logic & exegesis
    अधिकरण: { iast: 'adhikaraṇa', pos: 'n.', en: 'topic-section (in BSB, a discussion unit)' },
    अधिकारी: { iast: 'adhikārī', pos: 'm.', en: 'qualified student' },
    प्रयोजन: { iast: 'prayojana', pos: 'n.', en: 'purpose, motive' },
    विषय: { iast: 'viṣaya', pos: 'm.', en: 'subject-matter; sense-object' },
    संशय: { iast: 'saṃśaya', pos: 'm.', en: 'doubt' },
    सिद्धान्त: { iast: 'siddhānta', pos: 'm.', en: 'the settled conclusion' },
    पूर्वपक्ष: { iast: 'pūrvapakṣa', pos: 'm.', en: 'the prima facie / objector view' },
    उपपत्ति: { iast: 'upapatti', pos: 'f.', en: 'reasoned establishment; cogency' },
    हेतु: { iast: 'hetu', pos: 'm.', en: 'reason, cause' },
    दृष्टान्त: { iast: 'dṛṣṭānta', pos: 'm.', en: 'illustrative example' },
    अनुमान: { iast: 'anumāna', pos: 'n.', en: 'inference' },
    प्रत्यक्ष: { iast: 'pratyakṣa', pos: 'n.', en: 'direct perception' },
    प्रमाण: { iast: 'pramāṇa', pos: 'n.', en: 'means of valid cognition', ml: 'പ്രമാണം' },
    शब्द: { iast: 'śabda', pos: 'm.', en: 'word; verbal testimony', ml: 'ശബ്ദം' },
    अर्थ: { iast: 'artha', pos: 'm.', en: 'meaning; purpose; wealth', ml: 'അർത്ഥം' },

    // Common verbs & particles (only those frequently encountered)
    उच्यते: { iast: 'ucyate', pos: 'vi.', en: '(it) is said' },
    उक्त: { iast: 'ukta', pos: 'pp.', en: 'said, stated' },
    इत्युक्तम्: { iast: 'ity uktam', pos: 'phr.', en: '(thus) it has been said' },
    तस्मात्: { iast: 'tasmāt', pos: 'adv.', en: 'therefore; from that' },
    यस्मात्: { iast: 'yasmāt', pos: 'adv.', en: 'because; from which' },
    हि: { iast: 'hi', pos: 'pcl.', en: 'for; indeed' },
    तु: { iast: 'tu', pos: 'pcl.', en: 'but; on the other hand' },
    च: { iast: 'ca', pos: 'pcl.', en: 'and' },
    वा: { iast: 'vā', pos: 'pcl.', en: 'or' },
    एव: { iast: 'eva', pos: 'pcl.', en: 'only; verily' },
    अपि: { iast: 'api', pos: 'pcl.', en: 'also; even' },
    इति: { iast: 'iti', pos: 'pcl.', en: 'thus (closing quotation)' },
    किम्: { iast: 'kim', pos: 'pron.', en: 'what?' },

    // Elements & cosmology
    आकाश: { iast: 'ākāśa', pos: 'm.', en: 'space; ether', ml: 'ആകാശം' },
    वायु: { iast: 'vāyu', pos: 'm.', en: 'air; the wind', ml: 'വായു' },
    अग्नि: { iast: 'agni', pos: 'm.', en: 'fire', ml: 'അഗ്നി' },
    जल: { iast: 'jala', pos: 'n.', en: 'water', ml: 'ജലം' },
    पृथिवी: { iast: 'pṛthivī', pos: 'f.', en: 'earth', ml: 'പൃഥ്വി' },
    भूत: { iast: 'bhūta', pos: 'n.', en: 'element; being', ml: 'ഭൂതം' },
    महाभूत: { iast: 'mahābhūta', pos: 'n.', en: 'gross element' },
    तन्मात्र: { iast: 'tanmātra', pos: 'n.', en: 'subtle element' },
    प्राण: { iast: 'prāṇa', pos: 'm.', en: 'vital breath; life-force', ml: 'പ്രാണൻ' },
    इन्द्रिय: { iast: 'indriya', pos: 'n.', en: 'sense-organ; faculty', ml: 'ഇന്ദ്രിയം' },
    मनस्: { iast: 'manas', pos: 'n.', en: 'mind', ml: 'മനസ്സ്' },
    बुद्धि: { iast: 'buddhi', pos: 'f.', en: 'intellect', ml: 'ബുദ്ധി' },
    अहङ्कार: { iast: 'ahaṅkāra', pos: 'm.', en: 'I-sense; ego', ml: 'അഹംകാരം' },
    अन्तःकरण: { iast: 'antaḥkaraṇa', pos: 'n.', en: 'the inner instrument (mind-intellect-ego)' },
    चित्त: { iast: 'citta', pos: 'n.', en: 'mind-stuff; memory', ml: 'ചിത്തം' },

    // Bodies, sheaths
    शरीर: { iast: 'śarīra', pos: 'n.', en: 'body', ml: 'ശരീരം' },
    देह: { iast: 'deha', pos: 'm.', en: 'body', ml: 'ദേഹം' },
    स्थूल: { iast: 'sthūla', pos: 'adj.', en: 'gross (body)' },
    सूक्ष्म: { iast: 'sūkṣma', pos: 'adj.', en: 'subtle', ml: 'സൂക്ഷ്മം' },
    कारण: { iast: 'kāraṇa', pos: 'n.', en: 'cause; causal (body)', ml: 'കാരണം' },
    कोश: { iast: 'kośa', pos: 'm.', en: 'sheath', ml: 'കോശം' },
    अन्नमय: { iast: 'annamaya', pos: 'adj.', en: 'made of food' },
    प्राणमय: { iast: 'prāṇamaya', pos: 'adj.', en: 'made of prana' },
    मनोमय: { iast: 'manomaya', pos: 'adj.', en: 'made of mind' },
    विज्ञानमय: { iast: 'vijñānamaya', pos: 'adj.', en: 'made of discernment' },
    आनन्दमय: { iast: 'ānandamaya', pos: 'adj.', en: 'made of bliss' },

    // Misc high-frequency
    सर्व: { iast: 'sarva', pos: 'adj./pron.', en: 'all; every', ml: 'സർവം' },
    सर्वम्: { iast: 'sarvam', pos: 'n.', en: 'everything', ml: 'എല്ലാം' },
    एक: { iast: 'eka', pos: 'adj.', en: 'one; alone', ml: 'ഒന്ന്' },
    एकत्व: { iast: 'ekatva', pos: 'n.', en: 'oneness' },
    अनेक: { iast: 'aneka', pos: 'adj.', en: 'many; not-one' },
    नित्य: { iast: 'nitya', pos: 'adj.', en: 'eternal', ml: 'നിത്യം' },
    अनित्य: { iast: 'anitya', pos: 'adj.', en: 'non-eternal', ml: 'അനിത്യം' },
    शुद्ध: { iast: 'śuddha', pos: 'adj.', en: 'pure', ml: 'ശുദ്ധം' },
    अशुद्ध: { iast: 'aśuddha', pos: 'adj.', en: 'impure' },
    स्वरूप: { iast: 'svarūpa', pos: 'n.', en: 'own essential form; true nature', ml: 'സ്വരൂപം' },
    रूप: { iast: 'rūpa', pos: 'n.', en: 'form', ml: 'രൂപം' },
    नाम: { iast: 'nāma', pos: 'n.', en: 'name', ml: 'നാമം' },
    नामरूप: { iast: 'nāmarūpa', pos: 'n.', en: 'name-and-form' },
    देव: { iast: 'deva', pos: 'm.', en: 'deity; shining one', ml: 'ദേവൻ' },
    देवता: { iast: 'devatā', pos: 'f.', en: 'deity', ml: 'ദേവത' },
    पुरुष: { iast: 'puruṣa', pos: 'm.', en: 'the conscious principle; person', ml: 'പുരുഷൻ' },
    प्रकृति: { iast: 'prakṛti', pos: 'f.', en: 'primal nature; material cause', ml: 'പ്രകൃതി' },
    लोक: { iast: 'loka', pos: 'm.', en: 'world; realm', ml: 'ലോകം' },
    जगत्: { iast: 'jagat', pos: 'n.', en: 'the world; the moving', ml: 'ജഗത്ത്' },
    विश्व: { iast: 'viśva', pos: 'adj./m.', en: 'all; the universe; waker', ml: 'വിശ്വം' },
    तेजस्: { iast: 'tejas', pos: 'n.', en: 'brilliance; the dreamer', ml: 'തേജസ്' },
    प्राज्ञ: { iast: 'prājña', pos: 'adj./m.', en: 'the wise; the deep-sleeper' },

    // Kriyas
    उपासना: { iast: 'upāsanā', pos: 'f.', en: 'meditative worship' },
    श्रवण: { iast: 'śravaṇa', pos: 'n.', en: 'listening (to teaching)', ml: 'ശ്രവണം' },
    मनन: { iast: 'manana', pos: 'n.', en: 'reflection', ml: 'മനനം' },
    निदिध्यासन: { iast: 'nididhyāsana', pos: 'n.', en: 'sustained contemplation' },
    जप: { iast: 'japa', pos: 'm.', en: 'repetition of a mantra', ml: 'ജപം' },
    यज्ञ: { iast: 'yajña', pos: 'm.', en: 'ritual; sacrifice', ml: 'യജ്ഞം' },
    तपस्: { iast: 'tapas', pos: 'n.', en: 'austerity', ml: 'തപസ്സ്' },
    दान: { iast: 'dāna', pos: 'n.', en: 'giving; charity', ml: 'ദാനം' },
    शम: { iast: 'śama', pos: 'm.', en: 'control of the mind' },
    दम: { iast: 'dama', pos: 'm.', en: 'control of the senses' },
    तितिक्षा: { iast: 'titikṣā', pos: 'f.', en: 'forbearance' },
    श्रद्धा: { iast: 'śraddhā', pos: 'f.', en: 'trust; faith', ml: 'ശ്രദ്ധ' },
    उपरति: { iast: 'uparati', pos: 'f.', en: 'withdrawal from external activity' },
    समाधान: { iast: 'samādhāna', pos: 'n.', en: 'one-pointedness of mind' },
    साधनचतुष्टय: { iast: 'sādhanacatuṣṭaya', pos: 'n.', en: 'the fourfold qualification' },

    // Mahavakyas
    तत्त्वमसि: { iast: 'tat tvam asi', pos: 'phr.', en: '"That thou art" — Chandogya 6.8.7' },
    अहंब्रह्मास्मि: { iast: 'ahaṃ brahmāsmi', pos: 'phr.', en: '"I am Brahman" — Brihadaranyaka 1.4.10' },
    प्रज्ञानंब्रह्म: { iast: 'prajñānaṃ brahma', pos: 'phr.', en: '"Consciousness is Brahman" — Aitareya 3.1.3' },
    अयमात्माब्रह्म: { iast: 'ayam ātmā brahma', pos: 'phr.', en: '"This self is Brahman" — Mandukya 2' },
  },
};
