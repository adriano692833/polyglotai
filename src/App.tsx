import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Languages, User, LogOut, Loader2, BarChart3, PenTool, Layers, Globe, Star, Flame, Sparkles, Check, BookOpen, Target, Zap, ArrowRightLeft, Send, Trash2, Plus, Moon, Sun, LayoutDashboard, Book, MessageSquare, Trophy, Monitor, ChevronLeft, ChevronRight, Shuffle, RotateCcw, Brain, HelpCircle, X, Play, Settings } from 'lucide-react';
import { AuthUser, TabId } from './lib/types';
import { PRACTICE_LANGS, CEFR_LEVELS, TRANSLATION_STYLES, PRACTICE_TOPICS } from './lib/constants';
import { t, UiLang, NATIVE_LANG_NAME, NATIVE_LANG_DISPLAY, UI_LANG_DISPLAY, UI_LANG_LOCALE } from './i18n';

// --- COMPONENTS ---
async function requestAiText(prompt: string, isJson: boolean): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, isJson }),
      signal: controller.signal,
    });

    const response = await res.json();
    if (!res.ok) {
      throw new Error(response?.error || 'Błąd komunikacji z AI');
    }

    if (typeof response?.text !== 'string') {
      throw new Error('Niepoprawna odpowiedź AI');
    }

    return response.text;
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new Error('Przekroczono czas oczekiwania na odpowiedź AI');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function translateWordQuick(word: string, source: string, target: string, context?: string): Promise<string | null> {
  try {
    const params = new URLSearchParams({ q: word, source, target });
    if (context) params.set('ctx', context.slice(0, 200));
    const resp = await fetch(`/api/translate/quick?${params}`);
    if (!resp.ok) return null;
    const data = await resp.json();
    return (data.translation as string) || null;
  } catch {
    return null;
  }
}

function parseAiJson<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

type TranscriptSource = {
  id: string;
  title: string;
  url: string;
  videoId: string;
  transcript: string;
  lang: string;
};

type Segment = { text: string; start: number; dur: number };
type WordPopup = { word: string; x: number; y: number; translation: string | null; saving: boolean };

async function fetchTranscriptSources(userId: string, lang: string): Promise<TranscriptSource[]> {
  const res = await fetch(`/api/transcripts?userId=${encodeURIComponent(userId)}&lang=${encodeURIComponent(lang)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

function TranscriptPicker({
  userId,
  lang,
  selectedId,
  onSelect
}: {
  userId: string;
  lang: string;
  selectedId: string | null;
  onSelect: (source: TranscriptSource | null) => void;
}) {
  const [sources, setSources] = useState<TranscriptSource[]>([]);
  const [link, setLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteGenerated, setDeleteGenerated] = useState(false);
  const [status, setStatus] = useState<string>('');

  const loadSources = async () => {
    setLoading(true);
    try {
      const list = await fetchTranscriptSources(userId, lang);
      setSources(list);
      if (selectedId) {
        const selected = list.find((s) => s.id === selectedId) || null;
        if (!selected) onSelect(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, lang]);

  const importLink = async () => {
    if (!link.trim()) return;
    setImporting(true);
    setStatus('Importowanie transkrypcji...');
    try {
      const res = await fetch('/api/transcripts/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, url: link.trim(), lang }),
      });
      const data = await res.json();
      if (res.ok && data?.id) {
        const list = await fetchTranscriptSources(userId, lang);
        setSources(list);
        const selected = list.find((s) => s.id === data.id) || null;
        onSelect(selected);
        setLink('');
        setStatus('Transkrypcja została zaimportowana.');
      } else {
        setStatus(data?.error || 'Nie udało się zaimportować transkrypcji.');
      }
    } catch (err) {
      console.error(err);
      setStatus('Błąd importu transkrypcji. Sprawdź logi serwera.');
    } finally {
      setImporting(false);
    }
  };

  const removeSelected = async () => {
    if (!selectedId) return;
    setDeleting(true);
    setStatus('Usuwanie transkrypcji...');
    try {
      await fetch(`/api/transcripts/${selectedId}?deleteGenerated=${deleteGenerated ? 'true' : 'false'}`, { method: 'DELETE' });
      const list = await fetchTranscriptSources(userId, lang);
      setSources(list);
      onSelect(null);
      setStatus(deleteGenerated ? 'Usunięto źródło i powiązane dane.' : 'Usunięto tylko źródło transkrypcji.');
    } catch (err) {
      console.error(err);
      setStatus('Błąd usuwania transkrypcji.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-3 p-5 rounded-2xl bg-white/40 dark:bg-slate-900/40 border border-white/20 dark:border-white/5">
      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Transkrypcje (YouTube)</label>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="Wklej link do YouTube i kliknij Importuj"
          className="flex-1 bg-white/70 dark:bg-slate-950/50 border border-white/20 dark:border-white/5 rounded-xl px-4 py-2.5 outline-none text-sm font-semibold"
        />
        <button
          onClick={importLink}
          disabled={importing || !link.trim()}
          className="px-4 py-2.5 rounded-xl text-sm font-black brand-gradient text-white disabled:opacity-50"
        >
          {importing ? 'Import...' : 'Importuj'}
        </button>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <select
          value={selectedId || ''}
          onChange={(e) => onSelect(sources.find((s) => s.id === e.target.value) || null)}
          className="flex-1 bg-white/70 dark:bg-slate-950/50 border border-white/20 dark:border-white/5 rounded-xl px-4 py-2.5 outline-none text-sm font-semibold"
        >
          <option value="">{loading ? 'Ładowanie...' : 'Bez transkrypcji'}</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>{s.title}</option>
          ))}
        </select>
        <button
          onClick={removeSelected}
          disabled={!selectedId || deleting}
          className="px-4 py-2.5 rounded-xl text-sm font-black bg-red-500 text-white disabled:opacity-40"
        >
          {deleting ? 'Usuwam...' : 'Usuń'}
        </button>
      </div>
      <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
        <input
          type="checkbox"
          checked={deleteGenerated}
          onChange={(e) => setDeleteGenerated(e.target.checked)}
        />
        Usuń też wygenerowane dane z tej transkrypcji (inaczej: usuń tylko źródło)
      </label>
      {status && <p className="text-xs font-semibold text-brand-500">{status}</p>}
    </div>
  );
}

function TopicSelector({ value, onChange, isKidMode, disabled, transcriptTitle }: { value: string, onChange: (v: string) => void, isKidMode: boolean, disabled?: boolean, transcriptTitle?: string }) {
  const [isCustom, setIsCustom] = useState(false);

  if (disabled) {
    return (
      <div className="space-y-3">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1 opacity-60">Temat:</p>
        <div className="flex items-center gap-3 px-5 py-3 rounded-2xl glass border-2 border-brand-500/30 text-brand-500 font-black text-sm">
          <span className="text-xl">📹</span>
          <span className="truncate">{transcriptTitle || 'Transkrypcja YouTube'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1 opacity-60">Wybierz temat:</p>
      <div className="flex flex-wrap gap-4">
        {PRACTICE_TOPICS.map(t => (
          <button
            key={t.id}
            onClick={() => { onChange(t.name); setIsCustom(false); }}
            className={`px-6 py-3 rounded-2xl text-sm font-black transition-all flex items-center gap-3 border-2 transform active:scale-95 ${
              !isCustom && value === t.name
                ? (isKidMode ? 'brand-gradient border-purple-400 text-white shadow-2xl' : 'brand-gradient border-brand-400 text-white shadow-2xl brand-shadow')
                : 'glass border-white/20 dark:border-white/5 hover:border-brand-500/50 dark:hover:border-brand-500/30'
            }`}
          >
            <span className="text-xl drop-shadow-md">{t.emoji}</span>
            {t.name}
          </button>
        ))}
        <button
          onClick={() => setIsCustom(true)}
          className={`px-6 py-3 rounded-2xl text-sm font-black transition-all flex items-center gap-3 border-2 transform active:scale-95 ${
            isCustom
              ? (isKidMode ? 'brand-gradient border-purple-400 text-white shadow-2xl' : 'brand-gradient border-brand-400 text-white shadow-2xl brand-shadow')
              : 'glass border-white/20 dark:border-white/5 hover:border-brand-500/50 dark:hover:border-brand-500/30'
          }`}
        >
          <span className="text-xl drop-shadow-md">✨</span>
          Własny...
        </button>
      </div>
      {isCustom && (
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="relative"
        >
          <input
            className="w-full glass border border-white/20 dark:border-white/5 rounded-2xl px-8 py-5 outline-none text-lg font-black tracking-tight focus:ring-2 focus:ring-brand-500 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-700"
            placeholder="Wpisz własny temat..."
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          <div className="absolute right-6 top-1/2 -translate-y-1/2">
            <Sparkles className="h-6 w-6 text-brand-500 opacity-50" />
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [isKidMode, setIsKidMode] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [globalSource, setGlobalSource] = useState<TranscriptSource | null>(() => {
    try { return JSON.parse(localStorage.getItem('pg_global_source') || 'null'); } catch { return null; }
  });

  const setGlobalSourceAndPersist = (src: TranscriptSource | null) => {
    setGlobalSource(src);
    if (src) localStorage.setItem('pg_global_source', JSON.stringify(src));
    else localStorage.removeItem('pg_global_source');
  };

  const [globalLang, setGlobalLang] = useState<string>(() => localStorage.getItem('pg_lang') || 'en');
  useEffect(() => { localStorage.setItem('pg_lang', globalLang); }, [globalLang]);

  // Native language — the language translations are shown IN (default: Polish)
  const [nativeLang, setNativeLang] = useState<string>(() => localStorage.getItem('pg_native_lang') || 'pl');
  useEffect(() => { localStorage.setItem('pg_native_lang', nativeLang); }, [nativeLang]);

  // UI language — the language of app menus/labels (default: Polish)
  const [uiLang, setUiLang] = useState<UiLang>(() => (localStorage.getItem('pg_ui_lang') as UiLang) || 'pl');
  useEffect(() => { localStorage.setItem('pg_ui_lang', uiLang); }, [uiLang]);

  const [showSettings, setShowSettings] = useState(false);
  // Pending changes in settings modal
  const [pendingNative, setPendingNative] = useState(nativeLang);
  const [pendingUi, setPendingUi] = useState<UiLang>(uiLang);
  const [pendingLearn, setPendingLearn] = useState(globalLang);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const token = localStorage.getItem('pg_token');
    if (!token) {
      setIsChecking(false);
      return;
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    fetch('/api/auth/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      signal: controller.signal
    })
    .then(res => res.json())
    .then(data => {
      if (data.authenticated) setUser(data.user);
      else localStorage.removeItem('pg_token');
    })
    .catch((err) => {
      console.error("Auth check failed:", err);
      if (err.name === 'AbortError') {
        localStorage.removeItem('pg_token');
      }
    })
    .finally(() => {
      clearTimeout(timeoutId);
      setIsChecking(false);
    });
  }, []);

  const logout = () => {
    localStorage.removeItem('pg_token');
    setUser(null);
  };

  if (isChecking) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8fafc] dark:bg-[#080d1a] p-4 text-center">
      <div className="h-16 w-16 rounded-2xl brand-gradient brand-shadow flex items-center justify-center shadow-lg animate-pulse mb-4">
        <Languages className="h-8 w-8 text-white" />
      </div>
      <div className="flex items-center gap-2 text-slate-400 mb-6">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm font-medium">Ładowanie PolyGlotAI...</span>
      </div>
      <div className="text-xs font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
        v2 · build {new Date((globalThis as any).__BUILD_TIME__ ?? Date.now()).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })}
      </div>
      <button
        onClick={() => { localStorage.clear(); window.location.reload(); }}
        className="text-xs text-slate-400 hover:text-brand-500 underline transition-colors"
      >
        Jeśli aplikacja się nie ładuje, kliknij tutaj aby zresetować
      </button>
    </div>
  );

  if (!user) return <AuthScreen onLogin={setUser} />;

  return (
    <div className={`min-h-screen flex flex-col theme-transition relative overflow-hidden font-sans ${isDarkMode ? 'dark bg-[#080d1a] text-slate-100' : 'bg-[#f8fafc] text-slate-900'}`}>
      {/* Ambient background glows */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className={`absolute top-[-15%] left-[-10%] w-[55%] h-[55%] rounded-full blur-[140px] transition-all duration-1000 ${
          isKidMode
            ? 'bg-purple-400/15 dark:bg-purple-500/8'
            : 'bg-brand-400/8 dark:bg-brand-500/6'
        }`} />
        <div className={`absolute bottom-[-15%] right-[-10%] w-[55%] h-[55%] rounded-full blur-[140px] transition-all duration-1000 ${
          isKidMode
            ? 'bg-pink-400/15 dark:bg-pink-500/8'
            : 'bg-accent-400/8 dark:bg-accent-500/5'
        }`} />
        {/* Subtle grid pattern in light mode */}
        <div className="absolute inset-0 opacity-[0.015] dark:opacity-0" style={{backgroundImage: 'linear-gradient(rgba(99,102,241,1) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,1) 1px, transparent 1px)', backgroundSize: '40px 40px'}} />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header */}
        <header className={`sticky top-0 z-30 w-full border-b backdrop-blur-2xl theme-transition ${
          isKidMode
            ? 'bg-white/80 border-purple-100/80 dark:bg-[#0d1424]/80 dark:border-purple-900/20'
            : 'bg-white/80 border-slate-200/60 dark:bg-[#0d1424]/80 dark:border-white/[0.06]'
        }`}>
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <motion.div
                whileHover={{ scale: 1.05, rotate: 6 }}
                whileTap={{ scale: 0.95 }}
                className={`flex h-9 w-9 items-center justify-center rounded-xl shadow-md ${isKidMode ? 'bg-gradient-to-br from-pink-400 to-purple-500' : 'brand-gradient brand-shadow'}`}
              >
                <Languages className="h-5 w-5 text-white" />
              </motion.div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                PolyGlot<span className={`font-black ${isKidMode ? 'text-purple-500' : 'text-brand-500'}`}>AI</span>
              </h1>
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-2 sm:gap-3">

              {/* Global language selector */}
              <select
                value={globalLang}
                onChange={e => setGlobalLang(e.target.value)}
                title="Język nauki"
                className="glass border border-white/20 dark:border-white/5 rounded-xl px-2 sm:px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
              >
                {PRACTICE_LANGS.map(l => <option key={l.code} value={l.code}>{l.flag} {l.code.toUpperCase()}</option>)}
              </select>

              {/* Theme toggle */}
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                aria-label={isDarkMode ? 'Włącz tryb jasny' : 'Włącz tryb ciemny'}
                className={`relative inline-flex h-8 w-[3.25rem] items-center rounded-full transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
                  isDarkMode
                    ? 'bg-slate-700 hover:bg-slate-600'
                    : 'bg-slate-200 hover:bg-slate-300'
                }`}
              >
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full shadow-sm transition-all duration-300 ${
                    isDarkMode
                      ? 'translate-x-[1.625rem] bg-brand-500'
                      : 'translate-x-1 bg-white'
                  }`}
                >
                  {isDarkMode
                    ? <Moon className="h-3.5 w-3.5 text-white" />
                    : <Sun className="h-3.5 w-3.5 text-amber-500" />}
                </span>
              </button>

              {/* Kid mode toggle — hidden on mobile */}
              <button
                onClick={() => setIsKidMode(!isKidMode)}
                className={`hidden sm:flex px-4 py-1.5 rounded-full text-xs font-semibold transition-all hover:scale-105 active:scale-95 ${
                  isKidMode
                    ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-700/50'
                    : 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-white/[0.06]'
                }`}
              >
                {t(isKidMode ? 'kidModeBtn' : 'adultModeBtn', uiLang)}
              </button>

              {/* User badge — hidden on mobile */}
              <div className={`hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-sm font-medium ${
                isKidMode
                  ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-800/40 text-purple-700 dark:text-purple-300'
                  : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200/80 dark:border-white/[0.06] text-slate-700 dark:text-slate-300'
              }`}>
                <div className={`h-1.5 w-1.5 rounded-full animate-pulse ${isKidMode ? 'bg-pink-400' : 'bg-emerald-400'}`} />
                {user.name}
              </div>

              {/* Settings button */}
              <button
                onClick={() => { setPendingNative(nativeLang); setPendingUi(uiLang); setPendingLearn(globalLang); setShowSettings(true); }}
                className="p-2 text-slate-400 hover:text-brand-500 hover:bg-brand-500/10 rounded-xl transition-all"
                title={t('settings', uiLang)}
              >
                <Settings className="h-4 w-4" />
              </button>

              {/* Logout */}
              <button
                onClick={logout}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all"
              >
                <LogOut className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>
        </header>

      {/* ── Settings modal ── */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowSettings(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.93, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.93, y: 12 }}
              transition={{ duration: 0.18 }}
              onClick={e => e.stopPropagation()}
              className="bg-slate-900 dark:bg-slate-950 border border-white/15 rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-brand-500/15">
                    <Settings className="h-5 w-5 text-brand-400" />
                  </div>
                  <h2 className="text-lg font-black">{t('settingsTitle', uiLang)}</h2>
                </div>
                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                  <X className="h-4 w-4 opacity-60" />
                </button>
              </div>

              {/* Native language */}
              <div className="space-y-2">
                <label className="block text-sm font-bold">{t('nativeLangLabel', uiLang)}</label>
                <p className="text-xs text-slate-400">{t('nativeLangHint', uiLang)}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto pr-1">
                  {Object.entries(NATIVE_LANG_DISPLAY).map(([code, label]) => (
                    <button
                      key={code}
                      onClick={() => setPendingNative(code)}
                      className={`px-2.5 py-2 rounded-xl text-xs font-semibold text-left transition-all ${
                        pendingNative === code
                          ? 'bg-brand-500 text-white'
                          : 'glass border border-white/10 hover:border-brand-500/40 text-slate-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Learning language */}
              <div className="space-y-2">
                <label className="block text-sm font-bold">{t('learnLangLabel', uiLang)}</label>
                <select
                  value={pendingLearn}
                  onChange={e => setPendingLearn(e.target.value)}
                  className="w-full glass border border-white/15 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {PRACTICE_LANGS.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name ?? l.code.toUpperCase()}</option>)}
                </select>
              </div>

              {/* UI language */}
              <div className="space-y-2">
                <label className="block text-sm font-bold">{t('uiLangLabel', uiLang)}</label>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.entries(UI_LANG_DISPLAY) as [UiLang, string][]).map(([code, label]) => (
                    <button
                      key={code}
                      onClick={() => setPendingUi(code)}
                      className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                        pendingUi === code
                          ? 'bg-brand-500 text-white'
                          : 'glass border border-white/10 hover:border-brand-500/40 text-slate-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setShowSettings(false)}
                  className="flex-1 py-2.5 rounded-xl glass border border-white/15 text-sm font-semibold hover:border-white/30 transition-all"
                >
                  {t('cancel', uiLang)}
                </button>
                <button
                  onClick={() => {
                    setNativeLang(pendingNative);
                    setUiLang(pendingUi);
                    setGlobalLang(pendingLearn);
                    setShowSettings(false);
                  }}
                  className="flex-1 py-2.5 rounded-xl brand-gradient text-white text-sm font-bold transition-all hover:opacity-90"
                >
                  {t('save', uiLang)}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <nav className="mx-auto w-full max-w-6xl px-4 sm:px-6 pt-3 pb-1">
        <div className="flex flex-wrap gap-1 sm:gap-1.5">
          <NavButton id="dashboard" active={activeTab === 'dashboard'} onClick={setActiveTab} icon={<LayoutDashboard className="h-4 w-4" />} label={isKidMode ? "Wyniki" : t('dashboard', uiLang)} isKidMode={isKidMode} />
          <NavButton id="practice" active={activeTab === 'practice'} onClick={setActiveTab} icon={<PenTool className="h-4 w-4" />} label={isKidMode ? "Piszemy!" : t('write', uiLang)} isKidMode={isKidMode} />
          <NavButton id="reading" active={activeTab === 'reading'} onClick={setActiveTab} icon={<Book className="h-4 w-4" />} label={t('reading', uiLang)} isKidMode={isKidMode} />
          <NavButton id="sentences" active={activeTab === 'sentences'} onClick={setActiveTab} icon={<MessageSquare className="h-4 w-4" />} label={t('sentences', uiLang)} isKidMode={isKidMode} />
          <NavButton id="flashcards" active={activeTab === 'flashcards'} onClick={setActiveTab} icon={<Layers className="h-4 w-4" />} label={isKidMode ? "Karty" : t('flashcards', uiLang)} isKidMode={isKidMode} />
          <NavButton id="vocabulary" active={activeTab === 'vocabulary'} onClick={setActiveTab} icon={<BookOpen className="h-4 w-4" />} label={t('vocab', uiLang)} isKidMode={isKidMode} />
          <NavButton id="challenge" active={activeTab === 'challenge'} onClick={setActiveTab} icon={<Trophy className="h-4 w-4" />} label={t('challenge', uiLang)} isKidMode={isKidMode} />
          <NavButton id="translator" active={activeTab === 'translator'} onClick={setActiveTab} icon={<Globe className="h-4 w-4" />} label={t('translate', uiLang)} isKidMode={isKidMode} />
          <NavButton id="transcripts" active={activeTab === 'transcripts'} onClick={setActiveTab} icon={<Monitor className="h-4 w-4" />} label={t('youtube', uiLang)} isKidMode={isKidMode} />
        </div>
      </nav>

      {/* Global Source Bar */}
      {globalSource && (
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 pb-2">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-semibold border ${
            isKidMode
              ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200/60 dark:border-purple-700/30 text-purple-700 dark:text-purple-300'
              : 'bg-brand-500/8 border-brand-500/20 text-brand-600 dark:text-brand-400'
          }`}>
            <span className="text-sm">📹</span>
            <span className="truncate flex-1">{t('activeSource', uiLang)} <span className="font-black">{globalSource.title}</span></span>
            <button
              onClick={() => setGlobalSourceAndPersist(null)}
              className="shrink-0 p-1 hover:bg-white/20 rounded-lg transition-colors opacity-60 hover:opacity-100"
              title="Usuń globalne źródło"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-2">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab + globalLang + (isKidMode ? '-kid' : '')}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'dashboard' && <Dashboard user={user} isKidMode={isKidMode} uiLang={uiLang} />}
            {activeTab === 'practice' && <Practice user={user} isKidMode={isKidMode} globalSource={globalSource} lang={globalLang} nativeLang={nativeLang} />}
            {activeTab === 'reading' && <Reading user={user} isKidMode={isKidMode} globalSource={globalSource} lang={globalLang} nativeLang={nativeLang} />}
            {activeTab === 'sentences' && <Sentences user={user} isKidMode={isKidMode} globalSource={globalSource} lang={globalLang} nativeLang={nativeLang} />}
            {activeTab === 'flashcards' && <Flashcards user={user} isKidMode={isKidMode} lang={globalLang} nativeLang={nativeLang} />}
            {activeTab === 'vocabulary' && <Vocabulary user={user} isKidMode={isKidMode} lang={globalLang} nativeLang={nativeLang} />}
            {activeTab === 'challenge' && <Challenge user={user} isKidMode={isKidMode} lang={globalLang} nativeLang={nativeLang} />}
            {activeTab === 'translator' && <Translator user={user} isKidMode={isKidMode} globalLang={globalLang} nativeLang={nativeLang} />}
            {activeTab === 'transcripts' && <TranscriptHub user={user} isKidMode={isKidMode} onSourceChange={setGlobalSourceAndPersist} lang={globalLang} nativeLang={nativeLang} />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Build version footer */}
      <footer className="relative z-10 py-4 text-center">
        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
          build {new Date((globalThis as any).__BUILD_TIME__ ?? Date.now()).toLocaleString(UI_LANG_LOCALE[uiLang], { dateStyle: 'short', timeStyle: 'short' })}
        </span>
      </footer>
    </div>
    </div>
  );
}

function NavButton({ id, active, onClick, icon, label, isKidMode }: { id: TabId, active: boolean, onClick: (id: TabId) => void, icon: React.ReactNode, label: string, isKidMode: boolean }) {
  return (
    <button
      onClick={() => onClick(id)}
      title={label}
      className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-semibold transition-all whitespace-nowrap ${
        active
          ? isKidMode
            ? 'bg-white dark:bg-purple-900/40 shadow-md text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700/40'
            : 'bg-white dark:bg-slate-800/80 shadow-md text-slate-900 dark:text-white border border-slate-200/80 dark:border-white/[0.08]'
          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white/70 dark:hover:bg-slate-800/40 border border-transparent'
      }`}
    >
      <span className={`shrink-0 ${active ? (isKidMode ? 'text-purple-500' : 'text-brand-500') : 'opacity-60'}`}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

// --- SUB-COMPONENTS ---

function AuthScreen({ onLogin }: { onLogin: (user: AuthUser) => void }) {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch(isRegister ? '/api/auth/register' : '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, pin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      localStorage.setItem('pg_token', data.token);
      onLogin(data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] dark:bg-[#080d1a] px-4 relative overflow-hidden font-sans">
      {/* Ambient glows */}
      <div className="absolute top-[-15%] left-[-10%] w-[45%] h-[45%] rounded-full bg-brand-400/10 dark:bg-brand-500/8 blur-[120px]" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[45%] h-[45%] rounded-full bg-accent-400/10 dark:bg-accent-500/6 blur-[120px]" />
      {/* Subtle grid */}
      <div className="absolute inset-0 opacity-[0.02] dark:opacity-0" style={{backgroundImage: 'linear-gradient(rgba(99,102,241,1) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,1) 1px, transparent 1px)', backgroundSize: '40px 40px'}} />

      <div className="w-full max-w-md glass rounded-3xl p-10 relative z-10">
        {/* Header */}
        <div className="flex flex-col items-center mb-10">
          <motion.div
            whileHover={{ rotate: 10, scale: 1.08 }}
            whileTap={{ scale: 0.96 }}
            className="h-20 w-20 rounded-2xl brand-gradient flex items-center justify-center shadow-xl brand-shadow mb-6"
          >
            <Languages className="h-10 w-10 text-white" />
          </motion.div>
          <h1 className="text-3xl font-black tracking-tight text-slate-800 dark:text-white">
            PolyGlot<span className="text-brand-500">AI</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-2 font-medium tracking-[0.12em] uppercase">
            {isRegister ? 'Utwórz konto' : 'Zaloguj się do konta'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-widest">Imię</label>
            <input
              type="text"
              className="w-full px-4 py-3.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none font-medium text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Twoje imię"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-widest">PIN (min. 4 cyfry)</label>
            <input
              type="password"
              className="w-full px-4 py-3.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none font-medium text-sm"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              maxLength={8}
              required
            />
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-red-500 dark:text-red-400 text-xs text-center font-medium bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-xl py-2.5 px-4"
            >
              {error}
            </motion.p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 brand-gradient hover:opacity-90 active:opacity-80 text-white rounded-xl font-semibold text-sm shadow-lg brand-shadow transition-all disabled:opacity-50 active:scale-[0.98] mt-2"
          >
            {loading
              ? <Loader2 className="h-5 w-5 animate-spin mx-auto" />
              : (isRegister ? 'Zarejestruj się' : 'Zaloguj się')}
          </button>
        </form>

        <div className="mt-1 pt-6 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setIsRegister(!isRegister)}
            className="w-full text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-brand-500 dark:hover:text-brand-400 transition-colors"
          >
            {isRegister ? 'Masz już konto? Zaloguj się' : 'Nie masz konta? Zarejestruj się'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Dashboard({ user, isKidMode, uiLang }: { user: AuthUser; isKidMode: boolean; uiLang: UiLang }) {
  const locale = UI_LANG_LOCALE[uiLang];
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/stats?userId=${user.id}`);
        const data = await res.json();
        setStats(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user.id]);

  if (loading) return <div className="h-64 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={<Flame className="h-5 w-5 text-brand-500" />}
          label={t('streakLabel', uiLang)}
          value={`${stats?.streak || 0}`}
          subValue={t('streakSub', uiLang)}
          barColor="bg-gradient-to-t from-brand-600 to-red-500"
          progress={Math.min((stats?.streak || 0) * 10, 100)}
        />
        <StatCard
          icon={<Book className="h-5 w-5 text-purple-500" />}
          label={t('textsLabel', uiLang)}
          value={`${stats?.totalPractices || 0}`}
          subValue={t('textsSub', uiLang)}
          barColor="bg-gradient-to-t from-purple-600 to-indigo-500"
          progress={Math.min((stats?.totalPractices || 0) * 5, 100)}
        />
        <StatCard
          icon={<BarChart3 className="h-5 w-5 text-emerald-500" />}
          label={t('avgScoreLabel', uiLang)}
          value={`${stats?.averageScore || 0}`}
          subValue={`min ${stats?.minScore || 0} / max ${stats?.maxScore || 0}`}
          barColor="bg-gradient-to-t from-emerald-600 to-teal-500"
          progress={stats?.averageScore || 0}
        />
        <StatCard
          icon={<Layers className="h-5 w-5 text-blue-500" />}
          label={t('flashcards', uiLang)}
          value={`${stats?.flashcardCount || 0}`}
          subValue={`+ ${stats?.vocabCount || 0} ${t('vocabWords', uiLang)}`}
          barColor="bg-gradient-to-t from-blue-600 to-cyan-500"
          progress={Math.min((stats?.flashcardCount || 0) * 2, 100)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Score history chart */}
        <div className="glass rounded-[2.5rem] p-8 h-72 flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20">
              <BarChart3 className="h-5 w-5 text-emerald-500" />
            </div>
            <h3 className="font-extrabold text-lg tracking-tight">{t('recentScores', uiLang)}</h3>
          </div>
          {Array.isArray(stats?.scoreHistory) && stats.scoreHistory.length > 0 ? (
            <div className="flex-1 flex items-end gap-1.5">
              {stats.scoreHistory.slice(-12).map((s: any, i: number) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                  <span className="text-[9px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">{s.score}</span>
                  <div
                    className={`w-full rounded-t-lg transition-all ${s.score >= 80 ? 'bg-emerald-400' : s.score >= 60 ? 'bg-yellow-400' : 'bg-red-400'}`}
                    style={{ height: `${Math.max(s.score, 4)}%` }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-sm space-y-3">
              <Plus className="h-10 w-10 opacity-15" />
              <p className="font-semibold">{t('noDataYet', uiLang)}</p>
            </div>
          )}
        </div>

        {/* Error categories */}
        <div className="glass rounded-[2.5rem] p-8 h-72 flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-2xl bg-pink-50 dark:bg-pink-900/20">
              <Check className="h-5 w-5 text-pink-500" />
            </div>
            <h3 className="font-extrabold text-lg tracking-tight">{t('errorCats', uiLang)}</h3>
          </div>
          {Object.keys(stats?.errorCategories || {}).length > 0 ? (
            <div className="flex-1 space-y-3 overflow-auto">
              {(() => {
                const entries = Object.entries(stats.errorCategories as Record<string, number>).sort(([,a],[,b]) => b - a).slice(0, 5);
                const maxVal = entries[0]?.[1] || 1;
                return entries.map(([cat, count]) => (
                  <div key={cat} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="capitalize">{cat}</span>
                      <span className="text-slate-400">{count}x</span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-pink-400 to-rose-500 rounded-full transition-all" style={{ width: `${(count / maxVal) * 100}%` }} />
                    </div>
                  </div>
                ));
              })()}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-sm space-y-3">
              <Check className="h-10 w-10 opacity-15" />
              <p className="font-semibold">{t('noErrorsYet', uiLang)}</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Language breakdown */}
        <div className="glass rounded-[2.5rem] p-8 min-h-[16rem] flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-2xl bg-yellow-50 dark:bg-yellow-900/20">
              <Star className="h-5 w-5 text-yellow-500" />
            </div>
            <h3 className="font-extrabold text-lg tracking-tight">{t('langLearning', uiLang)}</h3>
          </div>
          {Object.keys(stats?.languages || {}).length > 0 ? (
            <div className="flex-1 flex flex-wrap gap-3 content-start">
              {Object.entries(stats.languages as Record<string, number>)
                .sort(([,a],[,b]) => b - a)
                .map(([code, count]) => {
                  const l = PRACTICE_LANGS.find(x => x.code === code);
                  return (
                    <div key={code} className="flex items-center gap-2.5 px-4 py-2.5 glass rounded-2xl border border-white/20 dark:border-white/5">
                      <span className="text-2xl">{l?.flag}</span>
                      <div>
                        <p className="font-bold text-sm">{l?.name || code}</p>
                        <p className="text-[11px] text-slate-400">{count} {t(count === 1 ? 'exercise1' : 'exerciseN', uiLang)}</p>
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-sm space-y-3">
              <Globe className="h-10 w-10 opacity-10" />
              <p className="font-semibold">{t('chooseToStart', uiLang)}</p>
            </div>
          )}
        </div>

        {/* Recent practices */}
        <div className="glass rounded-[2.5rem] p-8 min-h-[16rem] flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-900/20">
              <Zap className="h-5 w-5 text-blue-500" />
            </div>
            <h3 className="font-extrabold text-lg tracking-tight">{t('recentPractice', uiLang)}</h3>
          </div>
          {Array.isArray(stats?.recentPractices) && stats.recentPractices.length > 0 ? (
            <div className="flex-1 space-y-2.5">
              {stats.recentPractices.map((p: any, i: number) => {
                const l = PRACTICE_LANGS.find(x => x.code === p.lang);
                const scoreColor = p.score >= 80 ? 'text-emerald-500' : p.score >= 60 ? 'text-yellow-500' : 'text-red-500';
                return (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-50/50 dark:bg-slate-800/40">
                    <span className="text-xl shrink-0">{l?.flag}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{l?.name || p.lang}</p>
                      <p className="text-[11px] text-slate-400">{new Date(p.date).toLocaleDateString(locale)} · {p.mistakeCount} {t(p.mistakeCount === 1 ? 'error1' : 'errorN', uiLang)}</p>
                    </div>
                    <span className={`text-xl font-black shrink-0 ${scoreColor}`}>{p.score}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-sm space-y-3">
              <Flame className="h-10 w-10 opacity-10" />
              <p className="font-semibold">{t('noHistoryYet', uiLang)}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, subValue, barColor, progress }: any) {
  return (
    <div className="relative overflow-hidden glass rounded-[2.5rem] p-8 group transition-all hover:shadow-2xl hover:-translate-y-1.5 duration-500">
      <div className="relative z-10 flex justify-between items-start">
        <div className="space-y-4">
          <div className="flex items-center gap-2.5 text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em]">
            <div className="p-2.5 rounded-xl bg-slate-100/50 dark:bg-slate-800/50 group-hover:scale-110 transition-transform duration-500">
              {icon}
            </div>
            {label}
          </div>
          <div className="text-5xl font-black tracking-tighter text-gradient">{value}</div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-extrabold ml-1">{subValue}</div>
        </div>
        <div className="h-28 w-5 bg-slate-100/50 dark:bg-slate-800/50 rounded-full overflow-hidden flex flex-col justify-end p-1 border border-white/20 dark:border-white/5">
          <motion.div 
            initial={{ height: 0 }}
            animate={{ height: `${progress}%` }}
            transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
            className={`w-full ${barColor} rounded-full shadow-lg`}
          />
        </div>
      </div>
      
      {/* Subtle background glow on hover */}
      <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-brand-500/5 blur-[60px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
    </div>
  );
}

function Practice({ user, isKidMode, globalSource, lang, nativeLang = 'pl' }: { user: AuthUser; isKidMode: boolean; globalSource?: TranscriptSource | null; lang: string; nativeLang?: string }) {
  const [activeSubTab, setActiveSubTab] = useState<'write' | 'translate'>('write');

  return (
    <div className="space-y-8">
      <div className="flex gap-2 p-1.5 glass rounded-2xl w-fit border border-white/20 dark:border-white/5">
        <button
          onClick={() => setActiveSubTab('write')}
          className={`px-8 py-2.5 rounded-xl text-sm font-extrabold transition-all duration-300 ${activeSubTab === 'write' ? 'bg-white dark:bg-slate-800 shadow-xl text-slate-900 dark:text-white scale-105' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
        >
          {isKidMode ? "Pisanie ✏️" : "Pisz i poprawiaj"}
        </button>
        <button 
          onClick={() => setActiveSubTab('translate')}
          className={`px-8 py-2.5 rounded-xl text-sm font-extrabold transition-all duration-300 ${activeSubTab === 'translate' ? 'bg-white dark:bg-slate-800 shadow-xl text-slate-900 dark:text-white scale-105' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
        >
          {isKidMode ? "Tłumaczenie 🪄" : "Tłumacz zdania"}
        </button>
      </div>

      {activeSubTab === 'write' ? (
        <WritePractice user={user} isKidMode={isKidMode} globalSource={globalSource} lang={lang} nativeLang={nativeLang} />
      ) : (
        <TranslatePractice user={user} isKidMode={isKidMode} globalSource={globalSource} lang={lang} nativeLang={nativeLang} />
      )}
    </div>
  );
}

function WritePractice({ user, isKidMode, globalSource: _gs, lang, nativeLang = 'pl' }: { user: AuthUser; isKidMode: boolean; globalSource?: TranscriptSource | null; lang: string; nativeLang?: string }) {
  const nll = NATIVE_LANG_NAME[nativeLang] || 'Polish';
  const [text, setText] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<any>(null);

  const check = async () => {
    if (!text.trim()) return;
    setChecking(true);
    try {
      const prompt = `You are a patient language teacher. The student wrote a text in: ${lang}.
Correct ALL errors (grammar, vocabulary, punctuation).
Score the text on a scale 0-100.
For EACH error explain in detail in ${nll}: what is wrong, why, and how it should be.
Return ONLY JSON:
{
  "corrected": "corrected text",
  "score": 85,
  "mistakes": [
    {
      "original": "wrong fragment",
      "corrected": "correct fragment",
      "explanation": "explanation in ${nll}",
      "category": "grammar|vocabulary|spelling"
    }
  ],
  "praise": "what went well (in ${nll})",
  "tip": "tip for the future (in ${nll})"
}
Student's text: "${text}"`;

      const aiText = await requestAiText(prompt, true);
      const resultData = parseAiJson<any>(aiText, { corrected: '', score: 0, mistakes: [], praise: '', tip: '' });
      setResult(resultData);

      // Save to DB
      await fetch('/api/practice/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text, 
          targetLang: lang, 
          userId: user.id,
          result: resultData
        }),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className={`text-2xl font-black tracking-tight ${isKidMode ? 'text-purple-600' : ''}`}>
        {isKidMode ? "Piszemy i poprawiamy! ✏️" : "Pisz i poprawiaj"}
      </h2>

      <div className={`glass rounded-[2.5rem] border shadow-2xl overflow-hidden transition-all duration-500 ${isKidMode ? 'border-purple-200 ring-8 ring-purple-50/30' : 'border-white/20 dark:border-white/5'}`}>
        <textarea 
          className="w-full min-h-[280px] p-10 bg-transparent outline-none resize-none text-xl leading-relaxed font-medium placeholder:text-slate-300 dark:placeholder:text-slate-600"
          placeholder={isKidMode ? "Napisz coś fajnego! Np. o swoim piesku..." : "Napisz coś w obcym języku..."}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className={`px-10 py-6 border-t flex justify-between items-center ${isKidMode ? 'bg-purple-50/50 border-purple-100' : 'bg-white/5 dark:bg-slate-800/20 border-white/10 dark:border-white/5'}`}>
          <span className="text-xs text-slate-400 font-bold tracking-widest uppercase">{text.length} znaków</span>
          <button 
            onClick={check}
            disabled={checking || !text.trim()}
            className={`px-10 py-3.5 rounded-2xl font-black shadow-2xl transition-all disabled:opacity-50 flex items-center gap-3 transform active:scale-95 ${isKidMode ? 'brand-gradient text-white' : 'brand-gradient text-white brand-shadow'}`}
          >
            {checking ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
            {isKidMode ? "Sprawdź moją pracę! ✨" : "Sprawdź tekst"}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {result && (
          <motion.div 
            initial={{ opacity: 0, y: 30 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="space-y-6"
          >
            <div className={`rounded-[2.5rem] p-10 shadow-2xl text-white transition-all ${isKidMode ? 'bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600' : 'brand-gradient'}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-3xl font-black tracking-tighter">{isKidMode ? "Wspaniale! 🌟" : "Twój wynik:"} {result.score}/100</h3>
                <div className="flex gap-1.5">
                  {[...Array(Math.ceil(result.score / 20))].map((_, i) => (
                    <Star key={i} className="h-6 w-6 fill-white drop-shadow-lg" />
                  ))}
                </div>
              </div>
              <p className="text-lg font-semibold opacity-90 leading-relaxed">{result.praise}</p>
            </div>

            <div className={`glass rounded-[2.5rem] p-10 border shadow-xl ${isKidMode ? 'border-emerald-200' : 'border-white/20 dark:border-white/5'}`}>
              <h3 className={`font-black text-xl mb-6 flex items-center gap-3 ${isKidMode ? 'text-emerald-600' : 'text-emerald-500'}`}>
                <Check className="h-6 w-6" />
                {isKidMode ? "Tak powinno być:" : "Poprawiona wersja"}
              </h3>
              <p className="text-2xl leading-relaxed font-bold tracking-tight">{result.corrected}</p>
            </div>

            {Array.isArray(result.mistakes) && result.mistakes.length > 0 && (
              <div className="grid gap-4">
                <h4 className={`text-xs font-black px-4 uppercase tracking-[0.2em] ${isKidMode ? 'text-purple-400' : 'text-slate-400'}`}>
                  {isKidMode ? "Małe poprawki:" : "Znalezione błędy:"}
                </h4>
                {result.mistakes.map((m: any, i: number) => (
                  <motion.div 
                    key={i} 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className={`glass rounded-3xl p-6 border-l-[6px] border shadow-lg ${isKidMode ? 'border-l-pink-400 border-white/20' : 'border-l-brand-500 border-white/20 dark:border-white/5'}`}
                  >
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      <span className="text-red-400 line-through text-base font-bold">{m.original}</span>
                      <ArrowRightLeft className="h-4 w-4 text-slate-300" />
                      <span className="text-emerald-500 font-black text-lg">{m.corrected}</span>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{m.explanation}</p>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TranslatePractice({ user, isKidMode, globalSource: _gs, lang, nativeLang = 'pl' }: { user: AuthUser; isKidMode: boolean; globalSource?: TranscriptSource | null; lang: string; nativeLang?: string }) {
  const nll = NATIVE_LANG_NAME[nativeLang] || 'Polish';
  const [level, setLevel] = useState('a1');
  const [topic, setTopic] = useState(PRACTICE_TOPICS[0].name);
  const [generating, setGenerating] = useState(false);
  const [currentTask, setCurrentTask] = useState<any>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<any>(null);

  const getNewTask = async () => {
    setGenerating(true);
    setResult(null);
    setUserAnswer('');
    try {
      const prompt = `You are a language teacher. Prepare a translation exercise.
Target language: ${lang}. Level: ${level}. Topic: ${topic || 'everyday situations'}.
Return ONLY JSON:
{
  "polish": "one sentence in ${nll} to be translated",
  "hint": "short hint in ${nll}"
}`;
      const aiText = await requestAiText(prompt, true);
      const data = parseAiJson<any>(aiText, {});
      setCurrentTask(data);
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const check = async () => {
    if (!userAnswer.trim()) return;
    setChecking(true);
    try {
      const prompt = `Evaluate the student's translation.
Target language: ${lang}
Base sentence in ${nll}: "${currentTask?.polish || ''}"
Student's answer: "${userAnswer}"
Level: ${level}
Return ONLY JSON:
{
  "score": 0,
  "feedback": "brief feedback in ${nll}",
  "correction": "correct version of the student's answer in the target language"
}`;
      const aiText = await requestAiText(prompt, true);
      const data = parseAiJson<any>(aiText, {});
      setResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className={`p-10 rounded-[2.5rem] border shadow-2xl space-y-8 transition-all duration-500 glass ${isKidMode ? 'border-purple-100 shadow-purple-100/50' : 'border-white/20 dark:border-white/5'}`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <select value={level} onChange={(e) => setLevel(e.target.value)} className="glass border border-white/20 dark:border-white/5 rounded-2xl px-5 py-3 outline-none font-bold text-sm focus:ring-2 focus:ring-brand-500">
            {CEFR_LEVELS.map(l => <option key={l.code} value={l.code}>{l.code.toUpperCase()} — {l.name}</option>)}
          </select>
        </div>
        <TopicSelector value={topic} onChange={setTopic} isKidMode={isKidMode} />
        <button 
          onClick={getNewTask}
          disabled={generating}
          className={`w-full py-4 rounded-[1.5rem] font-black text-lg shadow-2xl transition-all flex items-center justify-center gap-3 disabled:opacity-50 transform active:scale-[0.98] ${isKidMode ? 'brand-gradient text-white' : 'brand-gradient text-white brand-shadow'}`}
        >
          {generating ? <Loader2 className="h-6 w-6 animate-spin" /> : <Zap className="h-6 w-6" />}
          {isKidMode ? "Daj mi zadanie! ✨" : "Losuj zdanie"}
        </button>
      </div>

      {currentTask && (
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className={`p-10 rounded-[2.5rem] border shadow-xl transition-all duration-500 glass ${isKidMode ? 'border-purple-100 shadow-purple-100/50' : 'border-white/20 dark:border-white/5'}`}>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">Przetłumacz na {PRACTICE_LANGS.find(l => l.code === lang)?.name}:</p>
            <p className="text-3xl font-black tracking-tight mb-6">{currentTask.polish}</p>
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <Sparkles className="h-5 w-5 text-brand-500 shrink-0 mt-0.5" />
              <p className="text-sm text-slate-500 dark:text-slate-400 italic font-medium leading-relaxed">{currentTask.hint}</p>
            </div>
          </div>

          <div className={`glass rounded-[2.5rem] border shadow-2xl overflow-hidden transition-all duration-500 ${isKidMode ? 'border-purple-200 ring-8 ring-purple-50/30' : 'border-white/20 dark:border-white/5'}`}>
            <input 
              className="w-full p-10 bg-transparent outline-none text-2xl font-bold placeholder:text-slate-300 dark:placeholder:text-slate-600"
              placeholder="Twoje tłumaczenie..."
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && check()}
            />
            <div className={`px-10 py-6 border-t flex justify-end ${isKidMode ? 'bg-purple-50/50 border-purple-100' : 'bg-white/5 dark:bg-slate-800/20 border-white/10 dark:border-white/5'}`}>
              <button 
                onClick={check}
                disabled={checking || !userAnswer.trim()}
                className={`px-10 py-3.5 rounded-2xl font-black shadow-2xl transition-all disabled:opacity-50 flex items-center gap-3 transform active:scale-95 ${isKidMode ? 'bg-emerald-500 text-white' : 'brand-gradient text-white brand-shadow'}`}
              >
                {checking ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                Sprawdź
              </button>
            </div>
          </div>

          {result && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className={`p-10 rounded-[2.5rem] border shadow-2xl text-white ${result.score > 70 ? 'bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600' : 'bg-gradient-to-br from-orange-400 via-red-500 to-pink-600'}`}>
              <div className="flex justify-between items-center mb-6">
                <h4 className="text-4xl font-black tracking-tighter">Wynik: {result.score}/100</h4>
                <Trophy className="h-10 w-10 drop-shadow-lg" />
              </div>
              <p className="text-xl font-bold mb-8 leading-relaxed">{result.feedback}</p>
              <div className="bg-white/10 backdrop-blur-md p-8 rounded-[1.5rem] border border-white/20">
                <p className="text-[10px] uppercase font-black mb-3 opacity-70 tracking-widest">Poprawna wersja:</p>
                <p className="text-2xl font-black tracking-tight">{result.correction}</p>
              </div>
              <button onClick={getNewTask} className="mt-10 w-full py-4 bg-white text-slate-900 rounded-2xl font-black text-lg hover:bg-slate-100 transition-all shadow-xl transform active:scale-[0.98]">
                Następne zdanie
              </button>
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  );
}

function Flashcards({ user, isKidMode, lang, nativeLang = 'pl' }: { user: AuthUser; isKidMode: boolean; lang: string; nativeLang?: string }) {
  const nll = NATIVE_LANG_NAME[nativeLang] || 'Polish';
  // Card data
  const [allCards, setAllCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Generation controls
  const [generating, setGenerating] = useState(false);
  const [quickGenerating, setQuickGenerating] = useState(false);
  const [topic, setTopic] = useState(PRACTICE_TOPICS[0].name);
  const [quickPrompt, setQuickPrompt] = useState('');
  const [selectedTranscript, setSelectedTranscript] = useState<TranscriptSource | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

  // Study session state
  const [studyDeck, setStudyDeck] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [knownIds, setKnownIds] = useState<string[]>([]);

  // AI panel
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/flashcards?userId=${user.id}&lang=${lang}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) { setAllCards(data); setStudyDeck([...data]); }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user.id, lang]);

  // Navigation
  const handleNext = useCallback(() => {
    setIsFlipped(false); setAiResponse(null);
    setTimeout(() => setCurrentIndex(p => (p + 1) % studyDeck.length), 150);
  }, [studyDeck.length]);

  const handlePrev = useCallback(() => {
    setIsFlipped(false); setAiResponse(null);
    setTimeout(() => setCurrentIndex(p => (p - 1 + studyDeck.length) % studyDeck.length), 150);
  }, [studyDeck.length]);

  const handleFlip = useCallback(() => setIsFlipped(f => !f), []);

  const handleMarkAsKnown = useCallback(() => {
    if (!studyDeck.length) return;
    const card = studyDeck[currentIndex];
    setIsFlipped(false); setAiResponse(null);
    setKnownIds(prev => [...prev, card.id]);
    // Persist review to server (fire-and-forget)
    fetch('/api/flashcards', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: card.id, status: 'known', userId: user.id }),
    }).catch(() => {});
    setTimeout(() => {
      setStudyDeck(prev => {
        const next = prev.filter(c => c.id !== card.id);
        setCurrentIndex(ci => Math.min(ci, Math.max(0, next.length - 1)));
        return next;
      });
    }, 150);
  }, [studyDeck, currentIndex, user.id]);

  const handleShuffle = () => {
    setIsFlipped(false); setAiResponse(null);
    setTimeout(() => { setStudyDeck(p => [...p].sort(() => Math.random() - 0.5)); setCurrentIndex(0); }, 200);
  };

  const handleReset = () => {
    setIsFlipped(false); setAiResponse(null); setKnownIds([]);
    setTimeout(() => { setStudyDeck([...allCards]); setCurrentIndex(0); }, 200);
  };

  // Keyboard navigation
  useEffect(() => {
    if (!studyDeck.length) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') handleNext();
      else if (e.key === 'ArrowLeft') handlePrev();
      else if (e.key === 'ArrowUp') { e.preventDefault(); handleMarkAsKnown(); }
      else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleFlip(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleNext, handlePrev, handleFlip, handleMarkAsKnown, studyDeck.length]);

  // AI helper
  const callAI = async (prompt: string) => {
    setAiLoading(true); setAiResponse(null);
    try { setAiResponse(await requestAiText(prompt, false)); }
    catch { setAiResponse('Błąd AI. Spróbuj ponownie.'); }
    finally { setAiLoading(false); }
  };

  // Card generation (preserved logic)
  const generate = async () => {
    setGenerating(true); setStatusMessage('Generowanie fiszek...');
    try {
      const ctx = selectedTranscript ? `Użyj kontekstu transkrypcji "${selectedTranscript.title}": ${selectedTranscript.transcript.slice(0, 6000)}` : '';
      const prompt = `Create 12 flashcards for learning ${lang} on the topic: ${topic || 'everyday situations'}.\n${ctx}\nReturn ONLY JSON (array):\n[{ "front": "word or phrase in ${lang}", "back": "translation in ${nll}" }]`;
      const cardsData = parseAiJson<any[]>(await requestAiText(prompt, true), []);
      const saveRes = await fetch('/api/flashcards/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, lang, cards: cardsData, transcriptSourceId: selectedTranscript?.id || null }) });
      const data = await saveRes.json();
      if (!saveRes.ok) { setStatusMessage(data?.error || 'Błąd zapisu.'); }
      else if (Array.isArray(data.flashcards)) {
        setAllCards(prev => [...data.flashcards, ...prev]);
        setStudyDeck(prev => [...data.flashcards, ...prev]);
        setTopic(''); setStatusMessage(`Dodano ${data.flashcards.length} nowych fiszek.`);
      } else setStatusMessage('AI zwróciło niepoprawne dane.');
    } catch { setStatusMessage('Błąd generowania fiszek.'); }
    finally { setGenerating(false); }
  };

  const generateOnDemand = async () => {
    if (!quickPrompt.trim()) return;
    setQuickGenerating(true); setStatusMessage('Generowanie fiszek na zawołanie...');
    try {
      const ctx = selectedTranscript ? `Użyj kontekstu transkrypcji "${selectedTranscript.title}": ${selectedTranscript.transcript.slice(0, 6000)}` : '';
      const prompt = `Based on the instruction, generate 3 flashcards for learning ${lang}.\nInstruction: "${quickPrompt}".\n${ctx}\nReturn ONLY JSON (array):\n[{ "front": "word or phrase in ${lang}", "back": "translation in ${nll}" }]`;
      const cardsData = parseAiJson<any[]>(await requestAiText(prompt, true), []).filter((c: any) => c?.front && c?.back);
      if (!cardsData.length) { setStatusMessage('Brak fiszek w odpowiedzi AI.'); return; }
      const saveRes = await fetch('/api/flashcards/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, lang, cards: cardsData, transcriptSourceId: selectedTranscript?.id || null }) });
      const data = await saveRes.json();
      if (saveRes.ok && Array.isArray(data.flashcards)) {
        setAllCards(prev => [...data.flashcards, ...prev]);
        setStudyDeck(prev => [...data.flashcards, ...prev]);
        setQuickPrompt(''); setStatusMessage(`Dodano ${data.flashcards.length} fiszki.`);
      } else setStatusMessage(data?.error || 'Błąd zapisu.');
    } catch { setStatusMessage('Błąd generowania fiszek.'); }
    finally { setQuickGenerating(false); }
  };

  const currentCard = studyDeck[currentIndex];
  const langName = PRACTICE_LANGS.find(l => l.code === (currentCard?.lang || lang))?.name || lang;
  const knownPct = allCards.length > 0 ? (knownIds.length / allCards.length) * 100 : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <h2 className={`text-2xl font-black tracking-tight ${isKidMode ? 'text-purple-600' : ''}`}>
          {isKidMode ? "Twoje Magiczne Karty 🃏" : "Twoje Fiszki"}
        </h2>
        <div className="flex gap-3">
          <button onClick={generate} disabled={generating} className={`px-8 py-3 rounded-2xl text-sm font-black shadow-2xl transition-all flex items-center gap-3 transform active:scale-95 ${isKidMode ? 'brand-gradient text-white' : 'brand-gradient text-white brand-shadow'}`}>
            {generating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
            {isKidMode ? "Wyrysuj nowe karty! ✨" : "Generuj nowe"}
          </button>
        </div>
      </div>

      {/* Config panel */}
      <div className="glass rounded-[2.5rem] p-10 border border-white/20 dark:border-white/5 shadow-2xl">
        <TranscriptPicker userId={user.id} lang={lang} selectedId={selectedTranscript?.id || null} onSelect={setSelectedTranscript} />
        <div className="mb-8 space-y-3">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Generuj na zawołanie</label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input value={quickPrompt} onChange={(e) => setQuickPrompt(e.target.value)} placeholder="Np. podróż pociągiem, rozmowa u lekarza, czasowniki nieregularne..." className="flex-1 bg-white/50 dark:bg-slate-900/50 border border-white/20 dark:border-white/5 rounded-2xl px-5 py-3.5 outline-none font-semibold" />
            <button onClick={generateOnDemand} disabled={quickGenerating || !quickPrompt.trim()} className={`px-6 py-3.5 rounded-2xl font-black shadow-xl transition-all disabled:opacity-50 ${isKidMode ? 'bg-purple-500 text-white' : 'brand-gradient text-white'}`}>
              {quickGenerating ? "Generuję..." : "Generuj 3 fiszki"}
            </button>
          </div>
        </div>
        <TopicSelector value={topic} onChange={setTopic} isKidMode={isKidMode} disabled={!!selectedTranscript} transcriptTitle={selectedTranscript?.title} />
        {statusMessage && <p className="mt-4 text-sm font-bold text-brand-500">{statusMessage}</p>}
      </div>

      {/* Study area */}
      {loading ? (
        <div className="h-72 glass animate-pulse rounded-[3rem]" />
      ) : allCards.length === 0 ? (
        <div className="text-center py-32 glass rounded-[3rem] border-2 border-dashed border-slate-200/60 dark:border-slate-800/60">
          <Layers className="h-16 w-16 text-slate-300 mx-auto mb-6 opacity-20" />
          <p className="text-slate-500 font-bold text-xl">Nie masz jeszcze żadnych kart. Kliknij "Generuj nowe"!</p>
        </div>
      ) : studyDeck.length === 0 ? (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className={`p-12 rounded-[3rem] border shadow-2xl text-center glass ${isKidMode ? 'border-purple-100' : 'border-white/20 dark:border-white/5'}`}>
          <Trophy className={`h-20 w-20 mx-auto mb-6 drop-shadow-[0_0_20px_rgba(234,179,8,0.4)] ${isKidMode ? 'text-purple-500' : 'text-yellow-500'}`} />
          <h3 className="text-3xl font-black tracking-tight mb-4">{isKidMode ? "Brawo! Znasz wszystko! 🎉" : "Znasz wszystkie karty! 🎉"}</h3>
          <p className="text-slate-500 font-semibold mb-8">Opanowałeś {knownIds.length} fiszek w tej sesji.</p>
          <button onClick={handleReset} className={`px-10 py-4 rounded-2xl font-black text-lg shadow-2xl inline-flex items-center gap-2 ${isKidMode ? 'brand-gradient text-white' : 'brand-gradient text-white brand-shadow'}`}>
            <RotateCcw className="h-5 w-5" /> Zacznij od nowa
          </button>
        </motion.div>
      ) : (
        <div className="space-y-6">
          {/* Progress */}
          <div>
            <div className="flex justify-between text-xs font-semibold text-slate-400 mb-2">
              <span>Karta {currentIndex + 1} z {studyDeck.length} · opanowano {knownIds.length}/{allCards.length}</span>
              <span>{Math.round(knownPct)}%</span>
            </div>
            <div className="w-full bg-slate-200/60 dark:bg-slate-800/60 rounded-full h-2 overflow-hidden">
              <div className="bg-emerald-500 h-2 transition-all duration-300" style={{ width: `${knownPct}%` }} />
            </div>
          </div>

          {/* 3D Flip Card */}
          <div className="relative w-full h-72 sm:h-80 cursor-pointer select-none" style={{ perspective: '1000px' }} onClick={handleFlip}>
            <div className="w-full h-full relative transition-transform duration-500 ease-in-out" style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
              {/* Front */}
              <div className={`absolute inset-0 rounded-[2.5rem] border-2 shadow-2xl flex flex-col items-center justify-center p-8 glass ${isKidMode ? 'border-purple-100' : 'border-white/20 dark:border-white/5'}`} style={{ backfaceVisibility: 'hidden' }}>
                <Badge variant="outline" className="mb-4 text-[10px] uppercase tracking-[0.2em] font-black opacity-40">{currentCard.lang}</Badge>
                <p className={`text-4xl sm:text-5xl font-black tracking-tight text-center leading-tight ${isKidMode ? 'text-purple-600' : 'text-slate-900 dark:text-white'}`}>{currentCard.front}</p>
                <p className="absolute bottom-5 text-slate-400 text-xs font-semibold animate-pulse">Kliknij aby obrócić · Spacja</p>
              </div>
              {/* Back */}
              <div className="absolute inset-0 rounded-[2.5rem] shadow-2xl flex flex-col items-center justify-center p-8 text-white brand-gradient" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                <p className="text-3xl sm:text-4xl font-black tracking-tight text-center leading-tight drop-shadow-lg">{currentCard.back}</p>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            <button onClick={handlePrev} title="Poprzednia (←)" className="p-4 rounded-full glass border border-white/20 dark:border-white/10 hover:border-brand-500/40 transition-all shadow-sm active:scale-95">
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button onClick={handleMarkAsKnown} title="Umiem to! (↑)" className="flex items-center gap-2 px-6 py-4 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 font-black shadow-sm hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-all active:scale-95">
              <Check className="h-5 w-5" /><span className="hidden sm:inline">Umiem to!</span>
            </button>
            <button onClick={handleShuffle} title="Tasuj" className="flex items-center gap-2 px-5 py-4 rounded-full glass border border-white/20 dark:border-white/10 hover:border-brand-500/40 font-semibold transition-all shadow-sm active:scale-95">
              <Shuffle className="h-5 w-5" /><span className="hidden lg:inline text-sm">Tasuj</span>
            </button>
            <button onClick={handleReset} title="Resetuj sesję" className="flex items-center gap-2 px-5 py-4 rounded-full glass border border-white/20 dark:border-white/10 hover:border-red-400/40 text-red-500 font-semibold transition-all shadow-sm active:scale-95">
              <RotateCcw className="h-5 w-5" /><span className="hidden lg:inline text-sm">Resetuj</span>
            </button>
            <button onClick={handleNext} title="Następna (→)" className="p-4 rounded-full glass border border-white/20 dark:border-white/10 hover:border-brand-500/40 transition-all shadow-sm active:scale-95">
              <ChevronRight className="h-6 w-6" />
            </button>
          </div>
          <p className="text-center text-xs text-slate-400 font-medium">← → nawigacja · ↑ umiem to! · Spacja / Enter — odwróć</p>

          {/* AI Panel */}
          <div className={`glass rounded-[2rem] p-6 border shadow-xl space-y-4 ${isKidMode ? 'border-purple-100' : 'border-white/20 dark:border-white/5'}`}>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Asystent AI — {currentCard.front}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button onClick={() => callAI(`Write one new sentence in ${langName} using: "${currentCard.front}". Below it, provide the translation in ${nll}. Keep it short and clear.`)} disabled={aiLoading} className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 font-semibold text-sm hover:bg-indigo-100 transition-all disabled:opacity-50 active:scale-95">
                <Sparkles className="h-4 w-4 shrink-0" />Przykład
              </button>
              <button onClick={() => callAI(`Briefly explain in ${nll} the grammatical and semantic nuances of "${currentCard.front}" in ${langName}. What do learners typically find difficult?`)} disabled={aiLoading} className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-500/30 font-semibold text-sm hover:bg-purple-100 transition-all disabled:opacity-50 active:scale-95">
                <BookOpen className="h-4 w-4 shrink-0" />Gramatyka
              </button>
              <button onClick={() => callAI(`Create a short, fun mnemonic in ${nll} to help remember "${currentCard.front}" (${currentCard.back}).`)} disabled={aiLoading} className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 font-semibold text-sm hover:bg-amber-100 transition-all disabled:opacity-50 active:scale-95">
                <Brain className="h-4 w-4 shrink-0" />Pamięć
              </button>
              <button onClick={() => callAI(`Generate a short A/B/C quiz question in ${nll} testing knowledge of "${currentCard.front}" in ${langName}. At the end give the correct answer.`)} disabled={aiLoading} className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 font-semibold text-sm hover:bg-emerald-100 transition-all disabled:opacity-50 active:scale-95">
                <HelpCircle className="h-4 w-4 shrink-0" />Quiz
              </button>
            </div>
            {(aiLoading || aiResponse) && (
              <div className="relative bg-white/50 dark:bg-slate-900/50 rounded-2xl p-5 border border-white/20 dark:border-white/5">
                {aiResponse && !aiLoading && (
                  <button onClick={() => setAiResponse(null)} className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                )}
                <div className="flex items-start gap-3">
                  <div className="bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/40 dark:to-purple-900/40 p-2 rounded-xl shrink-0">
                    <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="flex-1 text-sm leading-relaxed whitespace-pre-wrap pt-0.5 pr-6">
                    {aiLoading ? (
                      <span className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold">
                        <Loader2 className="h-4 w-4 animate-spin" />Generowanie...
                      </span>
                    ) : aiResponse}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Badge({ children, variant = 'default', className = '' }: { children: React.ReactNode, variant?: 'default' | 'outline', className?: string }) {
  const base = "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300";
  const variants = {
    default: "glass bg-brand-500/10 text-brand-500 border-brand-500/20",
    outline: "glass border-white/20 text-slate-500 dark:text-slate-400"
  };
  return <span className={`${base} ${variants[variant]} ${className}`}>{children}</span>;
}

function Vocabulary({ user, isKidMode, lang, nativeLang: _nativeLang = 'pl' }: { user: AuthUser; isKidMode: boolean; lang: string; nativeLang?: string }) {
  const [words, setWords] = useState<any[]>([]);
  const [newWord, setNewWord] = useState('');
  const [newTrans, setNewTrans] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetch(`/api/vocabulary?userId=${user.id}&lang=${lang}`)
      .then(res => res.json())
      .then(setWords)
      .finally(() => setLoading(false));
  }, [user.id, lang]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWord.trim() || !newTrans.trim()) return;
    setAdding(true);
    try {
      const res = await fetch('/api/vocabulary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: newWord, translation: newTrans, lang, userId: user.id }),
      });
      const data = await res.json();
      setWords([data, ...words]);
      setNewWord('');
      setNewTrans('');
    } finally {
      setAdding(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await fetch(`/api/vocabulary/${id}`, { method: 'DELETE' });
      setWords(words.filter(w => w.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className={`text-2xl font-black tracking-tight ${isKidMode ? 'text-purple-600' : ''}`}>
          {isKidMode ? "Twój Słowniczek 📖" : "Twoje Słówka"}
        </h2>
      </div>

      <form onSubmit={add} className={`p-8 rounded-[2.5rem] border shadow-2xl flex flex-col lg:flex-row gap-4 transition-all duration-500 glass ${isKidMode ? 'border-purple-100 shadow-purple-100/50' : 'border-white/20 dark:border-white/5'}`}>
        <div className="flex-1 relative group">
          <input 
            className="w-full bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl px-6 py-3 outline-none font-black text-lg focus:ring-2 focus:ring-brand-500 transition-all"
            placeholder={isKidMode ? "Nowe słówko..." : "Słówko..."}
            value={newWord}
            onChange={(e) => setNewWord(e.target.value)}
          />
        </div>
        <div className="flex-1 relative group">
          <input 
            className="w-full bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl px-6 py-3 outline-none font-bold text-lg focus:ring-2 focus:ring-brand-500 transition-all"
            placeholder={isKidMode ? "Co to znaczy?" : "Tłumaczenie..."}
            value={newTrans}
            onChange={(e) => setNewTrans(e.target.value)}
          />
        </div>
        <button 
          disabled={adding || !newWord.trim() || !newTrans.trim()}
          className={`px-10 py-3.5 rounded-2xl font-black shadow-2xl transition-all flex items-center justify-center gap-3 disabled:opacity-50 transform active:scale-95 ${isKidMode ? 'brand-gradient text-white' : 'brand-gradient text-white brand-shadow'}`}
        >
          {adding ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
          {isKidMode ? "Dodaj! ✨" : "Dodaj"}
        </button>
      </form>

      {loading ? (
        <div className="grid gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-20 glass animate-pulse rounded-3xl" />)}
        </div>
      ) : words.length === 0 ? (
        <div className="text-center py-32 glass rounded-[3rem] border-2 border-dashed border-slate-200/60 dark:border-slate-800/60">
          <BookOpen className="h-16 w-16 text-slate-300 mx-auto mb-6 opacity-20" />
          <p className="text-slate-500 font-bold text-xl">Twój słownik jest pusty. Dodaj pierwsze słówko!</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {words.map((w, i) => (
            <motion.div 
              key={w.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className={`p-6 rounded-3xl border shadow-lg flex items-center justify-between group transition-all duration-300 glass hover:shadow-2xl hover:-translate-y-1 ${isKidMode ? 'border-purple-50 hover:border-purple-200' : 'border-white/20 dark:border-white/5'}`}
            >
              <div className="flex items-center gap-6">
                <div className={`h-14 w-14 rounded-2xl flex items-center justify-center font-black text-2xl shadow-inner ${isKidMode ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                  {w.word[0].toUpperCase()}
                </div>
                <div>
                  <h4 className="font-black text-xl tracking-tight">{w.word}</h4>
                  <p className="text-slate-500 dark:text-slate-400 font-semibold">{w.translation}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Badge variant="outline" className="opacity-50">{w.lang}</Badge>
                <button 
                  onClick={() => remove(w.id)}
                  className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
function Translator({ user, isKidMode, globalLang, nativeLang = 'pl' }: { user: AuthUser; isKidMode: boolean; globalLang: string; nativeLang?: string }) {
  const [sourceText, setSourceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [sourceLang, setSourceLang] = useState(nativeLang);
  const [targetLang, setTargetLang] = useState(globalLang);
  const [level, setLevel] = useState('none');
  const [style, setStyle] = useState('none');
  const [loading, setLoading] = useState(false);

  const translate = async () => {
    if (!sourceText.trim()) return;
    setLoading(true);
    try {
      const prompt = `Jesteś profesjonalnym tłumaczem AI. Tłumacz z pełną precyzją i naturalnością.
ZASADY: Tłumacz TYLKO tekst. Zwróć SAMO tłumaczenie, nic więcej.
Poziom CEFR: ${level || 'none'}
Styl: ${style || 'none'}
Przetłumacz z ${sourceLang} na ${targetLang}: "${sourceText}"`;

      const translation = await requestAiText(prompt, false);
      setTranslatedText(translation);

      // Save to DB
      await fetch('/api/translate/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sourceText, 
          sourceLang, 
          targetLang, 
          level, 
          style, 
          userId: user.id,
          translation
        }),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className={`text-2xl font-black tracking-tight ${isKidMode ? 'text-purple-600' : ''}`}>
          {isKidMode ? "Magiczny Tłumacz 🪄" : "Tłumacz AI"}
        </h2>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4">
        <select 
          value={sourceLang} 
          onChange={(e) => setSourceLang(e.target.value)} 
          className="glass border border-white/20 dark:border-white/5 rounded-2xl px-6 py-4 flex-1 text-sm font-bold outline-none shadow-sm focus:ring-2 focus:ring-brand-500"
        >
          {PRACTICE_LANGS.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
        </select>
        
        <button 
          onClick={() => { setSourceLang(targetLang); setTargetLang(sourceLang); }}
          className="p-4 glass rounded-full border border-white/20 dark:border-white/5 shadow-xl transition-all transform active:rotate-180 hover:scale-110"
        >
          <ArrowRightLeft className="h-6 w-6 text-brand-500" />
        </button>

        <select 
          value={targetLang} 
          onChange={(e) => setTargetLang(e.target.value)} 
          className="glass border border-white/20 dark:border-white/5 rounded-2xl px-6 py-4 flex-1 text-sm font-bold outline-none shadow-sm focus:ring-2 focus:ring-brand-500"
        >
          {PRACTICE_LANGS.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
        </select>
      </div>

      <div className="flex gap-4">
        <select value={level} onChange={(e) => setLevel(e.target.value)} className="flex-1 glass border border-white/20 dark:border-white/5 rounded-2xl px-5 py-3 text-xs font-bold outline-none shadow-sm focus:ring-2 focus:ring-brand-500">
          <option value="none">Dowolny poziom</option>
          {CEFR_LEVELS.map(l => <option key={l.code} value={l.code}>{l.code.toUpperCase()} — {l.name}</option>)}
        </select>
        <select value={style} onChange={(e) => setStyle(e.target.value)} className="flex-1 glass border border-white/20 dark:border-white/5 rounded-2xl px-5 py-3 text-xs font-bold outline-none shadow-sm focus:ring-2 focus:ring-brand-500">
          {TRANSLATION_STYLES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <div className={`rounded-[2.5rem] border shadow-2xl p-10 transition-all glass ${isKidMode ? 'border-purple-100' : 'border-white/20 dark:border-white/5'}`}>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6 opacity-50">Tekst źródłowy</div>
          <textarea 
            className="w-full min-h-[220px] bg-transparent outline-none resize-none text-2xl font-black tracking-tight leading-relaxed placeholder:text-slate-300 dark:placeholder:text-slate-700"
            placeholder={isKidMode ? "Wpisz coś, co chcesz przetłumaczyć..." : "Wpisz tekst..."}
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
          />
        </div>
        <div className={`rounded-[2.5rem] border shadow-2xl p-10 relative transition-all min-h-[220px] glass ${isKidMode ? 'border-emerald-100' : 'border-white/20 dark:border-white/5'}`}>
          <div className={`text-[10px] font-black uppercase tracking-[0.2em] mb-6 opacity-50 ${isKidMode ? 'text-emerald-400' : 'text-slate-400'}`}>Tłumaczenie</div>
          {loading ? (
            <div className="space-y-6">
              <div className="h-8 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-xl w-3/4" />
              <div className="h-8 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-xl w-1/2" />
            </div>
          ) : (
            <motion.p 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }}
              className={`text-2xl font-black tracking-tight leading-relaxed ${isKidMode ? 'text-emerald-600' : 'text-slate-900 dark:text-white'}`}
            >
              {translatedText || (isKidMode ? 'Tu pojawi się magia! ✨' : 'Tłumaczenie pojawi się tutaj...')}
            </motion.p>
          )}
        </div>
      </div>

      <button 
        onClick={translate}
        disabled={loading || !sourceText.trim()}
        className={`w-full py-6 rounded-[2rem] font-black text-xl shadow-2xl transition-all flex items-center justify-center gap-4 transform active:scale-[0.98] disabled:opacity-50 ${isKidMode ? 'brand-gradient text-white' : 'brand-gradient text-white brand-shadow'}`}
      >
        {loading ? <Loader2 className="h-7 w-7 animate-spin" /> : isKidMode ? <Sparkles className="h-7 w-7" /> : <Send className="h-7 w-7" />}
        {isKidMode ? "Abrakadabra! Tłumacz! ✨" : "Przetłumacz teraz"}
      </button>
    </div>
  );
}

function Reading({ user, isKidMode, globalSource, lang, nativeLang = 'pl' }: { user: AuthUser; isKidMode: boolean; globalSource?: TranscriptSource | null; lang: string; nativeLang?: string }) {
  const [level, setLevel] = useState('a1');
  const [topic, setTopic] = useState(PRACTICE_TOPICS[0].name);
  const [sentenceCount, setSentenceCount] = useState(10);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [hoveredWord, setHoveredWord] = useState<{ word: string, translation: string | null, x: number, y: number } | null>(null);
  const [expandedSentences, setExpandedSentences] = useState<Record<number, boolean>>({});
  const [selectedTranscript, setSelectedTranscript] = useState<TranscriptSource | null>(globalSource || null);
  const hoverTimeout = useRef<any>(null);
  const isTranslating = useRef<boolean>(false);
  const hoverRequestId = useRef(0);

  const speak = (text: string, language: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    window.speechSynthesis.speak(utterance);
  };

  const nll = NATIVE_LANG_NAME[nativeLang] || 'Polish';

  const translateWord = async (word: string, sentenceContext?: string) => {
    try {
      const quick = await translateWordQuick(word, lang, nativeLang, sentenceContext);
      if (quick) return quick;
      const ctx = sentenceContext ? `Sentence context: "${sentenceContext}"\n` : '';
      const prompt = `${ctx}Translate the word "${word}" from language "${lang}" to ${nll}. Reply ONLY with the contextual translation.`;
      const responseText = await requestAiText(prompt, false);
      return responseText.trim() || null;
    } catch (err) {
      return null;
    }
  };

  const handleWordMouseEnter = (word: string, e: React.MouseEvent, sentenceContext?: string) => {
    const x = e.clientX;
    const y = e.clientY;

    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);

    hoverTimeout.current = setTimeout(async () => {
      if (isTranslating.current) return;

      const cleanWord = word.replace(/[.,!?;:]/g, '').trim();
      if (!cleanWord) return;
      const requestId = ++hoverRequestId.current;
      const normalizedWord = cleanWord.toLowerCase();

      // Check if word is in vocabulary first
      const vocabMatch = result?.vocabulary?.find((v: any) =>
        typeof v?.word === 'string' && v.word.toLowerCase() === normalizedWord
      );

      if (vocabMatch) {
        if (hoverRequestId.current === requestId) {
          setHoveredWord({ word: cleanWord, translation: vocabMatch.translation, x, y });
        }
      } else {
        isTranslating.current = true;
        const ctx = sentenceContext ? `Sentence context: "${sentenceContext}"\n` : '';
        const aiPromise = requestAiText(`${ctx}Translate the word "${cleanWord}" from language "${lang}" to ${nll}. Preserve part of speech (verb→verb, noun→noun). Reply ONLY with the translation.`, false);
        const quick = await translateWordQuick(cleanWord, lang, nativeLang, sentenceContext);
        if (quick && hoverRequestId.current === requestId) setHoveredWord({ word: cleanWord, translation: quick, x, y });
        try {
          const accurate = (await aiPromise).trim();
          if (hoverRequestId.current === requestId) setHoveredWord({ word: cleanWord, translation: accurate || quick, x, y });
        } catch { /* keep quick result if AI fails */ }
        isTranslating.current = false;
      }
    }, 300);
  };

  const handleWordMouseLeave = () => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    hoverRequestId.current += 1;
    setHoveredWord(null);
  };

  const generate = async () => {
    setGenerating(true);
    setExpandedSentences({});
    try {
      const transcriptContext = selectedTranscript
        ? `Bazuj na transkrypcji "${selectedTranscript.title}": ${selectedTranscript.transcript.slice(0, 8000)}.`
        : '';
      const prompt = `You are a language teacher. Create a reading text in: ${lang}.
Level: ${level}.
Topic: ${topic || 'any interesting topic'}.
Number of sentences: ${sentenceCount}.
${transcriptContext}
Return ONLY JSON:
{
  "title": "text title",
  "sentences": [
    {"original": "sentence in the foreign language", "translation": "translation in ${nll}"}
  ],
  "vocabulary": [
    {"word": "word", "translation": "translation in ${nll}", "context": "sentence from the text"}
  ],
  "questions": [
    {"question": "question in ${nll}", "answer": "answer in ${nll}"}
  ]
}`;

      const aiText = await requestAiText(prompt, true);
      const data = parseAiJson<any>(aiText, {});
      setResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className={`text-3xl font-black tracking-tight ${isKidMode ? 'text-purple-600' : 'text-gradient'}`}>
          {isKidMode ? "Magiczne Opowieści 📚" : "Czytanie i Rozumienie"}
        </h2>
      </div>

      <div className={`p-10 rounded-[3rem] glass space-y-8 transition-all ${isKidMode ? 'border-purple-100 shadow-purple-100/50' : ''}`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          <div className="space-y-3">
            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 ml-1">Poziom</label>
            <select value={level} onChange={(e) => setLevel(e.target.value)} className="w-full bg-white/50 dark:bg-slate-950/50 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl px-5 py-3.5 outline-none focus:ring-2 focus:ring-brand-500 transition-all font-semibold">
              {CEFR_LEVELS.map(l => <option key={l.code} value={l.code}>{l.code.toUpperCase()} — {l.name}</option>)}
            </select>
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 ml-1">Liczba zdań</label>
            <select value={sentenceCount} onChange={(e) => setSentenceCount(Number(e.target.value))} className="w-full bg-white/50 dark:bg-slate-950/50 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl px-5 py-3.5 outline-none focus:ring-2 focus:ring-brand-500 transition-all font-semibold">
              {[5, 10, 15, 20, 30].map(n => <option key={n} value={n}>{n} zdań</option>)}
            </select>
          </div>
        </div>
        <TranscriptPicker
          userId={user.id}
          lang={lang}
          selectedId={selectedTranscript?.id || null}
          onSelect={setSelectedTranscript}
        />
        <TopicSelector value={topic} onChange={setTopic} isKidMode={isKidMode} disabled={!!selectedTranscript} transcriptTitle={selectedTranscript?.title} />
        <button
          onClick={generate}
          disabled={generating}
          className={`w-full py-5 rounded-2xl font-bold shadow-2xl transition-all flex items-center justify-center gap-3 disabled:opacity-50 active:scale-[0.98] ${isKidMode ? 'bg-purple-500 text-white' : 'brand-gradient brand-shadow text-white'}`}
        >
          {generating ? <Loader2 className="h-6 w-6 animate-spin" /> : <Sparkles className="h-6 w-6" />}
          <span className="text-lg">{isKidMode ? "Wyrysuj opowieść! ✨" : "Generuj tekst"}</span>
        </button>
      </div>

      {result && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-10">
          <div className={`p-10 rounded-[3rem] border shadow-2xl transition-all relative glass ${isKidMode ? 'border-purple-100 shadow-purple-100/50' : 'border-white/20 dark:border-white/5'}`}>
            <h3 className="text-3xl font-black mb-12 text-center tracking-tight">{result.title}</h3>
            
            <div className="space-y-6">
              {result.sentences?.map((item: any, si: number) => (
                <div key={si} className="group border-b border-white/10 dark:border-white/5 pb-6 last:border-0">
                  <div 
                    className="flex items-start gap-6 cursor-pointer"
                    onClick={() => setExpandedSentences(prev => ({ ...prev, [si]: !prev[si] }))}
                  >
                    <div className="mt-2.5">
                      <div className={`w-3 h-3 rounded-full ${isKidMode ? 'bg-purple-400 shadow-[0_0_15px_rgba(192,132,252,0.5)]' : 'bg-brand-500 shadow-[0_0_15px_rgba(249,115,22,0.5)]'} ${expandedSentences[si] ? 'scale-150' : 'scale-100'} transition-all duration-300`} />
                    </div>
                    <div className="flex-1">
                      <div className="text-2xl font-bold tracking-tight leading-relaxed">
                        {item.original.split(' ').map((word: string, wi: number) => (
                          <span
                            key={wi}
                            className="hover:text-brand-500 cursor-pointer transition-colors inline-block mr-1.5"
                            onClick={(e) => {
                              e.stopPropagation();
                              speak(word.replace(/[.,!?;:]/g, ''), lang);
                            }}
                            onMouseEnter={(e) => handleWordMouseEnter(word, e, item.original)}
                            onMouseLeave={handleWordMouseLeave}
                          >
                            {word}
                          </span>
                        ))}
                      </div>

                      <AnimatePresence>
                        {expandedSentences[si] && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <p className="text-lg text-slate-500 dark:text-slate-400 mt-4 font-bold italic tracking-tight">
                              {item.translation}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    
                    <button 
                      className={`p-3 rounded-xl transition-all ${expandedSentences[si] ? 'bg-white/10 dark:bg-white/5' : 'opacity-0 group-hover:opacity-100 hover:bg-white/10'}`}
                    >
                      <Languages className="h-5 w-5 text-slate-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Word Tooltip */}
            <AnimatePresence>
              {hoveredWord && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 10 }}
                  style={{ position: 'fixed', left: hoveredWord.x, top: hoveredWord.y - 50 }}
                  className="z-50 glass bg-slate-900/90 text-white px-5 py-2.5 rounded-2xl shadow-2xl text-base font-black tracking-tight pointer-events-none border border-white/20"
                >
                  {hoveredWord.translation || '...'}
                </motion.div>
              )}
            </AnimatePresence>

          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <h4 className="text-xl font-black flex items-center gap-3 tracking-tight"><BookOpen className="h-6 w-6 text-brand-500" /> Słowniczek</h4>
              <div className="grid gap-4">
                {result.vocabulary.map((v: any, i: number) => (
                  <div key={i} className="p-6 glass rounded-[1.5rem] border border-white/10 dark:border-white/5 shadow-xl hover:shadow-2xl transition-all group">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-black text-xl text-brand-500 tracking-tight">{v.word}</span>
                      <span className="text-sm font-bold text-slate-400">{v.translation}</span>
                    </div>
                    <p className="text-xs italic text-slate-500 font-medium leading-relaxed">{v.context}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-6">
              <h4 className="text-xl font-black flex items-center gap-3 tracking-tight"><Check className="h-6 w-6 text-emerald-500" /> Sprawdź się</h4>
              <div className="grid gap-4">
                {result.questions.map((q: any, i: number) => (
                  <div key={i} className="p-6 glass rounded-[1.5rem] border border-white/10 dark:border-white/5 shadow-xl">
                    <p className="text-lg font-black mb-4 tracking-tight leading-snug">{q.question}</p>
                    <details className="text-sm text-slate-500 cursor-pointer group">
                      <summary className="hover:text-brand-500 transition-colors font-bold list-none flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                        Pokaż odpowiedź
                      </summary>
                      <p className="mt-4 p-5 glass bg-white/5 dark:bg-black/20 rounded-2xl font-bold text-slate-700 dark:text-slate-300 border border-white/10">
                        {q.answer}
                      </p>
                    </details>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function Sentences({ user, isKidMode, globalSource, lang, nativeLang = 'pl' }: { user: AuthUser; isKidMode: boolean; globalSource?: TranscriptSource | null; lang: string; nativeLang?: string }) {
  const nll = NATIVE_LANG_NAME[nativeLang] || 'Polish';
  const [level, setLevel] = useState('a1');
  const [topic, setTopic] = useState(PRACTICE_TOPICS[0].name);
  const [generating, setGenerating] = useState(false);
  const [sentences, setSentences] = useState<any[]>([]);
  const [showTranslations, setShowTranslations] = useState(true);
  const [selectedTranscript, setSelectedTranscript] = useState<TranscriptSource | null>(globalSource || null);
  const [hoveredWord, setHoveredWord] = useState<{ word: string; translation: string | null; x: number; y: number } | null>(null);
  const hoverTimeout = useRef<any>(null);
  const hoverRequestId = useRef(0);
  const isTranslating = useRef(false);

  const speak = (text: string) => {
    if (!window.speechSynthesis) return;
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = lang;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utt);
  };

  const handleWordMouseEnter = (word: string, e: React.MouseEvent, sentenceContext?: string) => {
    const x = e.clientX;
    const y = e.clientY;
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    hoverTimeout.current = setTimeout(async () => {
      if (isTranslating.current) return;
      const clean = word.replace(/[.,!?;:"""„]/g, '').trim();
      if (!clean) return;
      const reqId = ++hoverRequestId.current;
      isTranslating.current = true;
      try {
        const ctx = sentenceContext ? `Sentence context: "${sentenceContext}"\n` : '';
        const aiPromise = requestAiText(`${ctx}Translate the word "${clean}" from language "${lang}" to ${nll}. Preserve part of speech (verb→verb, noun→noun). Reply ONLY with the translation.`, false);
        const quick = await translateWordQuick(clean, lang, nativeLang, sentenceContext);
        if (quick && hoverRequestId.current === reqId) setHoveredWord({ word: clean, translation: quick, x, y });
        const accurate = (await aiPromise).trim();
        if (hoverRequestId.current === reqId) setHoveredWord({ word: clean, translation: accurate || quick, x, y });
      } catch {
        if (hoverRequestId.current === reqId) setHoveredWord({ word: clean, translation: null, x, y });
      } finally {
        isTranslating.current = false;
      }
    }, 350);
  };

  const handleWordMouseLeave = () => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    hoverRequestId.current++;
    setHoveredWord(null);
  };

  const generate = async () => {
    setGenerating(true);
    try {
      const transcriptContext = selectedTranscript
        ? `Bazuj na transkrypcji "${selectedTranscript.title}": ${selectedTranscript.transcript.slice(0, 8000)}.`
        : '';
      const prompt = `You are a language teacher. Create 10 interesting sentences in: ${lang}.
Level: ${level}.
Topic: ${topic || 'everyday situations'}.
${transcriptContext}
Return ONLY JSON (array of objects):
[
  {"original": "sentence", "translation": "translation in ${nll}", "explanation": "short grammar explanation in ${nll}"}
]`;
      const aiText = await requestAiText(prompt, true);
      const data = parseAiJson<any[]>(aiText, []);
      setSentences(data);
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className={`text-xl sm:text-2xl font-black tracking-tight ${isKidMode ? 'text-purple-600' : ''}`}>
          {isKidMode ? "Zabawa ze Zdaniami! 💬" : "Budowanie Zdań"}
        </h2>
        <button
          onClick={() => setShowTranslations(!showTranslations)}
          className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-2xl text-xs font-black transition-all glass border ${showTranslations ? 'bg-brand-500/10 text-brand-500 border-brand-500/20' : 'bg-white/5 text-slate-500 border-white/10'}`}
        >
          {showTranslations ? "Ukryj tłumaczenia" : "Pokaż tłumaczenia"}
        </button>
      </div>

      <div className={`p-5 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border shadow-2xl space-y-6 glass ${isKidMode ? 'border-purple-100 shadow-purple-100/50' : 'border-white/20 dark:border-white/5'}`}>
        <div className="grid grid-cols-1 gap-4">
          <select value={level} onChange={(e) => setLevel(e.target.value)} className="glass border border-white/20 dark:border-white/5 rounded-2xl px-4 py-3 outline-none font-bold text-sm focus:ring-2 focus:ring-brand-500">
            {CEFR_LEVELS.map(l => <option key={l.code} value={l.code}>{l.code.toUpperCase()} — {l.name}</option>)}
          </select>
        </div>
        <TranscriptPicker userId={user.id} lang={lang} selectedId={selectedTranscript?.id || null} onSelect={setSelectedTranscript} />
        <TopicSelector value={topic} onChange={setTopic} isKidMode={isKidMode} disabled={!!selectedTranscript} transcriptTitle={selectedTranscript?.title} />
        <button
          onClick={generate}
          disabled={generating}
          className={`w-full py-4 sm:py-5 rounded-2xl font-black shadow-2xl transition-all flex items-center justify-center gap-3 disabled:opacity-50 transform active:scale-[0.98] ${isKidMode ? 'brand-gradient text-white' : 'brand-gradient text-white brand-shadow'}`}
        >
          {generating ? <Loader2 className="h-6 w-6 animate-spin" /> : <Sparkles className="h-6 w-6" />}
          <span className="text-lg sm:text-xl">{isKidMode ? "Stwórz zdania! ✨" : "Generuj zdania"}</span>
        </button>
      </div>

      <div className="grid gap-4 sm:gap-6">
        {sentences.map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className={`p-5 sm:p-8 rounded-2xl sm:rounded-[2rem] border shadow-xl transition-all glass hover:shadow-2xl hover:-translate-y-0.5 ${isKidMode ? 'border-purple-50 hover:border-purple-200' : 'border-white/20 dark:border-white/5'}`}
          >
            <div className="text-lg sm:text-2xl font-black tracking-tight mb-4 leading-relaxed">
              {s.original?.split(' ').map((word: string, wi: number) => (
                <span
                  key={wi}
                  className="inline-block mr-1.5 mb-1 cursor-pointer hover:text-brand-500 transition-colors"
                  onClick={() => speak(word.replace(/[.,!?;:"""„]/g, ''))}
                  onMouseEnter={(e) => handleWordMouseEnter(word, e, s.original)}
                  onMouseLeave={handleWordMouseLeave}
                >
                  {word}
                </span>
              ))}
            </div>
            <AnimatePresence>
              {showTranslations && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                  <p className="text-base sm:text-lg text-brand-500 font-bold mb-2 tracking-tight">{s.translation}</p>
                  <p className="text-xs sm:text-sm text-slate-400 font-medium italic leading-relaxed">{s.explanation}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      {/* Word hover tooltip */}
      <AnimatePresence>
        {hoveredWord && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            style={{ position: 'fixed', left: Math.min(hoveredWord.x, window.innerWidth - 200), top: hoveredWord.y - 52, zIndex: 50 }}
            className="glass bg-slate-900/90 text-white px-4 py-2 rounded-xl shadow-2xl text-sm font-bold tracking-tight pointer-events-none border border-white/20"
          >
            {hoveredWord.translation || '...'}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Challenge({ user, isKidMode, lang, nativeLang = 'pl' }: { user: AuthUser; isKidMode: boolean; lang: string; nativeLang?: string }) {
  const nll = NATIVE_LANG_NAME[nativeLang] || 'Polish';
  const [level, setLevel] = useState('a1');
  const [topic, setTopic] = useState(PRACTICE_TOPICS[0].name);
  const [generating, setGenerating] = useState(false);
  const [challenge, setChallenge] = useState<any>(null);
  const [answer, setAnswer] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<any>(null);

  const getChallenge = async () => {
    setGenerating(true);
    setResult(null);
    setAnswer('');
    try {
      const prompt = `You are a language teacher. Create a daily writing challenge in: ${lang}.
Level: ${level}.
Topic: ${topic}.
Return ONLY JSON:
{
  "title": "challenge title",
  "prompt": "instruction for the student in ${nll}",
  "hints": ["hint 1 in ${nll}", "hint 2 in ${nll}"]
}`;

      const aiText = await requestAiText(prompt, true);
      const data = parseAiJson<any>(aiText, {});
      setChallenge(data);
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const check = async () => {
    if (!answer.trim()) return;
    setChecking(true);
    try {
      const prompt = `Evaluate the student's response to the challenge: "${challenge.title}".
The instruction was: "${challenge.prompt}".
Student's answer: "${answer}".
Language: ${lang}.
Score on a scale 0-100. Give feedback in ${nll}.
Return ONLY JSON:
{
  "score": 85,
  "feedback": "your feedback in ${nll}",
  "correction": "corrected version of the text"
}`;

      const aiText = await requestAiText(prompt, true);
      const data = parseAiJson<any>(aiText, {});
      setResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className={`text-2xl font-black tracking-tight ${isKidMode ? 'text-purple-600' : ''}`}>
          {isKidMode ? "Wielkie Wyzwanie! 🏆" : "Codzienne Wyzwanie"}
        </h2>
      </div>

      {!challenge ? (
        <div className={`p-12 rounded-[3rem] border shadow-2xl text-center space-y-8 transition-all glass ${isKidMode ? 'border-purple-100 shadow-purple-100/50' : 'border-white/20 dark:border-white/5'}`}>
          <div className="relative inline-block">
            <Trophy className="h-20 w-20 text-yellow-500 mx-auto mb-4 drop-shadow-[0_0_20px_rgba(234,179,8,0.4)]" />
            <motion.div 
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute -top-2 -right-2"
            >
              <Sparkles className="h-8 w-8 text-yellow-400" />
            </motion.div>
          </div>
          <h3 className="text-3xl font-black tracking-tight">Gotowy na dzisiejsze wyzwanie?</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-xl mx-auto">
            <select value={level} onChange={(e) => setLevel(e.target.value)} className="glass border border-white/20 dark:border-white/5 rounded-2xl px-6 py-4 outline-none font-bold text-sm focus:ring-2 focus:ring-brand-500">
              {CEFR_LEVELS.map(l => <option key={l.code} value={l.code}>{l.code.toUpperCase()} — {l.name}</option>)}
            </select>
          </div>
          <div className="max-w-xl mx-auto text-left">
            <TopicSelector value={topic} onChange={setTopic} isKidMode={isKidMode} />
          </div>
          <button 
            onClick={getChallenge}
            disabled={generating}
            className={`px-12 py-5 rounded-[2rem] font-black text-xl shadow-2xl transition-all flex items-center justify-center gap-4 mx-auto transform active:scale-[0.98] ${isKidMode ? 'brand-gradient text-white' : 'brand-gradient text-white brand-shadow'}`}
          >
            {generating ? <Loader2 className="h-7 w-7 animate-spin" /> : <Zap className="h-7 w-7" />}
            Zacznij Wyzwanie!
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          <div className={`p-10 rounded-[2.5rem] border shadow-2xl transition-all glass ${isKidMode ? 'border-purple-100 shadow-purple-100/50' : 'border-white/20 dark:border-white/5'}`}>
            <h3 className="text-2xl font-black mb-4 text-brand-500 tracking-tight">{challenge.title}</h3>
            <p className="text-2xl font-black tracking-tight mb-8 leading-relaxed">{challenge.prompt}</p>
            <div className="flex flex-wrap gap-3">
              {challenge.hints.map((h: string, i: number) => (
                <span key={i} className="px-5 py-2 glass bg-white/10 dark:bg-white/5 rounded-full text-xs font-bold text-slate-500 border border-white/10">💡 {h}</span>
              ))}
            </div>
          </div>

          <div className={`rounded-[2.5rem] border shadow-2xl overflow-hidden transition-all glass ${isKidMode ? 'border-purple-200' : 'border-white/20 dark:border-white/5'}`}>
            <textarea 
              className="w-full min-h-[200px] p-10 bg-transparent outline-none resize-none text-2xl font-black tracking-tight leading-relaxed placeholder:text-slate-300 dark:placeholder:text-slate-700"
              placeholder="Twoja odpowiedź..."
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
            />
            <div className="px-10 py-6 border-t border-white/10 dark:border-white/5 flex justify-end bg-white/5 dark:bg-black/20">
              <button 
                onClick={check}
                disabled={checking || !answer.trim()}
                className={`px-10 py-4 rounded-2xl font-black shadow-2xl transition-all disabled:opacity-50 flex items-center gap-4 transform active:scale-[0.98] ${isKidMode ? 'brand-gradient text-white' : 'brand-gradient text-white brand-shadow'}`}
              >
                {checking ? <Loader2 className="h-6 w-6 animate-spin" /> : <Check className="h-6 w-6" />}
                Wyślij do oceny
              </button>
            </div>
          </div>

          {result && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className={`p-10 rounded-[3rem] border shadow-2xl text-white ${result.score > 70 ? 'bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600' : 'bg-gradient-to-br from-orange-400 via-red-500 to-pink-600'}`}>
              <div className="flex justify-between items-center mb-8">
                <h4 className="text-4xl font-black tracking-tighter">Wynik: {result.score}/100</h4>
                <Trophy className="h-12 w-12 drop-shadow-lg" />
              </div>
              <p className="text-xl font-bold mb-10 leading-relaxed">{result.feedback}</p>
              <div className="bg-white/10 backdrop-blur-md p-8 rounded-[2rem] border border-white/20">
                <p className="text-[10px] uppercase font-black mb-4 opacity-70 tracking-[0.2em]">Poprawna wersja:</p>
                <p className="text-2xl font-black tracking-tight leading-relaxed">{result.correction}</p>
              </div>
              <button onClick={getChallenge} className="mt-10 w-full py-5 bg-white text-slate-900 rounded-2xl font-black text-xl hover:bg-slate-100 transition-all shadow-2xl transform active:scale-[0.98]">
                Kolejne wyzwanie
              </button>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}

function TranscriptHub({ user, isKidMode, onSourceChange, lang, nativeLang = 'pl' }: { user: AuthUser; isKidMode: boolean; onSourceChange?: (src: TranscriptSource | null) => void; lang: string; nativeLang?: string }) {
  const [mode, setMode] = useState<'read' | 'play'>('play');
  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="flex gap-2 p-1 rounded-2xl glass w-fit border border-white/20 dark:border-white/5">
        <button
          onClick={() => setMode('play')}
          className={`flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            mode === 'play'
              ? isKidMode ? 'bg-purple-500 text-white shadow-md' : 'brand-gradient text-white shadow-md'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <Play className="h-3.5 w-3.5" /> Odtwarzacz
        </button>
        <button
          onClick={() => setMode('read')}
          className={`flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            mode === 'read'
              ? isKidMode ? 'bg-purple-500 text-white shadow-md' : 'brand-gradient text-white shadow-md'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <BookOpen className="h-3.5 w-3.5" /> Czytanie
        </button>
      </div>
      {mode === 'play'
        ? <VideoPlayer user={user} isKidMode={isKidMode} onSourceChange={onSourceChange} lang={lang} nativeLang={nativeLang} />
        : <TranscriptViewer user={user} isKidMode={isKidMode} onSourceChange={onSourceChange} lang={lang} nativeLang={nativeLang} />}
    </div>
  );
}

function TranscriptViewer({ user, isKidMode, onSourceChange, lang, nativeLang = 'pl' }: { user: AuthUser; isKidMode: boolean; onSourceChange?: (src: TranscriptSource | null) => void; lang: string; nativeLang?: string }) {
  const [selectedTranscript, setSelectedTranscript] = useState<TranscriptSource | null>(null);
  const [hoveredWord, setHoveredWord] = useState<{ word: string, translation: string | null, x: number, y: number } | null>(null);
  const [formatting, setFormatting] = useState(false);
  const [formatStatus, setFormatStatus] = useState('');
  const hoverTimeout = useRef<any>(null);
  const isTranslating = useRef(false);
  const hoverRequestId = useRef(0);

  const formatTranscript = async () => {
    if (!selectedTranscript) return;
    setFormatting(true);
    setFormatStatus('Formatowanie…');
    try {
      const res = await fetch(`/api/transcripts/${selectedTranscript.id}/format`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Błąd formatowania');
      setSelectedTranscript(data);
      setFormatStatus('Transkrypcja sformatowana.');
    } catch (err: any) {
      setFormatStatus(err.message || 'Błąd formatowania.');
    } finally {
      setFormatting(false);
    }
  };

  const nativeLangLabel = NATIVE_LANG_NAME[nativeLang] || 'Polish';

  const speak = (text: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    window.speechSynthesis.speak(utterance);
  };

  const translateWord = async (word: string, sentenceContext?: string, onQuick?: (t: string) => void): Promise<string | null> => {
    try {
      const ctx = sentenceContext ? `Sentence context: "${sentenceContext}"\n` : '';
      const prompt = `${ctx}Translate the word "${word}" from language "${lang}" to ${nativeLangLabel}. Preserve part of speech (verb→verb, noun→noun). Reply ONLY with the translation.`;
      const aiPromise = requestAiText(prompt, false);
      const quick = await translateWordQuick(word, lang, nativeLang, sentenceContext);
      if (quick) onQuick?.(quick);
      const text = await aiPromise;
      return text.trim() || quick || null;
    } catch {
      return null;
    }
  };

  const handleWordMouseEnter = (word: string, e: React.MouseEvent, sentenceContext?: string) => {
    const x = e.clientX;
    const y = e.clientY;
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    hoverTimeout.current = setTimeout(async () => {
      if (isTranslating.current) return;
      const clean = word.replace(/[.,!?;:"""„]/g, '').trim();
      if (!clean) return;
      const requestId = ++hoverRequestId.current;
      isTranslating.current = true;
      const translation = await translateWord(clean, sentenceContext, (quick) => {
        if (hoverRequestId.current === requestId) setHoveredWord({ word: clean, translation: quick, x, y });
      });
      if (hoverRequestId.current === requestId) {
        setHoveredWord({ word: clean, translation, x, y });
      }
      isTranslating.current = false;
    }, 300);
  };

  const handleWordMouseLeave = () => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    hoverRequestId.current += 1;
    setHoveredWord(null);
  };

  const paragraphs = selectedTranscript
    ? selectedTranscript.transcript.split(/\n+/).filter(p => p.trim())
    : [];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className={`text-3xl font-black tracking-tight ${isKidMode ? 'text-purple-600' : 'text-gradient'}`}>
          {isKidMode ? 'Oglądamy i Czytamy! 📺' : 'Transkrypcje'}
        </h2>
      </div>

      <div className={`p-10 rounded-[3rem] glass space-y-6 transition-all ${isKidMode ? 'border-purple-100 shadow-purple-100/50' : ''}`}>
        <div className="space-y-3">
        </div>
        <TranscriptPicker
          userId={user.id}
          lang={lang}
          selectedId={selectedTranscript?.id || null}
          onSelect={t => { setSelectedTranscript(t); onSourceChange?.(t); }}
        />
      </div>

      {!selectedTranscript ? (
        <div className="text-center py-32 glass rounded-[3rem] border-2 border-dashed border-slate-200/60 dark:border-slate-800/60">
          <Monitor className="h-16 w-16 text-slate-300 mx-auto mb-6 opacity-20" />
          <p className="text-slate-500 font-bold text-xl">Wybierz lub zaimportuj transkrypcję powyżej</p>
          <p className="text-slate-400 text-sm mt-2">Najedź kursorem na słowo aby zobaczyć tłumaczenie</p>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className={`p-8 rounded-[2.5rem] border shadow-2xl glass ${isKidMode ? 'border-purple-100' : 'border-white/20 dark:border-white/5'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
              <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Transkrypcja</p>
                <h3 className="text-2xl font-black tracking-tight">{selectedTranscript.title}</h3>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={formatTranscript}
                  disabled={formatting}
                  title="Podziel na akapity i dodaj interpunkcję przez AI"
                  className="flex items-center gap-2 px-5 py-2.5 rounded-2xl font-black text-sm transition-all shadow-lg glass border border-white/20 dark:border-white/10 hover:border-brand-500/40 disabled:opacity-50"
                >
                  {formatting ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="text-base">✨</span>}
                  Formatuj
                </button>
                <button
                  onClick={() => speak(selectedTranscript.transcript)}
                  title="Odczytaj całą transkrypcję"
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-black text-sm transition-all shadow-lg ${isKidMode ? 'bg-purple-500 text-white' : 'brand-gradient text-white'}`}
                >
                  <span className="text-lg">🔊</span>
                  Odczytaj
                </button>
              </div>
            </div>
            {formatStatus && (
              <p className={`text-xs font-semibold mb-4 ${formatting ? 'text-brand-500 animate-pulse' : 'text-slate-400'}`}>
                {formatStatus}
              </p>
            )}

            <div className="relative">
              <div className="leading-relaxed text-lg font-medium space-y-4">
                {paragraphs.map((para, pi) => (
                  <p key={pi}>
                    {para.split(' ').map((word, wi) => (
                      <span
                        key={wi}
                        className="hover:text-brand-500 cursor-pointer transition-colors inline-block mr-1.5 mb-1"
                        onClick={() => speak(word.replace(/[.,!?;:"""„]/g, ''))}
                        onMouseEnter={(e) => handleWordMouseEnter(word, e, para)}
                        onMouseLeave={handleWordMouseLeave}
                      >
                        {word}
                      </span>
                    ))}
                  </p>
                ))}
              </div>

              <AnimatePresence>
                {hoveredWord && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 10 }}
                    style={{ position: 'fixed', left: hoveredWord.x, top: hoveredWord.y - 50 }}
                    className="z-50 glass bg-slate-900/90 text-white px-5 py-2.5 rounded-2xl shadow-2xl text-base font-black tracking-tight pointer-events-none border border-white/20"
                  >
                    {hoveredWord.translation || '...'}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <p className="mt-6 text-xs text-slate-400 font-medium">
              Kliknij słowo aby je usłyszeć · Najedź kursorem aby zobaczyć tłumaczenie
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Language Reactor-style Video Player tab
// ─────────────────────────────────────────────────────────────────────────────
function VideoPlayer({ user, isKidMode, onSourceChange, lang, nativeLang = 'pl' }: { user: AuthUser; isKidMode: boolean; onSourceChange?: (src: TranscriptSource | null) => void; lang: string; nativeLang?: string }) {
  const [selectedTranscript, setSelectedTranscript] = useState<TranscriptSource | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loadingSegs, setLoadingSegs] = useState(false);
  const [segsError, setSegsError] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [dualSubs, setDualSubs] = useState(false);
  const [segTranslations, setSegTranslations] = useState<Record<number, string>>({});
  const [translatingDual, setTranslatingDual] = useState(false);
  const [popup, setPopup] = useState<WordPopup | null>(null);
  const [savedWords, setSavedWords] = useState<Set<string>>(new Set());
  type WordEntry = { word: string; translation: string; pos: 'noun'|'verb'|'adj'|'adv'; example: string; freq: number };
  const [wordAnalysis, setWordAnalysis] = useState<WordEntry[]>([]);
  const [vocabTab, setVocabTab] = useState<'all'|'noun'|'verb'|'adj'|'adv'>('all');
  const [showVocab, setShowVocab] = useState(false);

  const nativeLangLabel = NATIVE_LANG_NAME[nativeLang] || 'Polish';

  const playerRef = useRef<any>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playerDivRef = useRef<HTMLDivElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const segRefs = useRef<(HTMLDivElement | null)[]>([]);
  const prevSegIdxRef = useRef(-1);

  const fmtTime = (s: number) => {
    const t = isFinite(s) ? s : 0;
    return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  };

  const speakWord = (text: string) => {
    if (!window.speechSynthesis) return;
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = lang;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utt);
  };

  // Current segment index (most recent segment whose start ≤ currentTime)
  const currentSegIdx = useMemo(() => {
    if (segments.length === 0) return -1;
    let idx = -1;
    for (let i = 0; i < segments.length; i++) {
      if (currentTime >= segments[i].start) idx = i;
      else break;
    }
    return idx;
  }, [currentTime, segments]);

  // Auto-scroll transcript panel to current segment
  useEffect(() => {
    if (currentSegIdx < 0) return;
    const el = segRefs.current[currentSegIdx];
    if (el && transcriptRef.current) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentSegIdx]);

  // Load YouTube IFrame API (idempotent)
  useEffect(() => {
    if ((window as any).YT?.Player) return;
    if (!document.getElementById('yt-iframe-api')) {
      const tag = document.createElement('script');
      tag.id = 'yt-iframe-api';
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }
  }, []);

  // Create / recreate YouTube player when transcript changes
  useEffect(() => {
    if (!selectedTranscript || !playerDivRef.current) return;
    const vid = selectedTranscript.videoId;

    const create = () => {
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch {}
        playerRef.current = null;
      }
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }

      const container = document.createElement('div');
      container.id = `yt-${vid}-${Date.now()}`;
      playerDivRef.current!.innerHTML = '';
      playerDivRef.current!.appendChild(container);

      playerRef.current = new (window as any).YT.Player(container.id, {
        videoId: vid,
        width: '100%',
        height: '100%',
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onStateChange: (e: any) => {
            if (e.data === 1) { // PLAYING
              if (pollRef.current) clearInterval(pollRef.current);
              pollRef.current = setInterval(() => {
                const t = playerRef.current?.getCurrentTime?.() ?? 0;
                setCurrentTime(t);
              }, 300);
            } else {
              if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
            }
          },
        },
      });
    };

    if ((window as any).YT?.Player) {
      create();
    } else {
      const prev = (window as any).onYouTubeIframeAPIReady;
      (window as any).onYouTubeIframeAPIReady = () => {
        if (prev) prev();
        create();
      };
    }

    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [selectedTranscript?.videoId]);

  // Load timed segments when transcript changes
  useEffect(() => {
    if (!selectedTranscript) { setSegments([]); setSegsError(''); return; }
    setLoadingSegs(true);
    setSegsError('');
    setSegments([]);
    setSegTranslations({});
    setWordAnalysis([]);
    setShowVocab(false);
    setCurrentTime(0);
    prevSegIdxRef.current = -1;

    fetch(`/api/transcripts/${selectedTranscript.id}/segments?nativeLang=${nativeLang}`)
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.segments)) {
          // Normalise field names — Supadata may use offset/duration instead of start/dur
          const raw = d.segments.map((seg: any) => ({
            text:  String(seg.text || ''),
            start: Number(seg.start ?? seg.offset ?? 0),
            dur:   Number(seg.dur   ?? seg.duration ?? 0),
          }));
          // Many YouTube videos (clips from broadcasts) have caption timestamps that
          // start far into the global timeline (e.g. 7:28) rather than 0:00.
          // Normalise by subtracting the first segment's start so that:
          //   • display always begins at 0:00
          //   • seekTo receives a clip-relative position (matching getCurrentTime())
          const firstStart = raw.length > 0 ? raw[0].start : 0;
          const offset = firstStart > 30 ? firstStart : 0;
          setSegments(offset > 0
            ? raw.map(s => ({ ...s, start: Math.max(0, s.start - offset) }))
            : raw);
          // Use server-pre-generated translations if already available
          if (d.translations && typeof d.translations === 'object' && Object.keys(d.translations).length > 5) {
            setSegTranslations(d.translations as Record<number, string>);
          }
        }
        else setSegsError(d.error || 'Brak segmentów dla tego filmiku');
      })
      .catch(() => setSegsError('Błąd pobierania segmentów'))
      .finally(() => setLoadingSegs(false));
  }, [selectedTranscript?.id]);

  // Poll server for background-generated translations when not yet available
  useEffect(() => {
    if (!selectedTranscript) return;
    if (segments.length === 0) return;
    if (Object.keys(segTranslations).length > 5) return; // already loaded
    let stopped = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 36; // ~3 min at 5s interval
    const poll = () => {
      if (stopped || attempts >= MAX_ATTEMPTS) return;
      attempts++;
      fetch(`/api/transcripts/${selectedTranscript.id}/translations`)
        .then(r => r.json())
        .then(d => {
          if (stopped) return;
          if (d.translations && typeof d.translations === 'object' && Object.keys(d.translations).length > 5) {
            setSegTranslations(d.translations as Record<number, string>);
            stopped = true;
          } else {
            setTimeout(poll, 5000);
          }
        })
        .catch(() => { if (!stopped) setTimeout(poll, 5000); });
    };
    const timer = setTimeout(poll, 3000); // first check after 3s
    return () => { stopped = true; clearTimeout(timer); };
  }, [selectedTranscript?.id, segments.length]);

  // Poll server for background-generated word analysis
  useEffect(() => {
    if (!selectedTranscript) return;
    if (wordAnalysis.length > 0) return;
    let stopped = false;
    let attempts = 0;
    const poll = () => {
      if (stopped || attempts >= 24) return;
      attempts++;
      fetch(`/api/transcripts/${selectedTranscript.id}/vocabulary?nativeLang=${nativeLang}`)
        .then(r => r.json())
        .then(d => {
          if (stopped) return;
          if (Array.isArray(d.words) && d.words.length > 3) {
            setWordAnalysis(d.words);
            stopped = true;
          } else {
            setTimeout(poll, 5000);
          }
        })
        .catch(() => { if (!stopped) setTimeout(poll, 5000); });
    };
    const t = setTimeout(poll, 5000);
    return () => { stopped = true; clearTimeout(t); };
  }, [selectedTranscript?.id]);

  // Per-segment dual-subtitle translation (lazy, cached)
  useEffect(() => {
    if (!dualSubs || currentSegIdx < 0 || currentSegIdx === prevSegIdxRef.current) return;
    prevSegIdxRef.current = currentSegIdx;
    if (segTranslations[currentSegIdx]) return;

    const seg = segments[currentSegIdx];
    if (!seg) return;

    requestAiText(
      `Translate to ${nativeLangLabel} (reply ONLY with the translation): "${seg.text}"`,
      false
    )
      .then(t => setSegTranslations(prev => ({ ...prev, [currentSegIdx]: t.trim() })))
      .catch(() => {});
  }, [dualSubs, currentSegIdx]);

  // Batch-translate all segments when dual subs first enabled (up to 80) — fallback if server translations not ready
  useEffect(() => {
    if (!dualSubs || segments.length === 0) return;
    if (Object.keys(segTranslations).length > 0) return; // server translations already loaded

    setTranslatingDual(true);
    const batch = segments.slice(0, 80);
    // Cut at line boundary, 1-based numbering (AI models naturally count from 1)
    const rawLines = batch.map((s, i) => `${i + 1}. ${s.text}`);
    let joined = rawLines.join('\n');
    if (joined.length > 4800) { const cut = joined.lastIndexOf('\n', 4800); joined = cut > 0 ? joined.slice(0, cut) : joined.slice(0, 4800); }
    const prompt = `Translate each numbered line to ${nativeLangLabel}. Output ONLY the numbered translations in the same "N. translation" format, one per line.\n\n${joined}`;
    requestAiText(prompt, false)
      .then(result => {
        // Collect pairs and auto-detect offset (0-based vs 1-based AI output)
        const pairs: Array<{key: number; text: string}> = [];
        result.split('\n').forEach(line => {
          const m = line.match(/^(\d+)\.\s*(.+)/);
          if (m) pairs.push({ key: parseInt(m[1]), text: m[2].trim() });
        });
        const minKey = pairs.length > 0 ? Math.min(...pairs.map(p => p.key)) : 0;
        const trans: Record<number, string> = {};
        pairs.forEach(p => { trans[p.key - minKey] = p.text; });
        setSegTranslations(trans);
      })
      .catch(() => {})
      .finally(() => setTranslatingDual(false));
  }, [dualSubs, segments.length]);

  const handleWordClick = useCallback(async (word: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const clean = word.replace(/[.,!?;:"""„()\[\]«»\-–—]/g, '').trim();
    if (!clean || clean.length < 2) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.min(rect.left + rect.width / 2 - 110, window.innerWidth - 240);
    const y = Math.max(rect.top - 10, 10);
    // Check pre-cached vocabulary first (instant)
    const cached = wordAnalysis.find(w => w.word.toLowerCase() === clean.toLowerCase());
    setPopup({ word: clean, x, y, translation: cached?.translation || null, saving: false });
    if (cached?.translation) return; // instant — no AI call needed

    try {
      const start = Math.max(0, currentSegIdx - 1);
      const end = Math.min(segments.length - 1, currentSegIdx + 1);
      const ctxText = segments.slice(start, end + 1).map(s => s.text).join(' ');
      const ctx = ctxText ? `Sentence context: "${ctxText}"\n` : '';
      // Fire AI immediately — runs in parallel with MyMemory
      const aiPromise = requestAiText(
        `${ctx}Translate the ${lang} word/phrase "${clean}" to ${nativeLangLabel}. Preserve part of speech (verb→verb, noun→noun). Reply ONLY with the translation.`,
        false
      );
      // Show quick DeepL result at ~200ms while AI is still working
      const quick = await translateWordQuick(clean, lang, nativeLang, ctxText);
      if (quick) setPopup(p => p?.word === clean ? { ...p, translation: quick } : p);
      // Replace with accurate AI result (has full context)
      const accurate = (await aiPromise).trim();
      if (accurate) setPopup(p => p?.word === clean ? { ...p, translation: accurate } : p);
    } catch {
      setPopup(p => p?.word === clean ? { ...p, translation: p?.translation || '—' } : p);
    }
  }, [lang, nativeLang, currentSegIdx, segments, wordAnalysis]);

  const saveToVocab = async () => {
    if (!popup?.translation || popup.saving) return;
    setPopup(p => p ? { ...p, saving: true } : null);
    const ctx = currentSegIdx >= 0 ? (segments[currentSegIdx]?.text || '') : '';
    try {
      await fetch('/api/vocabulary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          word: popup.word,
          translation: popup.translation,
          lang,
          context: ctx,
        }),
      });
      setSavedWords(prev => new Set([...prev, popup.word]));
      setPopup(null);
    } catch {
      setPopup(p => p ? { ...p, saving: false } : null);
    }
  };

  const saveAsFlashcard = async () => {
    if (!popup?.translation || popup.saving) return;
    setPopup(p => p ? { ...p, saving: true } : null);
    try {
      await fetch('/api/flashcards/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          lang,
          cards: [{ front: popup.word, back: popup.translation }],
          transcriptSourceId: selectedTranscript?.id || null,
        }),
      });
      setSavedWords(prev => new Set([...prev, popup.word]));
      setPopup(null);
    } catch {
      setPopup(p => p ? { ...p, saving: false } : null);
    }
  };

  // Fallback: render plain transcript as clickable words (when no timed segments)
  const plainWords = useMemo(
    () => (selectedTranscript ? selectedTranscript.transcript.split(/\s+/) : []),
    [selectedTranscript?.id]
  );

  // For subtitle overlay: combine all fragments from last sentence boundary up to current segment
  const subtitleWindow = useMemo(() => {
    if (currentSegIdx < 0 || segments.length === 0) return { text: '', translation: '' };
    // Walk back to find sentence start (prev segment ending with . ! ?)
    let start = currentSegIdx;
    while (start > 0 && !/[.!?]\s*$/.test(segments[start - 1].text) && currentSegIdx - start < 6) {
      start--;
    }
    const text = segments.slice(start, currentSegIdx + 1).map(s => s.text).join(' ');
    // Use the best (longest) translation available in the window
    let translation = '';
    for (let i = currentSegIdx; i >= start; i--) {
      const t = segTranslations[i];
      if (t && t.length > translation.length) translation = t;
    }
    return { text, translation };
  }, [currentSegIdx, segments, segTranslations]);

  return (
    <div className="space-y-6 pb-24" onClick={() => setPopup(null)}>
      {/* ── Settings bar ── */}
      <div className={`p-6 rounded-[2rem] glass space-y-4 ${isKidMode ? 'border border-purple-100/50' : ''}`}>
        <TranscriptPicker
          userId={user.id}
          lang={lang}
          selectedId={selectedTranscript?.id || null}
          onSelect={t => { setSelectedTranscript(t); setSegTranslations({}); setWordAnalysis([]); setShowVocab(false); setSavedWords(new Set()); onSourceChange?.(t); }}
        />
      </div>

      {!selectedTranscript ? (
        <div className="text-center py-36 glass rounded-[3rem] border-2 border-dashed border-slate-200/60 dark:border-slate-800/60">
          <Play className="h-16 w-16 text-slate-300 mx-auto mb-6 opacity-20" />
          <p className="text-slate-500 font-bold text-xl">Wybierz transkrypcję, aby uruchomić odtwarzacz</p>
          <p className="text-slate-400 text-sm mt-2">Kliknij dowolne słowo aby zobaczyć tłumaczenie i zapisać do słówek</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── Left: Video + controls + current subtitle ── */}
          <div className="space-y-4">
            {/* YouTube player */}
            <div
              ref={playerDivRef}
              className="w-full aspect-video rounded-2xl overflow-hidden bg-black shadow-2xl"
            />

            {/* Controls row */}
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                <input
                  type="checkbox"
                  checked={dualSubs}
                  disabled={translatingDual}
                  onChange={e => setDualSubs(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-5 h-5 rounded-md flex items-center justify-center border-2 transition-all ${
                  dualSubs
                    ? (isKidMode ? 'bg-purple-500 border-purple-500' : 'bg-brand-500 border-brand-500')
                    : 'border-slate-300 dark:border-slate-600 group-hover:border-brand-400'
                }`}>
                  {dualSubs && <Check className="h-3 w-3 text-white" />}
                </div>
                <span className="text-sm font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  🇵🇱 Tłumaczenia
                  {translatingDual && <Loader2 className="h-3 w-3 animate-spin text-brand-500" />}
                </span>
              </label>

              {loadingSegs && (
                <span className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Ładuję napisy...
                </span>
              )}
              {segsError && !loadingSegs && segments.length === 0 && (
                <span className="text-xs text-amber-500 font-medium">⚠ {segsError} — używam trybu tekstowego</span>
              )}
            </div>

            {/* Current subtitle display */}
            {currentSegIdx >= 0 && (
              <motion.div
                key={currentSegIdx}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-5 rounded-2xl glass border text-center space-y-1.5 ${isKidMode ? 'border-purple-100' : 'border-white/20 dark:border-white/10'}`}
              >
                <p className="text-base font-bold leading-snug">
                  {subtitleWindow.text.split(' ').map((w, i) => {
                    const clean = w.replace(/[.,!?;:"""„()\[\]]/g, '');
                    return (
                      <span
                        key={i}
                        onClick={e => handleWordClick(w, e)}
                        className={`cursor-pointer mr-1 inline-block transition-colors ${
                          savedWords.has(clean)
                            ? 'text-emerald-500 font-black'
                            : 'hover:text-brand-500'
                        }`}
                      >
                        {w}
                      </span>
                    );
                  })}
                </p>
                {dualSubs && (
                  <p className={`text-xs sm:text-sm font-medium mt-1 italic ${subtitleWindow.translation ? 'text-brand-300' : 'text-slate-500 animate-pulse'}`}>
                    {subtitleWindow.translation || '…'}
                  </p>
                )}
              </motion.div>
            )}

            {/* Saved words summary */}
            {savedWords.size > 0 && (
              <div className="flex items-center gap-2 flex-wrap px-1">
                <span className="text-xs font-bold text-slate-400">Zapisane:</span>
                {[...savedWords].slice(-8).map(w => (
                  <span key={w} className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-lg">{w}</span>
                ))}
                {savedWords.size > 8 && (
                  <span className="text-xs text-slate-400">+{savedWords.size - 8} więcej</span>
                )}
              </div>
            )}
          </div>

          {/* ── Right: Scrollable transcript ── */}
          <div
            ref={transcriptRef}
            className="h-[320px] sm:h-[420px] lg:h-auto lg:max-h-[calc(100vh-280px)] overflow-y-auto rounded-2xl glass border border-white/20 dark:border-white/5 p-4"
          >
            <div className="flex items-start justify-between mb-4 px-1">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Transkrypcja</p>
                <h3 className="font-black text-sm leading-tight mt-0.5 line-clamp-2">{selectedTranscript.title}</h3>
              </div>
              <span className="text-[10px] font-semibold text-slate-400 shrink-0 ml-2">
                {segments.length > 0 ? `${segments.length} segm.` : 'tryb tekstowy'}
              </span>
            </div>

            {segments.length > 0 ? (
              <div className="space-y-0.5">
                {segments.map((seg, i) => (
                  <div
                    key={i}
                    ref={el => { segRefs.current[i] = el; }}
                    onClick={e => { e.stopPropagation(); playerRef.current?.seekTo?.(seg.start, true); }}
                    className={`px-3 py-2 rounded-xl cursor-pointer transition-all ${
                      i === currentSegIdx
                        ? (isKidMode
                            ? 'bg-purple-500/15 border border-purple-400/40'
                            : 'bg-brand-500/15 border border-brand-400/40')
                        : 'hover:bg-white/10 dark:hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <button
                      onClick={e => { e.stopPropagation(); playerRef.current?.seekTo?.(seg.start, true); }}
                      className="text-[10px] text-slate-400 font-mono mr-2 select-none hover:text-brand-500 transition-colors"
                      title="Przejdź do tego miejsca w filmie"
                    >▶ {fmtTime(seg.start)}</button>
                    {seg.text.split(' ').map((w, wi) => {
                      const clean = w.replace(/[.,!?;:"""„()\[\]]/g, '');
                      return (
                        <span
                          key={wi}
                          onClick={e => {
                            playerRef.current?.seekTo?.(seg.start, true);
                            handleWordClick(w, e);
                          }}
                          className={`inline-block mr-1 cursor-pointer transition-colors text-sm ${
                            savedWords.has(clean)
                              ? 'text-emerald-500 font-bold'
                              : i === currentSegIdx
                                ? 'font-semibold hover:text-brand-500'
                                : 'text-slate-600 dark:text-slate-300 hover:text-brand-500'
                          }`}
                        >
                          {w}
                        </span>
                      );
                    })}
                    {dualSubs && (
                      <p className={`text-[11px] mt-1 italic leading-snug ${segTranslations[i] ? 'text-brand-400 dark:text-brand-300' : 'text-slate-400 animate-pulse'}`}>
                        {segTranslations[i] || '…'}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : loadingSegs ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                <Loader2 className="h-8 w-8 animate-spin opacity-40" />
                <p className="text-sm font-medium">Pobieranie napisów z YouTube...</p>
              </div>
            ) : (
              // Fallback: plain transcript, no timestamps
              <div className="leading-relaxed text-sm px-1">
                {plainWords.map((word, i) => {
                  const clean = word.replace(/[.,!?;:"""„()\[\]]/g, '');
                  return (
                    <span
                      key={i}
                      onClick={e => handleWordClick(word, e)}
                      className={`inline-block mr-1.5 mb-0.5 cursor-pointer transition-colors ${
                        savedWords.has(clean)
                          ? 'text-emerald-500 font-bold'
                          : 'hover:text-brand-500 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {word}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Vocabulary analysis panel ── */}
      {selectedTranscript && (
        <div className={`rounded-[2rem] glass overflow-hidden ${isKidMode ? 'border border-purple-100/50' : ''}`}>
          <button
            onClick={() => setShowVocab(v => !v)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">📊</span>
              <div className="text-left">
                <p className="font-bold text-sm">Słownictwo transkrypcji</p>
                <p className="text-xs text-slate-400">
                  {wordAnalysis.length > 0
                    ? `${wordAnalysis.length} najczęstszych słów z tłumaczeniami i przykładami`
                    : 'Analiza w toku…'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {wordAnalysis.length === 0 && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
              )}
              {wordAnalysis.length > 0 && (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    setWordAnalysis([]);
                    fetch(`/api/transcripts/${selectedTranscript!.id}/vocabulary?refresh=1&nativeLang=${nativeLang}`).catch(() => {});
                  }}
                  className="text-[10px] text-slate-500 hover:text-slate-300 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors"
                  title="Wygeneruj ponownie"
                >↺ odśwież</button>
              )}
              <span className="text-slate-400 text-sm">{showVocab ? '▲' : '▼'}</span>
            </div>
          </button>

          {showVocab && wordAnalysis.length > 0 && (
            <div className="px-6 pb-6 space-y-4">
              {/* POS filter tabs */}
              <div className="flex gap-2 flex-wrap">
                {(['all','noun','verb','adj','adv'] as const).map(tab => {
                  const labels = { all: 'Wszystkie', noun: 'Rzeczowniki', verb: 'Czasowniki', adj: 'Przymiotniki', adv: 'Przysłówki' };
                  // normalise pos defensively for counts
                  const normP = (p: string) => { const s = (p||'').toLowerCase(); return s.includes('verb')?'verb':s.includes('adj')?'adj':s.includes('adv')?'adv':'noun'; };
                  const counts = { all: wordAnalysis.length, noun: wordAnalysis.filter(w=>normP(w.pos)==='noun').length, verb: wordAnalysis.filter(w=>normP(w.pos)==='verb').length, adj: wordAnalysis.filter(w=>normP(w.pos)==='adj').length, adv: wordAnalysis.filter(w=>normP(w.pos)==='adv').length };
                  if (tab !== 'all' && counts[tab] === 0) return null;
                  return (
                    <button
                      key={tab}
                      onClick={() => setVocabTab(tab)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${vocabTab === tab ? 'brand-gradient text-white' : 'glass border border-white/15 text-slate-400 hover:text-white'}`}
                    >
                      {labels[tab]} <span className="opacity-60">({counts[tab]})</span>
                    </button>
                  );
                })}
              </div>

              {/* Word grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-96 overflow-y-auto pr-1">
                {wordAnalysis
                  .filter(w => {
                    const normP = (p: string) => { const s = (p||'').toLowerCase(); return s.includes('verb')?'verb':s.includes('adj')?'adj':s.includes('adv')?'adv':'noun'; };
                    return vocabTab === 'all' || normP(w.pos) === vocabTab;
                  })
                  .sort((a, b) => b.freq - a.freq)
                  .map((entry, i) => {
                    const normPos = (() => { const s = (entry.pos||'').toLowerCase(); return s.includes('verb')?'verb':s.includes('adj')?'adj':s.includes('adv')?'adv':'noun'; })();
                    const posColor = { noun: 'text-sky-400', verb: 'text-emerald-400', adj: 'text-amber-400', adv: 'text-violet-400' }[normPos] || 'text-slate-400';
                    const posLabel = { noun: 'rzecz.', verb: 'czas.', adj: 'przym.', adv: 'przysł.' }[normPos];
                    return (
                      <div
                        key={i}
                        className="bg-white/5 dark:bg-white/3 rounded-xl p-3 border border-white/10 hover:border-brand-500/30 transition-colors cursor-pointer"
                        onClick={() => {
                          const rect = document.body.getBoundingClientRect();
                          setPopup({ word: entry.word, x: window.innerWidth / 2 - 120, y: window.innerHeight / 2 - 80, translation: entry.translation, saving: false });
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm">{entry.word}</span>
                              <span className={`text-[10px] font-semibold uppercase tracking-wide ${posColor}`}>{posLabel}</span>
                              <span className="text-[10px] text-slate-500">{entry.freq}×</span>
                            </div>
                            <p className={`text-sm font-semibold mt-0.5 ${isKidMode ? 'text-purple-400' : 'text-brand-400'}`}>{entry.translation}</p>
                            {entry.example && (
                              <p className="text-[11px] text-slate-400 italic mt-1 leading-snug line-clamp-2">„{entry.example}"</p>
                            )}
                          </div>
                          <div className="shrink-0 flex flex-col items-center gap-1">
                            <div className="w-1.5 bg-slate-700 rounded-full overflow-hidden" style={{height:'32px'}}>
                              <div
                                className="w-full rounded-full bg-brand-500 transition-all"
                                style={{ height: `${Math.min(100, (entry.freq / (wordAnalysis[0]?.freq || 1)) * 100)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Word popup ── */}
      <AnimatePresence>
        {popup && (
          <motion.div
            initial={{ opacity: 0, scale: 0.88, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.88, y: 8 }}
            transition={{ duration: 0.15 }}
            style={{ position: 'fixed', left: Math.min(Math.max(popup.x, 8), window.innerWidth - 248), top: Math.max(popup.y - 140, 8), zIndex: 60 }}
            className="bg-slate-900/96 dark:bg-slate-950/98 text-white px-4 sm:px-5 py-4 rounded-2xl shadow-2xl border border-white/15 w-[240px]"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setPopup(null)}
              className="absolute top-2 right-2 p-1 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="h-3.5 w-3.5 opacity-60" />
            </button>

            <div className="flex items-center gap-2 pr-6 flex-wrap">
              <p className="font-black text-xl tracking-tight">{popup.word}</p>
              {(() => {
                const entry = wordAnalysis.find(w => w.word.toLowerCase() === popup.word.toLowerCase());
                if (!entry) return null;
                const np2 = (() => { const s = (entry.pos||'').toLowerCase(); return s.includes('verb')?'verb':s.includes('adj')?'adj':s.includes('adv')?'adv':'noun'; })();
                const posColor = { noun: 'text-sky-400 bg-sky-400/10', verb: 'text-emerald-400 bg-emerald-400/10', adj: 'text-amber-400 bg-amber-400/10', adv: 'text-violet-400 bg-violet-400/10' }[np2] || '';
                const posLabel = { noun: 'rzecz.', verb: 'czas.', adj: 'przym.', adv: 'przysł.' }[np2];
                return <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md ${posColor}`}>{posLabel}</span>;
              })()}
            </div>
            <div className="min-h-[1.5rem] mt-1">
              {popup.translation === null
                ? <span className="text-slate-400 text-sm animate-pulse">Tłumaczę...</span>
                : <span className={`font-bold text-base ${isKidMode ? 'text-purple-400' : 'text-brand-400'}`}>{popup.translation}</span>
              }
            </div>
            {(() => {
              const entry = wordAnalysis.find(w => w.word.toLowerCase() === popup.word.toLowerCase());
              if (!entry?.example) return null;
              return <p className="text-[11px] text-slate-400 italic mt-1 leading-snug">„{entry.example}"</p>;
            })()}

            <div className="flex gap-2 mt-3.5">
              <button
                onClick={saveToVocab}
                disabled={!popup.translation || popup.saving || savedWords.has(popup.word)}
                className={`flex-1 py-2 rounded-xl text-xs font-black transition-all disabled:opacity-40 ${
                  savedWords.has(popup.word)
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : isKidMode
                      ? 'bg-purple-500 text-white'
                      : 'brand-gradient text-white'
                }`}
              >
                {savedWords.has(popup.word) ? '✓ Zapisano' : popup.saving ? '...' : '+ Słówka'}
              </button>
              <button
                onClick={saveAsFlashcard}
                disabled={!popup.translation || popup.saving || savedWords.has(popup.word)}
                className="flex-1 py-2 rounded-xl text-xs font-black glass border border-white/20 hover:border-brand-500/40 transition-all disabled:opacity-40"
              >
                {popup.saving ? '...' : '+ Fiszka'}
              </button>
              <button
                onClick={() => speakWord(popup.word)}
                className="px-3 py-2 rounded-xl glass border border-white/20 hover:border-brand-500/40 transition-all"
              >
                🔊
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
