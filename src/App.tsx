import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Languages, User, LogOut, Loader2, BarChart3, PenTool, Layers, Globe, Star, Flame, Sparkles, Check, BookOpen, Target, Zap, ArrowRightLeft, Send, Trash2, Plus, Moon, Sun, LayoutDashboard, Book, MessageSquare, Trophy, Monitor } from 'lucide-react';
import { AuthUser, TabId } from './lib/types';
import { PRACTICE_LANGS, CEFR_LEVELS, TRANSLATION_STYLES, PRACTICE_TOPICS } from './lib/constants';

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
  const res = await fetch('/api/ai/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, isJson })
  });

  const response = await res.json();
  if (!res.ok) {
    throw new Error(response?.error || 'Błąd komunikacji z AI');
  }

  if (typeof response?.text !== 'string') {
    throw new Error('Niepoprawna odpowiedź AI');
  }

  return response.text;
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
  transcript: string;
  lang: string;
};

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
            <div className="flex items-center gap-3">

              {/* Theme toggle — animated switch */}
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

              {/* Kid mode toggle */}
              <button
                onClick={() => setIsKidMode(!isKidMode)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all hover:scale-105 active:scale-95 ${
                  isKidMode
                    ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-700/50'
                    : 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-white/[0.06]'
                }`}
              >
                {isKidMode ? '🧒 Dziecko' : '🎓 Dorosły'}
              </button>

              {/* User badge */}
              <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-sm font-medium ${
                isKidMode
                  ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-800/40 text-purple-700 dark:text-purple-300'
                  : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200/80 dark:border-white/[0.06] text-slate-700 dark:text-slate-300'
              }`}>
                <div className={`h-1.5 w-1.5 rounded-full animate-pulse ${isKidMode ? 'bg-pink-400' : 'bg-emerald-400'}`} />
                {user.name}
              </div>

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

      {/* Navigation */}
      <nav className="mx-auto w-full max-w-6xl px-6 pt-5 pb-2">
        <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-none">
          <NavButton id="dashboard" active={activeTab === 'dashboard'} onClick={setActiveTab} icon={<LayoutDashboard className="h-4 w-4" />} label={isKidMode ? "Moje Wyniki" : "Dashboard"} isKidMode={isKidMode} />
          <NavButton id="practice" active={activeTab === 'practice'} onClick={setActiveTab} icon={<PenTool className="h-4 w-4" />} label={isKidMode ? "Piszemy!" : "Ćwiczenia"} isKidMode={isKidMode} />
          <NavButton id="reading" active={activeTab === 'reading'} onClick={setActiveTab} icon={<Book className="h-4 w-4" />} label={isKidMode ? "Czytanie" : "Czytanie"} isKidMode={isKidMode} />
          <NavButton id="sentences" active={activeTab === 'sentences'} onClick={setActiveTab} icon={<MessageSquare className="h-4 w-4" />} label={isKidMode ? "Zdania" : "Zdania"} isKidMode={isKidMode} />
          <NavButton id="flashcards" active={activeTab === 'flashcards'} onClick={setActiveTab} icon={<Layers className="h-4 w-4" />} label={isKidMode ? "Zabawa Kartami" : "Fiszki"} isKidMode={isKidMode} />
          <NavButton id="vocabulary" active={activeTab === 'vocabulary'} onClick={setActiveTab} icon={<BookOpen className="h-4 w-4" />} label={isKidMode ? "Słówka" : "Słówka"} isKidMode={isKidMode} />
          <NavButton id="challenge" active={activeTab === 'challenge'} onClick={setActiveTab} icon={<Trophy className="h-4 w-4" />} label={isKidMode ? "Wyzwanie" : "Wyzwanie"} isKidMode={isKidMode} />
          <NavButton id="translator" active={activeTab === 'translator'} onClick={setActiveTab} icon={<Globe className="h-4 w-4" />} label={isKidMode ? "Tłumacz" : "Tłumacz"} isKidMode={isKidMode} />
          <NavButton id="transcripts" active={activeTab === 'transcripts'} onClick={setActiveTab} icon={<Monitor className="h-4 w-4" />} label="Transkrypcje" isKidMode={isKidMode} />
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-2">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab + (isKidMode ? '-kid' : '')}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'dashboard' && <Dashboard user={user} isKidMode={isKidMode} />}
            {activeTab === 'practice' && <Practice user={user} isKidMode={isKidMode} />}
            {activeTab === 'reading' && <Reading user={user} isKidMode={isKidMode} />}
            {activeTab === 'sentences' && <Sentences user={user} isKidMode={isKidMode} />}
            {activeTab === 'flashcards' && <Flashcards user={user} isKidMode={isKidMode} />}
            {activeTab === 'vocabulary' && <Vocabulary user={user} isKidMode={isKidMode} />}
            {activeTab === 'challenge' && <Challenge user={user} isKidMode={isKidMode} />}
            {activeTab === 'translator' && <Translator user={user} isKidMode={isKidMode} />}
            {activeTab === 'transcripts' && <TranscriptViewer user={user} isKidMode={isKidMode} />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Build version footer */}
      <footer className="relative z-10 py-4 text-center">
        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
          build {new Date((globalThis as any).__BUILD_TIME__ ?? Date.now()).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })}
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
      className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
        active
          ? isKidMode
            ? 'bg-white dark:bg-purple-900/40 shadow-md text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700/40'
            : 'bg-white dark:bg-slate-800/80 shadow-md text-slate-900 dark:text-white border border-slate-200/80 dark:border-white/[0.08]'
          : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white/70 dark:hover:bg-slate-800/40 border border-transparent'
      }`}
    >
      <span className={active ? (isKidMode ? 'text-purple-500' : 'text-brand-500') : 'opacity-60'}>{icon}</span>
      {label}
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

function Dashboard({ user, isKidMode }: { user: AuthUser, isKidMode: boolean }) {
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
          label="Seria dni" 
          value={`${stats?.streak || 0}`} 
          subValue="dni z rzędu"
          barColor="bg-gradient-to-t from-brand-600 to-red-500"
          progress={Math.min((stats?.streak || 0) * 10, 100)}
        />
        <StatCard 
          icon={<Book className="h-5 w-5 text-purple-500" />} 
          label="Teksty" 
          value={`${stats?.totalPractice || 0}`} 
          subValue="napisane i sprawdzone"
          barColor="bg-gradient-to-t from-purple-600 to-indigo-500"
          progress={Math.min((stats?.totalPractice || 0) * 5, 100)}
        />
        <StatCard 
          icon={<BarChart3 className="h-5 w-5 text-emerald-500" />} 
          label="Średni wynik" 
          value={`${Math.round(stats?.avgScore || 0)}`} 
          subValue={`min 0 / max 100`}
          barColor="bg-gradient-to-t from-emerald-600 to-teal-500"
          progress={stats?.avgScore || 0}
        />
        <StatCard 
          icon={<Layers className="h-5 w-5 text-blue-500" />} 
          label="Fiszki" 
          value={`${stats?.totalFlashcards || 0}`} 
          subValue="słówek w banku"
          barColor="bg-gradient-to-t from-blue-600 to-cyan-500"
          progress={Math.min((stats?.totalFlashcards || 0) * 2, 100)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass rounded-[2.5rem] p-10 h-80 flex flex-col">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20">
              <BarChart3 className="h-6 w-6 text-emerald-500" />
            </div>
            <h3 className="font-extrabold text-xl tracking-tight">Postęp — ostatnie 30 dni</h3>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-sm space-y-4">
            <div className="h-16 w-16 rounded-full border-2 border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center">
              <Plus className="h-8 w-8 opacity-20" />
            </div>
            <p className="font-semibold">Brak danych — zacznij pisać!</p>
          </div>
        </div>
        <div className="glass rounded-[2.5rem] p-10 h-80 flex flex-col">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 rounded-2xl bg-pink-50 dark:bg-pink-900/20">
              <Check className="h-6 w-6 text-pink-500" />
            </div>
            <h3 className="font-extrabold text-xl tracking-tight">Kategorie błędów</h3>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-sm space-y-4">
            <div className="h-16 w-16 rounded-full border-2 border-dashed border-slate-200 dark:border-slate-800 flex items-center justify-center">
              <Check className="h-8 w-8 opacity-20" />
            </div>
            <p className="font-semibold">Brak błędów — super!</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass rounded-[2.5rem] p-10 h-80 flex flex-col">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 rounded-2xl bg-yellow-50 dark:bg-yellow-900/20">
              <Star className="h-6 w-6 text-yellow-500" />
            </div>
            <h3 className="font-extrabold text-xl tracking-tight">Języki, których się uczysz</h3>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-sm space-y-4">
            <Globe className="h-12 w-12 opacity-10 mb-2" />
            <p className="font-semibold">Wybierz język i zacznij pisać!</p>
          </div>
        </div>
        <div className="glass rounded-[2.5rem] p-10 h-80 flex flex-col">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-900/20">
              <Zap className="h-6 w-6 text-blue-500" />
            </div>
            <h3 className="font-extrabold text-xl tracking-tight">Ostatnie próby</h3>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-sm space-y-4">
            <Flame className="h-12 w-12 opacity-10 mb-2" />
            <p className="font-semibold">Brak historii</p>
          </div>
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

function Practice({ user, isKidMode }: { user: AuthUser, isKidMode: boolean }) {
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
        <WritePractice user={user} isKidMode={isKidMode} />
      ) : (
        <TranslatePractice user={user} isKidMode={isKidMode} />
      )}
    </div>
  );
}

function WritePractice({ user, isKidMode }: { user: AuthUser, isKidMode: boolean }) {
  const [text, setText] = useState('');
  const [lang, setLang] = useState('en');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<any>(null);

  const check = async () => {
    if (!text.trim()) return;
    setChecking(true);
    try {
      const prompt = `Jesteś cierpliwym nauczycielem języka. Uczeń napisał tekst w języku: ${lang}.
Popraw WSZYSTKIE błędy (gramatyka, słownictwo, interpunkcja).
Oceń tekst w skali 0-100.
Dla KAŻDEGO błędu wytłumacz SZCZEGÓŁOWO po polsku: co jest źle, dlaczego i jak powinno być.
Zwróć wynik WYŁĄCZNIE jako JSON:
{
  "corrected": "poprawiony tekst",
  "score": 85,
  "mistakes": [
    {
      "original": "błędny fragment",
      "corrected": "poprawny fragment",
      "explanation": "wyjaśnienie po polsku",
      "category": "grammar|vocabulary|spelling"
    }
  ],
  "praise": "co poszło dobrze",
  "tip": "wskazówka na przyszłość"
}
Tekst ucznia: "${text}"`;

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
      <div className="flex items-center justify-between">
        <h2 className={`text-2xl font-black tracking-tight ${isKidMode ? 'text-purple-600' : ''}`}>
          {isKidMode ? "Piszemy i poprawiamy! ✏️" : "Pisz i poprawiaj"}
        </h2>
        <select 
          value={lang} 
          onChange={(e) => setLang(e.target.value)}
          className={`glass border rounded-2xl px-5 py-2.5 text-sm font-bold outline-none shadow-sm transition-all ${isKidMode ? 'border-purple-200 focus:ring-purple-400' : 'border-white/20 dark:border-white/5 focus:ring-brand-500'}`}
        >
          {PRACTICE_LANGS.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
        </select>
      </div>

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

function TranslatePractice({ user, isKidMode }: { user: AuthUser, isKidMode: boolean }) {
  const [lang, setLang] = useState('en');
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
      const prompt = `Jesteś nauczycielem języka. Przygotuj zadanie tłumaczeniowe.
Język docelowy: ${lang}. Poziom: ${level}. Temat: ${topic || 'codzienne sytuacje'}.
Zwróć WYŁĄCZNIE JSON:
{
  "polish": "jedno zdanie po polsku do przetłumaczenia",
  "hint": "krótka wskazówka po polsku"
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
      const prompt = `Oceń tłumaczenie ucznia.
Język docelowy: ${lang}
Zdanie bazowe po polsku: "${currentTask?.polish || ''}"
Odpowiedź ucznia: "${userAnswer}"
Poziom: ${level}
Zwróć WYŁĄCZNIE JSON:
{
  "score": 0,
  "feedback": "krótki feedback po polsku",
  "correction": "poprawna wersja odpowiedzi ucznia w języku docelowym"
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
          <select value={lang} onChange={(e) => setLang(e.target.value)} className="glass border border-white/20 dark:border-white/5 rounded-2xl px-5 py-3 outline-none font-bold text-sm focus:ring-2 focus:ring-brand-500">
            {PRACTICE_LANGS.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
          </select>
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

function Flashcards({ user, isKidMode }: { user: AuthUser, isKidMode: boolean }) {
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [quickGenerating, setQuickGenerating] = useState(false);
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});
  const [lang, setLang] = useState('en');
  const [topic, setTopic] = useState(PRACTICE_TOPICS[0].name);
  const [quickPrompt, setQuickPrompt] = useState('');
  const [selectedTranscript, setSelectedTranscript] = useState<TranscriptSource | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    fetch(`/api/flashcards?userId=${user.id}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setCards(data);
        else console.error("Invalid flashcards data:", data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user.id]);

  const generate = async () => {
    setGenerating(true);
    setStatusMessage('Generowanie fiszek...');
    try {
      const transcriptContext = selectedTranscript
        ? `Użyj kontekstu transkrypcji "${selectedTranscript.title}": ${selectedTranscript.transcript.slice(0, 6000)}`
        : '';
      const prompt = `Stwórz 12 fiszek do nauki języka ${lang} na temat: ${topic || 'codzienne sytuacje'}.
${transcriptContext}
Zwróć WYŁĄCZNIE JSON (tablica):
[
  { "front": "słówko lub zwrot w ${lang}", "back": "tłumaczenie po polsku" }
]`;
      const aiText = await requestAiText(prompt, true);
      const cardsData = parseAiJson<any[]>(aiText, []);

      const saveRes = await fetch('/api/flashcards/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, lang, cards: cardsData, transcriptSourceId: selectedTranscript?.id || null }),
      });
      const data = await saveRes.json();
      if (!saveRes.ok) {
        setStatusMessage(data?.error || 'Nie udało się zapisać fiszek.');
      } else if (data.flashcards && Array.isArray(data.flashcards)) {
        setCards([...data.flashcards, ...cards]);
        setTopic('');
        setStatusMessage(`Dodano ${data.flashcards.length} nowych fiszek.`);
      } else {
        console.error("Invalid flashcards data:", data);
        setStatusMessage('AI zwróciło niepoprawne dane fiszek.');
      }
    } catch (err) {
      console.error(err);
      setStatusMessage('Błąd generowania fiszek. Sprawdź logi serwera.');
    } finally {
      setGenerating(false);
    }
  };

  const generateOnDemand = async () => {
    if (!quickPrompt.trim()) return;
    setQuickGenerating(true);
    setStatusMessage('Generowanie fiszek na zawołanie...');
    try {
      const transcriptContext = selectedTranscript
        ? `Użyj kontekstu transkrypcji "${selectedTranscript.title}": ${selectedTranscript.transcript.slice(0, 6000)}`
        : '';
      const prompt = `Na podstawie polecenia użytkownika wygeneruj 3 fiszki do nauki języka ${lang}.
Polecenie użytkownika: "${quickPrompt}".
${transcriptContext}
Zwróć WYŁĄCZNIE JSON (tablica):
[
  { "front": "słówko lub zwrot w ${lang}", "back": "tłumaczenie po polsku" }
]`;
      const aiText = await requestAiText(prompt, true);
      const cardsData = parseAiJson<any[]>(aiText, []).filter((c: any) => c?.front && c?.back);
      if (!cardsData.length) return;

      const saveRes = await fetch('/api/flashcards/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, lang, cards: cardsData, transcriptSourceId: selectedTranscript?.id || null }),
      });
      const data = await saveRes.json();
      if (!saveRes.ok) {
        setStatusMessage(data?.error || 'Nie udało się zapisać fiszek.');
      } else if (Array.isArray(data.flashcards)) {
        setCards([...data.flashcards, ...cards]);
        setQuickPrompt('');
        setStatusMessage(`Dodano ${data.flashcards.length} fiszki z polecenia.`);
      }
    } catch (err) {
      console.error(err);
      setStatusMessage('Błąd generowania fiszek. Sprawdź logi serwera.');
    } finally {
      setQuickGenerating(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <h2 className={`text-2xl font-black tracking-tight ${isKidMode ? 'text-purple-600' : ''}`}>
          {isKidMode ? "Twoje Magiczne Karty 🃏" : "Twoje Fiszki"}
        </h2>
        <div className="flex gap-3">
          <select 
            value={lang} 
            onChange={(e) => setLang(e.target.value)}
            className="glass border border-white/20 dark:border-white/5 rounded-2xl px-5 py-2.5 text-sm font-bold outline-none shadow-sm focus:ring-2 focus:ring-brand-500"
          >
            {PRACTICE_LANGS.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
          </select>
          <button 
            onClick={generate}
            disabled={generating}
            className={`px-8 py-3 rounded-2xl text-sm font-black shadow-2xl transition-all flex items-center gap-3 transform active:scale-95 ${isKidMode ? 'brand-gradient text-white' : 'brand-gradient text-white brand-shadow'}`}
          >
            {generating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
            {isKidMode ? "Wyrysuj nowe karty! ✨" : "Generuj nowe"}
          </button>
        </div>
      </div>

      <div className="glass rounded-[2.5rem] p-10 border border-white/20 dark:border-white/5 shadow-2xl">
        <TranscriptPicker
          userId={user.id}
          lang={lang}
          selectedId={selectedTranscript?.id || null}
          onSelect={setSelectedTranscript}
        />
        <div className="mb-8 space-y-3">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Generuj na zawołanie</label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              value={quickPrompt}
              onChange={(e) => setQuickPrompt(e.target.value)}
              placeholder="Np. podróż pociągiem, rozmowa u lekarza, czasowniki nieregularne..."
              className="flex-1 bg-white/50 dark:bg-slate-900/50 border border-white/20 dark:border-white/5 rounded-2xl px-5 py-3.5 outline-none font-semibold"
            />
            <button
              onClick={generateOnDemand}
              disabled={quickGenerating || !quickPrompt.trim()}
              className={`px-6 py-3.5 rounded-2xl font-black shadow-xl transition-all disabled:opacity-50 ${isKidMode ? 'bg-purple-500 text-white' : 'brand-gradient text-white'}`}
            >
              {quickGenerating ? "Generuję..." : "Generuj 3 fiszki"}
            </button>
          </div>
        </div>
        <TopicSelector value={topic} onChange={setTopic} isKidMode={isKidMode} disabled={!!selectedTranscript} transcriptTitle={selectedTranscript?.title} />
        {statusMessage && <p className="mt-4 text-sm font-bold text-brand-500">{statusMessage}</p>}
      </div>

      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-64 glass animate-pulse rounded-[2rem]" />)}
        </div>
      ) : cards.length === 0 ? (
        <div className="text-center py-32 glass rounded-[3rem] border-2 border-dashed border-slate-200/60 dark:border-slate-800/60">
          <Layers className="h-16 w-16 text-slate-300 mx-auto mb-6 opacity-20" />
          <p className="text-slate-500 font-bold text-xl">Nie masz jeszcze żadnych kart. Kliknij przycisk powyżej!</p>
        </div>
      ) : (
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {cards.map((card, i) => (
            <motion.div 
              key={card.id} 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              onClick={() => setFlipped(f => ({ ...f, [card.id]: !f[card.id] }))}
              className="h-64 perspective-1000 cursor-pointer group"
            >
              <div className={`relative w-full h-full transition-all duration-700 transform-style-3d ${flipped[card.id] ? 'rotate-y-180' : ''}`}>
                <div className={`absolute inset-0 backface-hidden rounded-[2rem] border-2 shadow-xl flex flex-col items-center justify-center p-8 text-center transition-all duration-500 glass group-hover:shadow-2xl group-hover:-translate-y-1 ${isKidMode ? 'border-purple-100' : 'border-white/20 dark:border-white/5'}`}>
                  <Badge variant="outline" className="mb-6 text-[10px] uppercase tracking-[0.2em] font-black opacity-40">{card.lang}</Badge>
                  <p className={`text-3xl font-black tracking-tight leading-tight ${isKidMode ? 'text-purple-600' : 'text-slate-900 dark:text-white'}`}>{card.front}</p>
                  <div className="mt-8 text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] opacity-0 group-hover:opacity-100 transition-opacity duration-300">Kliknij aby odwrócić</div>
                </div>
                <div className={`absolute inset-0 backface-hidden rotate-y-180 rounded-[2rem] shadow-2xl flex flex-col items-center justify-center p-8 text-center text-white brand-gradient ${isKidMode ? 'from-purple-500 via-pink-500 to-orange-400' : 'brand-shadow'}`}>
                  <p className="text-3xl font-black tracking-tight leading-tight mb-4 drop-shadow-lg">{card.back}</p>
                  <div className="flex gap-3 mt-6">
                    <div className="p-3 bg-white/20 backdrop-blur-md rounded-full border border-white/30 shadow-lg">
                      <Check className="h-5 w-5" />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
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

function Vocabulary({ user, isKidMode }: { user: AuthUser, isKidMode: boolean }) {
  const [words, setWords] = useState<any[]>([]);
  const [newWord, setNewWord] = useState('');
  const [newTrans, setNewTrans] = useState('');
  const [lang, setLang] = useState('en');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetch(`/api/vocabulary?userId=${user.id}`)
      .then(res => res.json())
      .then(setWords)
      .finally(() => setLoading(false));
  }, [user.id]);

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
        <select 
          value={lang} 
          onChange={(e) => setLang(e.target.value)}
          className="glass border border-white/20 dark:border-white/5 rounded-2xl px-5 py-3 outline-none font-bold text-sm focus:ring-2 focus:ring-brand-500 min-w-[140px]"
        >
          {PRACTICE_LANGS.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
        </select>
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
function Translator({ user, isKidMode }: { user: AuthUser, isKidMode: boolean }) {
  const [sourceText, setSourceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [sourceLang, setSourceLang] = useState('pl');
  const [targetLang, setTargetLang] = useState('en');
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

function Reading({ user, isKidMode }: { user: AuthUser, isKidMode: boolean }) {
  const [lang, setLang] = useState('en');
  const [level, setLevel] = useState('a1');
  const [topic, setTopic] = useState(PRACTICE_TOPICS[0].name);
  const [sentenceCount, setSentenceCount] = useState(10);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [hoveredWord, setHoveredWord] = useState<{ word: string, translation: string | null, x: number, y: number } | null>(null);
  const [expandedSentences, setExpandedSentences] = useState<Record<number, boolean>>({});
  const [selectedTranscript, setSelectedTranscript] = useState<TranscriptSource | null>(null);
  const hoverTimeout = useRef<any>(null);
  const isTranslating = useRef<boolean>(false);
  const hoverRequestId = useRef(0);

  const speak = (text: string, language: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    window.speechSynthesis.speak(utterance);
  };

  const translateWord = async (word: string) => {
    try {
      const prompt = `Przetłumacz słowo "${word}" z języka o kodzie "${lang}" na polski. Podaj tylko samo tłumaczenie, bez dodatkowego tekstu.`;
      const responseText = await requestAiText(prompt, false);
      return responseText.trim() || null;
    } catch (err) {
      return null;
    }
  };

  const handleWordMouseEnter = (word: string, e: React.MouseEvent) => {
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
        const translation = await translateWord(cleanWord);
        if (hoverRequestId.current === requestId) {
          setHoveredWord({ word: cleanWord, translation, x, y });
        }
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
      const prompt = `Jesteś nauczycielem języka. Stwórz tekst do czytania w języku: ${lang}.
Poziom: ${level}.
Temat: ${topic || 'dowolny ciekawy temat'}.
Liczba zdań: ${sentenceCount}.
${transcriptContext}
Zwróć wynik WYŁĄCZNIE jako JSON:
{
  "title": "tytuł tekstu",
  "sentences": [
    {"original": "zdanie w języku obcym", "translation": "tłumaczenie na polski"}
  ],
  "vocabulary": [
    {"word": "słówko", "translation": "tłumaczenie", "context": "zdanie z tekstu"}
  ],
  "questions": [
    {"question": "pytanie po polsku", "answer": "odpowiedź po polsku"}
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div className="space-y-3">
            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 ml-1">Język</label>
            <select value={lang} onChange={(e) => setLang(e.target.value)} className="w-full bg-white/50 dark:bg-slate-950/50 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl px-5 py-3.5 outline-none focus:ring-2 focus:ring-brand-500 transition-all font-semibold">
              {PRACTICE_LANGS.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
            </select>
          </div>
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
                            onMouseEnter={(e) => handleWordMouseEnter(word, e)}
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

function Sentences({ user, isKidMode }: { user: AuthUser, isKidMode: boolean }) {
  const [lang, setLang] = useState('en');
  const [level, setLevel] = useState('a1');
  const [topic, setTopic] = useState(PRACTICE_TOPICS[0].name);
  const [generating, setGenerating] = useState(false);
  const [sentences, setSentences] = useState<any[]>([]);
  const [showTranslations, setShowTranslations] = useState(true);
  const [selectedTranscript, setSelectedTranscript] = useState<TranscriptSource | null>(null);

  const generate = async () => {
    setGenerating(true);
    try {
      const transcriptContext = selectedTranscript
        ? `Bazuj na transkrypcji "${selectedTranscript.title}": ${selectedTranscript.transcript.slice(0, 8000)}.`
        : '';
      const prompt = `Jesteś nauczycielem języka. Stwórz 10 ciekawych zdań w języku: ${lang}.
Poziom: ${level}.
Temat: ${topic || 'codzienne sytuacje'}.
${transcriptContext}
Zwróć wynik WYŁĄCZNIE jako JSON (tablica obiektów):
[
  {"original": "zdanie", "translation": "tłumaczenie", "explanation": "krótkie wyjaśnienie gramatyki po polsku"}
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
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className={`text-2xl font-black tracking-tight ${isKidMode ? 'text-purple-600' : ''}`}>
          {isKidMode ? "Zabawa ze Zdaniami! 💬" : "Budowanie Zdań"}
        </h2>
        <div className="flex gap-3">
           <button 
            onClick={() => setShowTranslations(!showTranslations)}
            className={`px-6 py-2.5 rounded-2xl text-xs font-black transition-all glass border ${showTranslations ? 'bg-brand-500/10 text-brand-500 border-brand-500/20' : 'bg-white/5 text-slate-500 border-white/10'}`}
          >
            {showTranslations ? "Ukryj tłumaczenia" : "Pokaż tłumaczenia"}
          </button>
        </div>
      </div>

      <div className={`p-10 rounded-[2.5rem] border shadow-2xl space-y-8 transition-all glass ${isKidMode ? 'border-purple-100 shadow-purple-100/50' : 'border-white/20 dark:border-white/5'}`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <select value={lang} onChange={(e) => setLang(e.target.value)} className="glass border border-white/20 dark:border-white/5 rounded-2xl px-6 py-4 outline-none font-bold text-sm focus:ring-2 focus:ring-brand-500">
            {PRACTICE_LANGS.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
          </select>
          <select value={level} onChange={(e) => setLevel(e.target.value)} className="glass border border-white/20 dark:border-white/5 rounded-2xl px-6 py-4 outline-none font-bold text-sm focus:ring-2 focus:ring-brand-500">
            {CEFR_LEVELS.map(l => <option key={l.code} value={l.code}>{l.code.toUpperCase()} — {l.name}</option>)}
          </select>
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
          className={`w-full py-5 rounded-2xl font-black shadow-2xl transition-all flex items-center justify-center gap-4 disabled:opacity-50 transform active:scale-[0.98] ${isKidMode ? 'brand-gradient text-white' : 'brand-gradient text-white brand-shadow'}`}
        >
          {generating ? <Loader2 className="h-7 w-7 animate-spin" /> : <Sparkles className="h-7 w-7" />}
          <span className="text-xl">{isKidMode ? "Stwórz zdania! ✨" : "Generuj zdania"}</span>
        </button>
      </div>

      <div className="grid gap-6">
        {sentences.map((s, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className={`p-8 rounded-[2rem] border shadow-xl transition-all glass hover:shadow-2xl hover:-translate-y-1 ${isKidMode ? 'border-purple-50 hover:border-purple-200' : 'border-white/20 dark:border-white/5'}`}
          >
            <p className="text-2xl font-black tracking-tight mb-4 leading-relaxed">{s.original}</p>
            <AnimatePresence>
              {showTranslations && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                  <p className="text-lg text-brand-500 font-bold mb-3 tracking-tight">{s.translation}</p>
                  <p className="text-sm text-slate-400 font-medium italic leading-relaxed">{s.explanation}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function Challenge({ user, isKidMode }: { user: AuthUser, isKidMode: boolean }) {
  const [lang, setLang] = useState('en');
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
      const prompt = `Jesteś nauczycielem języka. Stwórz codzienne wyzwanie pisemne w języku: ${lang}.
Poziom: ${level}.
Temat: ${topic}.
Zwróć wynik WYŁĄCZNIE jako JSON:
{
  "title": "tytuł wyzwania",
  "prompt": "polecenie co uczeń ma napisać (po polsku)",
  "hints": ["podpowiedź 1", "podpowiedź 2"]
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
      const prompt = `Oceń odpowiedź ucznia na wyzwanie: "${challenge.title}".
Polecenie brzmiało: "${challenge.prompt}".
Odpowiedź ucznia: "${answer}".
Język: ${lang}.
Oceń w skali 0-100. Podaj feedback po polsku.
Zwróć wynik WYŁĄCZNIE jako JSON:
{
  "score": 85,
  "feedback": "Twoja opinia po polsku",
  "correction": "poprawiona wersja tekstu"
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
            <select value={lang} onChange={(e) => setLang(e.target.value)} className="glass border border-white/20 dark:border-white/5 rounded-2xl px-6 py-4 outline-none font-bold text-sm focus:ring-2 focus:ring-brand-500">
              {PRACTICE_LANGS.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
            </select>
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

function TranscriptViewer({ user, isKidMode }: { user: AuthUser, isKidMode: boolean }) {
  const [lang, setLang] = useState('en');
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
    const chunks = Math.ceil(selectedTranscript.transcript.replace(/\s+/g, ' ').trim().length / 1400);
    setFormatStatus(`Formatowanie AI (${chunks} ${chunks === 1 ? 'fragment' : chunks < 5 ? 'fragmenty' : 'fragmentów'})…`);
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

  const speak = (text: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    window.speechSynthesis.speak(utterance);
  };

  const translateWord = async (word: string): Promise<string | null> => {
    try {
      const prompt = `Przetłumacz słowo "${word}" z języka o kodzie "${lang}" na polski. Podaj tylko samo tłumaczenie, bez dodatkowego tekstu.`;
      const text = await requestAiText(prompt, false);
      return text.trim() || null;
    } catch {
      return null;
    }
  };

  const handleWordMouseEnter = (word: string, e: React.MouseEvent) => {
    const x = e.clientX;
    const y = e.clientY;
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    hoverTimeout.current = setTimeout(async () => {
      if (isTranslating.current) return;
      const clean = word.replace(/[.,!?;:"""„]/g, '').trim();
      if (!clean) return;
      const requestId = ++hoverRequestId.current;
      isTranslating.current = true;
      const translation = await translateWord(clean);
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
          <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 ml-1">Język transkrypcji</label>
          <select
            value={lang}
            onChange={(e) => { setLang(e.target.value); setSelectedTranscript(null); }}
            className="w-full sm:w-64 bg-white/50 dark:bg-slate-950/50 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl px-5 py-3.5 outline-none focus:ring-2 focus:ring-brand-500 transition-all font-semibold"
          >
            {PRACTICE_LANGS.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
          </select>
        </div>
        <TranscriptPicker
          userId={user.id}
          lang={lang}
          selectedId={selectedTranscript?.id || null}
          onSelect={setSelectedTranscript}
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
                  Formatuj AI
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
                        onMouseEnter={(e) => handleWordMouseEnter(word, e)}
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
