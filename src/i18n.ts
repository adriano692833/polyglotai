export type UiLang = 'pl' | 'en' | 'de' | 'es' | 'fr' | 'it';

// ── UI string translations ───────────────────────────────────────────────────
const S = {
  // Nav
  home:        { pl:'Start',        en:'Home',        de:'Start',           es:'Inicio',      fr:'Accueil',    it:'Inizio'     },
  translate:   { pl:'Tłumacz',      en:'Translate',   de:'Übersetzen',      es:'Traducir',    fr:'Traduire',   it:'Traduci'    },
  write:       { pl:'Pisanie',      en:'Writing',     de:'Schreiben',       es:'Escritura',   fr:'Écriture',   it:'Scrittura'  },
  flashcards:  { pl:'Fiszki',       en:'Flashcards',  de:'Karteikarten',    es:'Tarjetas',    fr:'Fiches',     it:'Schede'     },
  vocab:       { pl:'Słówka',       en:'Vocabulary',  de:'Vokabular',       es:'Vocabulario', fr:'Vocabulaire',it:'Vocabolario'},
  youtube:     { pl:'YouTube',      en:'YouTube',     de:'YouTube',         es:'YouTube',     fr:'YouTube',    it:'YouTube'    },
  reading:     { pl:'Czytanie',     en:'Reading',     de:'Lesen',           es:'Lectura',     fr:'Lecture',    it:'Lettura'    },
  challenge:   { pl:'Wyzwanie',     en:'Challenge',   de:'Herausforderung', es:'Reto',        fr:'Défi',       it:'Sfida'      },
  sentences:   { pl:'Zdania',       en:'Sentences',   de:'Sätze',           es:'Frases',      fr:'Phrases',    it:'Frasi'      },
  dashboard:   { pl:'Dashboard',    en:'Dashboard',   de:'Dashboard',       es:'Panel',       fr:'Tableau',    it:'Pannello'   },
  settings:    { pl:'Ustawienia',   en:'Settings',    de:'Einstellungen',   es:'Ajustes',     fr:'Paramètres', it:'Impostazioni'},
  // Settings modal
  settingsTitle:    { pl:'Ustawienia',                  en:'Settings',                    de:'Einstellungen',             es:'Ajustes',                  fr:'Paramètres',             it:'Impostazioni'             },
  nativeLangLabel:  { pl:'Mój język ojczysty',          en:'My native language',          de:'Meine Muttersprache',       es:'Mi idioma nativo',         fr:'Ma langue maternelle',   it:'La mia lingua madre'      },
  nativeLangHint:   { pl:'Tłumaczenia są wyświetlane w tym języku', en:'Translations will appear in this language', de:'Übersetzungen werden in dieser Sprache angezeigt', es:'Las traducciones se mostrarán en este idioma', fr:'Les traductions apparaîtront dans cette langue', it:'Le traduzioni saranno in questa lingua' },
  uiLangLabel:      { pl:'Język interfejsu',            en:'Interface language',          de:'Oberflächensprache',        es:'Idioma de la interfaz',    fr:'Langue de l\'interface', it:'Lingua dell\'interfaccia' },
  learnLangLabel:   { pl:'Uczę się języka',             en:'I\'m learning',               de:'Ich lerne',                 es:'Estoy aprendiendo',        fr:'J\'apprends',            it:'Sto imparando'            },
  save:             { pl:'Zapisz',                      en:'Save',                        de:'Speichern',                 es:'Guardar',                  fr:'Enregistrer',            it:'Salva'                    },
  cancel:           { pl:'Anuluj',                      en:'Cancel',                      de:'Abbrechen',                 es:'Cancelar',                 fr:'Annuler',                it:'Annulla'                  },
  close:            { pl:'Zamknij',                     en:'Close',                       de:'Schließen',                 es:'Cerrar',                   fr:'Fermer',                 it:'Chiudi'                   },
  // Common labels
  loading:       { pl:'Ładuję...',    en:'Loading...',    de:'Laden...',      es:'Cargando...',    fr:'Chargement...', it:'Caricamento...' },
  saveToVocab:   { pl:'+ Słówka',     en:'+ Vocab',       de:'+ Vokabel',     es:'+ Vocab',        fr:'+ Vocab',       it:'+ Vocab'        },
  saveFlashcard: { pl:'+ Fiszka',     en:'+ Card',        de:'+ Karte',       es:'+ Tarjeta',      fr:'+ Fiche',       it:'+ Scheda'       },
  saved:         { pl:'✓ Zapisano',   en:'✓ Saved',       de:'✓ Gespeichert', es:'✓ Guardado',     fr:'✓ Enregistré',  it:'✓ Salvato'      },
  translating:   { pl:'Tłumaczę...',  en:'Translating...', de:'Übersetze...', es:'Traduciendo...',  fr:'Traduction...', it:'Traduzione...'  },
  // Vocab panel
  vocabPanel:    { pl:'Słownictwo transkrypcji',   en:'Transcript vocabulary',   de:'Vokabular der Transkription', es:'Vocabulario del texto', fr:'Vocabulaire de la transcription', it:'Vocabolario della trascrizione' },
  vocabLoading:  { pl:'Analiza w toku…',           en:'Analysis in progress…',   de:'Analyse läuft…',              es:'Análisis en curso…',    fr:'Analyse en cours…',               it:'Analisi in corso…'             },
  vocabAll:      { pl:'Wszystkie',    en:'All',           de:'Alle',          es:'Todos',          fr:'Tous',          it:'Tutti'          },
  vocabNoun:     { pl:'Rzeczowniki',  en:'Nouns',         de:'Substantive',   es:'Sustantivos',    fr:'Noms',          it:'Sostantivi'     },
  vocabVerb:     { pl:'Czasowniki',   en:'Verbs',         de:'Verben',        es:'Verbos',         fr:'Verbes',        it:'Verbi'          },
  vocabAdj:      { pl:'Przymiotniki', en:'Adjectives',    de:'Adjektive',     es:'Adjetivos',      fr:'Adjectifs',     it:'Aggettivi'      },
  vocabAdv:      { pl:'Przysłówki',   en:'Adverbs',       de:'Adverbien',     es:'Adverbios',      fr:'Adverbes',      it:'Avverbi'        },
  posNoun:       { pl:'rzecz.',       en:'noun',          de:'Subst.',        es:'sust.',          fr:'nom',           it:'sost.'          },
  posVerb:       { pl:'czas.',        en:'verb',          de:'Verb',          es:'verb.',          fr:'verbe',         it:'verb.'          },
  posAdj:        { pl:'przym.',       en:'adj.',          de:'Adj.',          es:'adj.',           fr:'adj.',          it:'agg.'           },
  posAdv:        { pl:'przysł.',      en:'adv.',          de:'Adv.',          es:'adv.',           fr:'adv.',          it:'avv.'           },
  refresh:       { pl:'↺ odśwież',    en:'↺ refresh',     de:'↺ aktualisieren',es:'↺ actualizar',  fr:'↺ actualiser',  it:'↺ aggiorna'     },
  dualSubs:      { pl:'Tłumaczenia',  en:'Translations',  de:'Übersetzungen', es:'Traducciones',   fr:'Traductions',   it:'Traduzioni'     },
  noSegments:    { pl:'używam trybu tekstowego', en:'using text mode', de:'Textmodus', es:'modo texto', fr:'mode texte', it:'modalità testo' },
  // Dashboard — stat cards
  streakLabel:   { pl:'Seria dni',        en:'Streak',          de:'Tagesstreak',     es:'Racha',          fr:'Série',           it:'Serie'           },
  streakSub:     { pl:'dni z rzędu',      en:'days in a row',   de:'Tage am Stück',   es:'días seguidos',  fr:'jours consécutifs',it:'giorni di fila'  },
  textsLabel:    { pl:'Teksty',           en:'Texts',           de:'Texte',           es:'Textos',         fr:'Textes',          it:'Testi'           },
  textsSub:      { pl:'napisane i sprawdzone',en:'written & checked',de:'geschrieben & geprüft',es:'escritos y revisados',fr:'écrits et vérifiés',it:'scritti e verificati'},
  avgScoreLabel: { pl:'Średni wynik',     en:'Avg. score',      de:'Ø Ergebnis',      es:'Puntuación media',fr:'Score moyen',    it:'Punteggio medio' },
  vocabWords:    { pl:'słówek',           en:'vocab',           de:'Wörter',          es:'palabras',       fr:'mots',            it:'parole'          },
  // Dashboard — section titles
  recentScores:  { pl:'Ostatnie wyniki',  en:'Recent scores',   de:'Letzte Ergebnisse',es:'Últimas puntuaciones',fr:'Scores récents',it:'Punteggi recenti'},
  errorCats:     { pl:'Kategorie błędów', en:'Error categories',de:'Fehlerkategorien',es:'Categorías de errores',fr:'Catégories d\'erreurs',it:'Categorie di errori'},
  langLearning:  { pl:'Języki nauki',     en:'Languages',       de:'Lernsprachen',    es:'Idiomas',        fr:'Langues',         it:'Lingue'          },
  recentPractice:{ pl:'Ostatnie próby',   en:'Recent sessions', de:'Letzte Versuche', es:'Últimas sesiones',fr:'Dernières séances',it:'Sessioni recenti'},
  // Dashboard — empty states
  noDataYet:     { pl:'Brak danych — zacznij ćwiczyć!',en:'No data yet — start practising!',de:'Noch keine Daten — leg los!',es:'Sin datos — ¡empieza!',fr:'Aucune donnée — commence !',it:'Nessun dato — inizia!'},
  noErrorsYet:   { pl:'Brak błędów — świetnie!',en:'No errors — great job!',de:'Keine Fehler — super!',es:'Sin errores — ¡genial!',fr:'Pas d\'erreurs — bravo !',it:'Nessun errore — ottimo!'},
  noHistoryYet:  { pl:'Brak historii — zacznij teraz!',en:'No history — start now!',de:'Keine Einträge — los!',es:'Sin historial — ¡ahora!',fr:'Aucun historique — commence !',it:'Nessuna cronologia — inizia!'},
  chooseToStart: { pl:'Wybierz język i zacznij!',en:'Choose a language and start!',de:'Wähle eine Sprache!',es:'¡Elige un idioma!',fr:'Choisis une langue !',it:'Scegli una lingua!'},
  // Singular / plural counts
  exercise1:     { pl:'ćwiczenie',        en:'exercise',        de:'Übung',           es:'ejercicio',      fr:'exercice',        it:'esercizio'       },
  exerciseN:     { pl:'ćwiczeń',          en:'exercises',       de:'Übungen',         es:'ejercicios',     fr:'exercices',       it:'esercizi'        },
  error1:        { pl:'błąd',             en:'error',           de:'Fehler',          es:'error',          fr:'erreur',          it:'errore'          },
  errorN:        { pl:'błędów',           en:'errors',          de:'Fehler',          es:'errores',        fr:'erreurs',         it:'errori'          },
  // Header
  kidModeBtn:    { pl:'🧒 Dziecko',       en:'🧒 Kid',          de:'🧒 Kind',         es:'🧒 Niño',        fr:'🧒 Enfant',       it:'🧒 Bambino'      },
  adultModeBtn:  { pl:'🎓 Dorosły',       en:'🎓 Adult',        de:'🎓 Erwachsener',  es:'🎓 Adulto',      fr:'🎓 Adulte',       it:'🎓 Adulto'       },
  activeSource:  { pl:'Aktywne źródło:',  en:'Active source:',  de:'Aktive Quelle:',  es:'Fuente activa:', fr:'Source active :', it:'Fonte attiva:'   },
};

export type TKey = keyof typeof S;
export function t(key: TKey, lang: UiLang): string {
  return (S[key] as any)?.[lang] ?? (S[key] as any)?.['en'] ?? String(key);
}

// ── Native (translation-target) language map ──────────────────────────────────
// English name used in AI prompts
export const NATIVE_LANG_NAME: Record<string, string> = {
  pl: 'Polish',     en: 'English',     de: 'German',      es: 'Spanish',
  fr: 'French',     it: 'Italian',     pt: 'Portuguese',  ru: 'Russian',
  zh: 'Chinese',    ja: 'Japanese',    ko: 'Korean',       ar: 'Arabic',
  nl: 'Dutch',      sv: 'Swedish',     no: 'Norwegian',    da: 'Danish',
  fi: 'Finnish',    cs: 'Czech',       sk: 'Slovak',       hu: 'Hungarian',
  ro: 'Romanian',   bg: 'Bulgarian',   hr: 'Croatian',     uk: 'Ukrainian',
  tr: 'Turkish',    el: 'Greek',       he: 'Hebrew',       vi: 'Vietnamese',
  th: 'Thai',       id: 'Indonesian',
};

// Display label with flag emoji
export const NATIVE_LANG_DISPLAY: Record<string, string> = {
  pl: 'Polski 🇵🇱',         en: 'English 🇬🇧',       de: 'Deutsch 🇩🇪',
  es: 'Español 🇪🇸',        fr: 'Français 🇫🇷',      it: 'Italiano 🇮🇹',
  pt: 'Português 🇵🇹',      ru: 'Русский 🇷🇺',       zh: '中文 🇨🇳',
  ja: '日本語 🇯🇵',          ko: '한국어 🇰🇷',          ar: 'العربية 🇸🇦',
  nl: 'Nederlands 🇳🇱',     sv: 'Svenska 🇸🇪',       no: 'Norsk 🇳🇴',
  da: 'Dansk 🇩🇰',           fi: 'Suomi 🇫🇮',          cs: 'Čeština 🇨🇿',
  sk: 'Slovenčina 🇸🇰',     hu: 'Magyar 🇭🇺',         ro: 'Română 🇷🇴',
  bg: 'Български 🇧🇬',      hr: 'Hrvatski 🇭🇷',       uk: 'Українська 🇺🇦',
  tr: 'Türkçe 🇹🇷',         el: 'Ελληνικά 🇬🇷',       he: 'עברית 🇮🇱',
  vi: 'Tiếng Việt 🇻🇳',     th: 'ภาษาไทย 🇹🇭',        id: 'Indonesia 🇮🇩',
};

// UI language display
export const UI_LANG_DISPLAY: Record<UiLang, string> = {
  pl: 'Polski 🇵🇱', en: 'English 🇬🇧', de: 'Deutsch 🇩🇪',
  es: 'Español 🇪🇸', fr: 'Français 🇫🇷', it: 'Italiano 🇮🇹',
};

// Browser locale code per UI language (for date formatting)
export const UI_LANG_LOCALE: Record<UiLang, string> = {
  pl: 'pl-PL', en: 'en-GB', de: 'de-DE', es: 'es-ES', fr: 'fr-FR', it: 'it-IT',
};
