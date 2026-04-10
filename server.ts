import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import dotenv from "dotenv";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const getVideoId = require("get-video-id").default ?? require("get-video-id");

dotenv.config();

function stripMarkdownJson(text: string): string {
  // 1. Remove <think>...</think> blocks (reasoning models like liquid, deepseek-r1, qwq)
  let s = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // 2. Extract from ```json ... ``` or ``` ... ``` fences
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenced) s = fenced[1].trim();

  // 3. Scan for the first JSON array '[' or object '{' and slice to last matching bracket.
  //    This handles models that prepend/append prose around the JSON.
  const arrIdx = s.indexOf('[');
  const objIdx = s.indexOf('{');
  let start = -1;
  let endChar = '';

  if (arrIdx !== -1 && (objIdx === -1 || arrIdx < objIdx)) {
    start = arrIdx; endChar = ']';
  } else if (objIdx !== -1) {
    start = objIdx; endChar = '}';
  }

  if (start !== -1) {
    const end = s.lastIndexOf(endChar);
    if (end > start) return s.slice(start, end + 1);
  }

  return s;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchYouTubeTranscript(url: string): Promise<{ title: string; transcript: string; videoId: string }> {
  const { id: videoId } = getVideoId(url);
  if (!videoId) throw new Error("Nieprawidłowy link YouTube");

  const apiKey = process.env.SUPADATA_API_KEY;
  if (!apiKey) throw new Error("Brak klucza SUPADATA_API_KEY - skonfiguruj go w zmiennych środowiskowych");

  const resp = await fetchWithTimeout(
    `https://api.supadata.ai/v1/youtube/transcript?url=${encodeURIComponent(url)}&text=true`,
    { headers: { "x-api-key": apiKey } },
    20000
  );

  const data = await resp.json() as any;
  if (!resp.ok) throw new Error(data?.message || "Błąd Supadata API");

  const transcript = typeof data.content === "string" ? data.content.trim() : "";
  if (!transcript) throw new Error("Brak transkrypcji dla tego filmu");

  let title = `YouTube ${videoId}`;
  try {
    const oembedResp = await fetchWithTimeout(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      {},
      5000
    );
    if (oembedResp.ok) {
      const oembedData = await oembedResp.json() as any;
      if (typeof oembedData?.title === "string" && oembedData.title.trim()) {
        title = oembedData.title.trim();
      }
    }
  } catch {
    // oEmbed is best-effort; fall back to videoId title
  }

  return { title, transcript, videoId };
}

function resolvePrompt(body: any): string {
  if (typeof body?.prompt === "string" && body.prompt.trim()) {
    return body.prompt.trim();
  }

  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const firstUserMessage = messages.find(
    (msg: any) => msg?.role === "user" && typeof msg?.content === "string" && msg.content.trim()
  );

  if (firstUserMessage) {
    return firstUserMessage.content.trim();
  }

  return "";
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function callAI(prompt: string): Promise<string> {
  const model = process.env.OPENROUTER_MODEL || "openrouter/free";
  const response = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.APP_URL || "https://polyglotai.onrender.com",
    },
    body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }] }),
  }, 60000);
  const data = await response.json() as any;
  if (!response.ok || data.error) throw new Error(data.error?.message || "AI error");
  return data.choices[0].message.content as string;
}

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "3000", 10);

  app.use(express.json());

  // Disable all caching
  app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    next();
  });

  // Version check
  app.get("/version", (req, res) => {
    res.json({ version: "v2-indigo", build: process.env.BUILD_ID || "unknown" });
  });

  // --- API ROUTES ---

  // AI Proxy
  app.post("/api/ai/generate", async (req, res) => {
    const startedAt = Date.now();
    try {
      const { isJson } = req.body;
      const prompt = resolvePrompt(req.body);
      if (!prompt) {
        return res.status(400).json({ error: "Brak promptu do wygenerowania odpowiedzi AI" });
      }
      const model = process.env.OPENROUTER_MODEL || "openrouter/free";
      console.log(`[AI] model=${model} isJson=${isJson} prompt=${prompt.slice(0, 100)}...`);
      const response = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.APP_URL || "https://polyglotai.onrender.com",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
        }),
      }, 60000);
      const data = await response.json() as any;
      console.log(`[AI] status=${response.status} durationMs=${Date.now() - startedAt} data=${JSON.stringify(data).slice(0, 300)}`);
      if (!response.ok || data.error) {
        return res.status(response.status || 500).json({ error: data.error?.message || "AI error" });
      }
      const rawText = data.choices[0].message.content;
      res.json({ text: isJson ? stripMarkdownJson(rawText) : rawText });
    } catch (error) {
      console.error("AI Error:", { error, durationMs: Date.now() - startedAt });
      res.status(500).json({ error: "Błąd generowania AI" });
    }
  });

  // Transcript sources: List
  app.get("/api/transcripts", async (req, res) => {
    try {
      const { userId, lang } = req.query;
      if (!userId) return res.status(400).json({ error: "Brak userId" });
      const transcripts = await prisma.transcriptSource.findMany({
        where: {
          userId: String(userId),
          lang: lang ? String(lang) : undefined,
        },
        orderBy: { createdAt: "desc" },
      });
      res.json(transcripts);
    } catch (error) {
      res.status(500).json({ error: "Błąd pobierania transkrypcji" });
    }
  });

  // Transcript sources: Import from URL
  app.post("/api/transcripts/import", async (req, res) => {
    const startedAt = Date.now();
    try {
      const { userId, url, lang } = req.body;
      if (!userId || !url) return res.status(400).json({ error: "Brak danych wejściowych" });
      console.log(`[TRANSCRIPT] import:start userId=${userId} url=${url}`);
      const { title, transcript, videoId } = await fetchYouTubeTranscript(String(url));

      const existing = await prisma.transcriptSource.findFirst({
        where: {
          userId: String(userId),
          url: String(url),
        },
      });

      if (existing) return res.json(existing);

      const created = await prisma.transcriptSource.create({
        data: {
          userId: String(userId),
          url: String(url),
          videoId,
          title,
          transcript,
          lang: lang || "en",
        },
      });
      console.log(`[TRANSCRIPT] import:ok userId=${userId} videoId=${videoId} durationMs=${Date.now() - startedAt}`);
      res.json(created);
    } catch (error: any) {
      console.error(`[TRANSCRIPT] import:error durationMs=${Date.now() - startedAt}`, error?.message || error);
      res.status(500).json({ error: error?.message || "Błąd importu transkrypcji" });
    }
  });

  // Transcript sources: Delete
  app.delete("/api/transcripts/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleteGenerated = String(req.query.deleteGenerated || "false") === "true";
      if (deleteGenerated) {
        await prisma.flashcard.deleteMany({
          where: { transcriptSourceId: id },
        });
      }
      await prisma.transcriptSource.delete({ where: { id } });
      res.json({ success: true, deleteGenerated });
    } catch (error) {
      res.status(500).json({ error: "Błąd usuwania transkrypcji" });
    }
  });

  // Transcript sources: Format (heuristic - fast, no AI, works for any length)
  app.post("/api/transcripts/:id/format", async (req, res) => {
    try {
      const { id } = req.params;
      const source = await prisma.transcriptSource.findUnique({ where: { id } });
      if (!source) return res.status(404).json({ error: "Nie znaleziono transkrypcji" });

      const raw = source.transcript.replace(/\s+/g, ' ').trim();

      // Try sentence-based grouping (works when transcript has punctuation)
      const sentenceMatches = raw.match(/[^.!?]*[.!?]+(?:\s+|$)/g) ?? [];
      let transcript: string;

      if (sentenceMatches.length >= 5) {
        // Has enough punctuation – group every 3 sentences into a paragraph
        const paras: string[] = [];
        for (let i = 0; i < sentenceMatches.length; i += 3) {
          paras.push(sentenceMatches.slice(i, i + 3).join('').trim());
        }
        // Append any tail text not captured by the regex
        const tail = raw.slice(sentenceMatches.join('').length).trim();
        if (tail) paras.push(tail);
        transcript = paras.join('\n\n');
      } else {
        // No / little punctuation (common for YouTube auto-captions)
        // Split into paragraphs of ~55 words
        const words = raw.split(' ');
        const WORDS = 55;
        const paras: string[] = [];
        for (let i = 0; i < words.length; i += WORDS) {
          const chunk = words.slice(i, i + WORDS).join(' ');
          paras.push(chunk.charAt(0).toUpperCase() + chunk.slice(1));
        }
        transcript = paras.join('\n\n');
      }

      const updated = await prisma.transcriptSource.update({ where: { id }, data: { transcript } });
      console.log(`[FORMAT] id=${id} words=${raw.split(' ').length} paras=${transcript.split('\n\n').length}`);
      res.json(updated);
    } catch (error: any) {
      console.error("[FORMAT] error", error?.message || error);
      res.status(500).json({ error: error?.message || "Błąd formatowania transkrypcji" });
    }
  });

// Background: generate subtitle translations and cache in DB.
// Called fire-and-forget — never awaited by the HTTP response.
async function generateAndCachePLTranslations(id: string, segments: Array<{text: string; start: number; dur: number}>, targetLang = 'Polish') {
  try {
    const batch = segments.slice(0, 150);
    const lines = batch.map((s, i) => `${i}. ${s.text}`).join('\n').slice(0, 9000);
    const prompt = `Translate each line to ${targetLang}. Keep numbering. Format: "N. translation"\n\n${lines}`;
    console.log(`[TRANS] start bg translation id=${id} segs=${batch.length}`);
    const result = await callAI(prompt);
    const trans: Record<number, string> = {};
    result.split('\n').forEach(line => {
      const m = line.match(/^(\d+)\.\s*(.+)/);
      if (m) trans[parseInt(m[1])] = m[2].trim();
    });
    if (Object.keys(trans).length > 5) {
      await prisma.transcriptSource.update({ where: { id }, data: { segTranslations: trans } });
      console.log(`[TRANS] cached id=${id} count=${Object.keys(trans).length}`);
    }
  } catch (e: any) {
    console.error(`[TRANS] bg failed id=${id}:`, e?.message || e);
  }
}

// Background: analyse vocabulary (frequency, POS, translation, example sentence) and cache in DB.
async function generateWordAnalysis(id: string, transcript: string, lang: string) {
  try {
    const stopwords = new Set([
      // English
      'the','a','an','is','are','was','were','be','been','being','have','has','had','do','does','did',
      'will','would','could','should','may','might','shall','can','to','of','in','on','at','by','for',
      'with','about','from','into','through','during','before','after','above','below','up','down',
      'and','but','or','nor','so','yet','both','either','neither','not','no','if','then','than','that',
      'this','these','those','it','its','i','you','he','she','we','they','me','him','her','us','them',
      'my','your','his','our','their','what','which','who','whom','whose','when','where','why','how',
      'as','just','been','also','more','very','too','here','there','now','only','even','still','back',
      // German
      'der','die','das','des','dem','den','ein','eine','einen','einem','einer','eines',
      'und','oder','aber','auch','mit','für','von','aus','an','auf','bei','nach','seit',
      'über','unter','vor','hinter','neben','zwischen','durch','gegen','ohne','um',
      'ist','sind','war','waren','hat','haben','hatte','hatten','wird','werden','wurde','wurden',
      'kann','können','muss','müssen','soll','sollen','darf','dürfen','mag','mögen',
      'ich','du','er','sie','es','wir','ihr','sie','mich','dich','sich','uns','euch',
      'mein','dein','sein','ihr','unser','euer','dieser','diese','dieses','jeder','jede',
      'nicht','kein','keine','noch','schon','dann','wenn','weil','dass','damit','ob',
      'so','wie','als','nach','zu','ins','zum','zur','im','am','ans','vom','beim',
      // French
      'le','la','les','un','une','des','du','de','et','ou','mais','donc','car','que','qui','quoi',
      'je','tu','il','nous','vous','ils','me','te','se','lui','leur','mon','ton','son',
      // Spanish
      'el','los','las','del','al','en','con','por','para','sobre','entre','ante',
      'yo','tú','él','ella','nosotros','ellos','me','te','lo','le','nos','les',
      // Italian
      'il','lo','gli','una','degli','nei','sui','agli','dall','dell','nell',
      // Polish
      'się','jest','są','być','nie','to','że','na','w','z','do','i','a','ale','jak','po',
      'co','tak','już','czy','się','go','jej','jego','ich','nam','pan','pani',
    ]);

    const freqMap: Record<string, number> = {};
    // Normalise to lowercase, strip punctuation, split
    transcript.replace(/["""„«»]/g, ' ')
      .split(/[\s\n\r]+/)
      .forEach(raw => {
        const w = raw.replace(/^[^a-záéíóúüäöñàèìòùâêîôûçşğışçöü\w]+|[^a-záéíóúüäöñàèìòùâêîôûçşğışçöü\w]+$/gi, '').toLowerCase();
        if (w.length < 3 || stopwords.has(w) || /^\d+$/.test(w)) return;
        freqMap[w] = (freqMap[w] || 0) + 1;
      });

    const top60 = Object.entries(freqMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 60)
      .map(([word, freq]) => ({ word, freq }));

    if (top60.length < 3) return;

    const wordList = top60.map(({ word, freq }) => `"${word}" (${freq}x)`).join(', ');
    const textSample = transcript.slice(0, 4000);

    const prompt = `Jesteś ekspertem języka "${lang}". Masz listę słów z tekstu i fragment tego tekstu.

ZADANIE: Dla każdego słowa z listy utwórz obiekt JSON z polami:
- "word": słowo dokładnie tak jak w liście (małe litery)
- "translation": POLSKIE tłumaczenie (PO POLSKU! np. "dom", "biegać", "piękny")
- "pos": DOKŁADNIE jedna z czterech wartości: "noun" (rzeczownik), "verb" (czasownik), "adj" (przymiotnik), "adv" (przysłówek)
- "example": krótkie zdanie (max 100 znaków) DOSŁOWNIE skopiowane z poniższego tekstu, które zawiera to słowo; jeśli nie ma — zostaw pusty string ""
- "freq": liczba wystąpień (podana w nawiasie)

WAŻNE:
- "translation" MUSI być po POLSKU — nie po angielsku, nie po niemiecku, nie po włosku!
- "pos" MUSI być dokładnie jedną z: noun / verb / adj / adv
- Odpowiedz TYLKO JSON array [], bez żadnego tekstu przed ani po

Lista słów: ${wordList}

Fragment tekstu (źródło przykładów):
${textSample}`;

    console.log(`[VOCAB] start bg analysis id=${id} words=${top60.length} lang=${lang}`);
    const result = await callAI(prompt);

    let words: any[] = [];
    try {
      const cleaned = stripMarkdownJson(result);
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) words = parsed;
    } catch {
      const match = result.match(/\[[\s\S]+\]/);
      if (match) {
        try { words = JSON.parse(match[0]); } catch { return; }
      }
    }

    if (words.length > 3) {
      // Normalise POS to exactly one of the four allowed values
      const normalisePos = (pos: string): 'noun'|'verb'|'adj'|'adv' => {
        const p = String(pos || '').toLowerCase();
        if (p.includes('verb')) return 'verb';
        if (p.includes('adj')) return 'adj';
        if (p.includes('adv')) return 'adv';
        return 'noun';
      };
      words = words
        .filter(w => w.word && w.translation && w.translation.length > 0)
        .map(w => ({
          word:        String(w.word).toLowerCase().trim(),
          translation: String(w.translation).trim(),
          pos:         normalisePos(w.pos),
          example:     String(w.example || '').trim().slice(0, 120),
          freq:        Number(w.freq) || freqMap[String(w.word).toLowerCase()] || 1,
        }));
      await prisma.transcriptSource.update({ where: { id }, data: { wordAnalysis: words } });
      console.log(`[VOCAB] cached id=${id} count=${words.length}`);
    }
  } catch (e: any) {
    console.error(`[VOCAB] bg failed id=${id}:`, e?.message || e);
  }
}

// English names for major native languages (used in AI prompts)
const LANG_NAMES: Record<string, string> = {
  pl:'Polish', en:'English', de:'German', es:'Spanish', fr:'French', it:'Italian',
  pt:'Portuguese', ru:'Russian', zh:'Chinese', ja:'Japanese', ko:'Korean', ar:'Arabic',
  nl:'Dutch', sv:'Swedish', no:'Norwegian', da:'Danish', fi:'Finnish', cs:'Czech',
  sk:'Slovak', hu:'Hungarian', ro:'Romanian', bg:'Bulgarian', hr:'Croatian', uk:'Ukrainian',
  tr:'Turkish', el:'Greek', he:'Hebrew', vi:'Vietnamese', th:'Thai', id:'Indonesian',
};

app.get("/api/transcripts/:id/segments", async (req, res) => {
    try {
      const { id } = req.params;
      const nativeLang = String(req.query.nativeLang || 'pl');
      const targetLang = LANG_NAMES[nativeLang] || 'Polish';
      const source = await prisma.transcriptSource.findUnique({ where: { id } });
      if (!source) return res.status(404).json({ error: "Nie znaleziono transkrypcji" });

      // Supadata returns offset/duration in MILLISECONDS.
      // Normalise to seconds and use consistent {text, start, dur} field names.
      const normaliseToSeconds = (raw: any[]): Array<{text: string; start: number; dur: number}> => {
        // Detect if values are in ms: if the gap between first two segments > 30,
        // they must be in ms (real caption gaps are 1-10 seconds, not 30+ seconds)
        const secondVal = Number(raw[1]?.start ?? raw[1]?.offset ?? 0);
        const firstVal  = Number(raw[0]?.start ?? raw[0]?.offset ?? 0);
        const gap = raw.length > 1 ? secondVal - firstVal : 0;
        const divisor = gap > 30 ? 1000 : 1; // divide ms → seconds
        return raw.map((seg: any) => ({
          text:  String(seg.text || ""),
          start: Number(seg.start ?? seg.offset ?? 0) / divisor,
          dur:   Number(seg.dur   ?? seg.duration ?? 0) / divisor,
        }));
      };

      // Return cached segments – invalidate if stored in ms (gap between first two > 30)
      if (source.segments) {
        const cached = Array.isArray(source.segments) ? source.segments : [];
        if (cached.length > 0) {
          const gap = cached.length > 1
            ? Number((cached[1] as any).start ?? 0) - Number((cached[0] as any).start ?? 0)
            : 0;
          if (gap <= 30) {
            // Already in seconds — kick off background translation if not yet cached
            const hasTrans = source.segTranslations && Object.keys(source.segTranslations).length > 5;
            if (!hasTrans) {
              generateAndCachePLTranslations(id, cached as any, targetLang).catch(() => {});
            }
            // Kick off vocabulary analysis if not yet cached
            const hasVocab = Array.isArray(source.wordAnalysis) && (source.wordAnalysis as any[]).length > 3;
            if (!hasVocab && source.transcript) {
              generateWordAnalysis(id, source.transcript, source.lang).catch(() => {});
            }
            return res.json({
              segments: cached,
              translations: hasTrans ? source.segTranslations : null,
            });
          }
          console.log(`[SEGMENTS] stale ms cache id=${id} gap=${gap}, re-fetching`);
        }
      }

      // Fetch timed segments from Supadata (text=false returns array of caption objects)
      const apiKey = process.env.SUPADATA_API_KEY;
      if (!apiKey) return res.status(500).json({ error: "Brak klucza SUPADATA_API_KEY" });

      console.log(`[SEGMENTS] fetch:start id=${id} videoId=${source.videoId}`);
      const resp = await fetchWithTimeout(
        `https://api.supadata.ai/v1/youtube/transcript?url=${encodeURIComponent(source.url)}&text=false`,
        { headers: { "x-api-key": apiKey } },
        20000
      );

      const data = await resp.json() as any;
      if (!resp.ok) return res.status(500).json({ error: data?.message || "Błąd Supadata API" });

      const raw = Array.isArray(data.content) ? data.content : [];
      if (raw.length === 0) {
        return res.status(404).json({ error: "Brak segmentów czasowych dla tego filmiku (brak napisów)" });
      }

      const segments = normaliseToSeconds(raw);

      // Cache normalised segments in DB, then kick off background translation
      await prisma.transcriptSource.update({ where: { id }, data: { segments } });
      console.log(`[SEGMENTS] fetch:ok id=${id} count=${segments.length} sample=${JSON.stringify(segments[0])}`);
      generateAndCachePLTranslations(id, segments, targetLang).catch(() => {}); // fire-and-forget
      generateWordAnalysis(id, source.transcript, source.lang).catch(() => {}); // fire-and-forget
      res.json({ segments, translations: null });
    } catch (error: any) {
      console.error("[SEGMENTS] error:", error?.message || error);
      res.status(500).json({ error: error?.message || "Błąd pobierania segmentów" });
    }
  });

  // Transcript: Vocabulary analysis (word frequency + POS + translation, generated in background)
  app.get("/api/transcripts/:id/vocabulary", async (req, res) => {
    try {
      const { id } = req.params;
      const refresh = req.query.refresh === '1';
      const source = await prisma.transcriptSource.findUnique({
        where: { id },
        select: { wordAnalysis: true, transcript: true, lang: true },
      });
      if (!source) return res.status(404).json({ error: "Not found" });

      // Validate cached data — invalidate if POS tags are compound or not in allowed set
      const allowedPos = new Set(['noun','verb','adj','adv']);
      const cached = Array.isArray(source.wordAnalysis) ? source.wordAnalysis as any[] : [];
      const isValid = cached.length > 3 && cached.every(w => allowedPos.has(w.pos));

      if (refresh || !isValid) {
        if (isValid && !refresh) {
          // Data looks valid, don't regenerate
        } else {
          // Stale/bad data — clear and regenerate
          if (!isValid && cached.length > 0) {
            console.log(`[VOCAB] invalidating stale data id=${id}`);
            await prisma.transcriptSource.update({ where: { id }, data: { wordAnalysis: null } });
          }
          if (source.transcript) {
            generateWordAnalysis(id, source.transcript, source.lang).catch(() => {});
          }
          return res.json({ words: null, ready: false });
        }
      }

      res.json({ words: isValid ? source.wordAnalysis : null, ready: isValid });
    } catch (error: any) {
      res.status(500).json({ error: error?.message });
    }
  });

  // Transcript: Poll for cached Polish translations (generated in background)
  app.get("/api/transcripts/:id/translations", async (req, res) => {
    try {
      const { id } = req.params;
      const source = await prisma.transcriptSource.findUnique({
        where: { id },
        select: { segTranslations: true },
      });
      if (!source) return res.status(404).json({ error: "Not found" });
      const ready = source.segTranslations && Object.keys(source.segTranslations).length > 5;
      res.json({ translations: ready ? source.segTranslations : null, ready: !!ready });
    } catch (error: any) {
      res.status(500).json({ error: error?.message });
    }
  });

  // Practice: Save Result
  app.post("/api/practice/save", async (req, res) => {
    try {
      const { text, targetLang, level, userId, result } = req.body;
      
      await prisma.writingPractice.create({
        data: {
          targetLang,
          originalText: text,
          correctedText: result.corrected || "",
          mistakes: JSON.stringify(result.mistakes || []),
          score: result.score || 0,
          level: level || "none",
          userId: userId || null,
        },
      });

      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Błąd zapisu praktyki" });
    }
  });

  // Flashcards: List
  app.get("/api/flashcards", async (req, res) => {
    try {
      const { userId, lang, categoryId } = req.query;
      const cards = await prisma.flashcard.findMany({
        where: {
          userId: userId ? String(userId) : null,
          lang: lang ? String(lang) : undefined,
          categoryId: categoryId ? String(categoryId) : undefined,
        },
        orderBy: { createdAt: "desc" },
      });
      res.json(cards);
    } catch (error) {
      res.status(500).json({ error: "Błąd pobierania fiszek" });
    }
  });

  // Flashcards: Save Generated
  app.post("/api/flashcards/save", async (req, res) => {
    try {
      const { userId, lang, cards, transcriptSourceId } = req.body;
      console.log(`[FLASHCARDS] save:start userId=${userId} lang=${lang} cards=${Array.isArray(cards) ? cards.length : 0} transcriptSourceId=${transcriptSourceId || "none"}`);
      
      const savedCards = await Promise.all(cards.map((c: any) => 
        prisma.flashcard.create({
          data: {
            userId: userId || null,
            lang: lang || "en",
            front: c.front,
            back: c.back,
            status: "new",
            transcriptSourceId: transcriptSourceId || null,
          }
        })
      ));

      console.log(`[FLASHCARDS] save:ok count=${savedCards.length}`);
      res.json({ flashcards: savedCards });
    } catch (error) {
      console.error("[FLASHCARDS] save:error", error);
      res.status(500).json({ error: "Błąd zapisu fiszek" });
    }
  });

  // Flashcards: Update status
  app.put("/api/flashcards", async (req, res) => {
    try {
      const { id, status } = req.body;
      const card = await prisma.flashcard.update({
        where: { id },
        data: { 
          status,
          reviews: { increment: 1 },
          lastReview: new Date()
        },
      });
      res.json(card);
    } catch (error) {
      res.status(500).json({ error: "Błąd aktualizacji fiszki" });
    }
  });

  // Points: Get
  app.get("/api/points", async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId) return res.status(400).json({ error: "Brak userId" });
      
      let points = await prisma.userPoints.findUnique({
        where: { userId: String(userId) },
      });
      
      if (!points) {
        points = await prisma.userPoints.create({
          data: { userId: String(userId), points: 0, level: 1, streak: 0 },
        });
      }
      
      res.json(points);
    } catch (error) {
      res.status(500).json({ error: "Błąd pobierania punktów" });
    }
  });

  // Challenges: List
  app.get("/api/challenges", async (req, res) => {
    try {
      const challenges = await prisma.dailyChallenge.findMany({
        orderBy: { date: "desc" },
        take: 5
      });
      res.json(challenges);
    } catch (error) {
      res.status(500).json({ error: "Błąd pobierania wyzwań" });
    }
  });

  // Vocabulary: Add
  app.post("/api/vocabulary", async (req, res) => {
    try {
      const { word, translation, lang, userId, context, definition } = req.body;
      if (!word || !translation || !userId) return res.status(400).json({ error: "Brak danych" });

      const newWord = await prisma.vocabWord.create({
        data: {
          word,
          translation,
          lang,
          userId,
          context: context || "",
          definition: definition || ""
        },
      });
      res.json(newWord);
    } catch (error) {
      res.status(500).json({ error: "Błąd dodawania słówka" });
    }
  });

  // Vocabulary: Delete
  app.delete("/api/vocabulary/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await prisma.vocabWord.delete({ where: { id } });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Błąd usuwania słówka" });
    }
  });

  // Vocabulary: List
  app.get("/api/vocabulary", async (req, res) => {
    try {
      const { userId, lang } = req.query;
      const words = await prisma.vocabWord.findMany({
        where: {
          userId: userId ? String(userId) : null,
          lang: lang ? String(lang) : undefined,
        },
        orderBy: { createdAt: "desc" },
      });
      res.json(words);
    } catch (error) {
      res.status(500).json({ error: "Błąd pobierania słówek" });
    }
  });

  // Auth: Register
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { name, pin } = req.body;
      if (!name?.trim() || !pin?.trim()) return res.status(400).json({ error: "Podaj imię i PIN" });
      
      const trimmedName = name.trim().slice(0, 30);
      const trimmedPin = pin.trim().slice(0, 8);
      
      if (trimmedPin.length < 4) return res.status(400).json({ error: "PIN musi mieć minimum 4 cyfry" });
      if (!/^\d+$/.test(trimmedPin)) return res.status(400).json({ error: "PIN może zawierać tylko cyfry" });

      const existing = await prisma.pinAccount.findFirst({ where: { name: trimmedName } });
      if (existing) return res.status(409).json({ error: "Użytkownik o tym imieniu już istnieje" });

      const hashedPin = crypto.createHash("sha256").update(trimmedPin).digest("hex");
      const token = crypto.createHash("sha256").update(`${trimmedName}${Date.now()}${trimmedPin}`).digest("hex");

      const account = await prisma.pinAccount.create({
        data: { name: trimmedName, pin: hashedPin, token },
      });

      res.json({ success: true, user: { id: account.id, name: account.name }, token: account.token });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Błąd podczas rejestracji" });
    }
  });

  // Auth: Login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { name, pin } = req.body;
      if (!name?.trim() || !pin?.trim()) return res.status(400).json({ error: "Podaj imię i PIN" });

      const account = await prisma.pinAccount.findFirst({ where: { name: name.trim() } });
      if (!account) return res.status(404).json({ error: "Nie znaleziono użytkownika" });

      const hashedPin = crypto.createHash("sha256").update(pin.trim()).digest("hex");
      if (account.pin !== hashedPin) return res.status(401).json({ error: "Nieprawidłowy PIN" });

      res.json({ success: true, user: { id: account.id, name: account.name }, token: account.token });
    } catch (error) {
      res.status(500).json({ error: "Błąd podczas logowania" });
    }
  });

  // Auth: Check
  app.post("/api/auth/check", async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) return res.status(400).json({ error: "Brak tokena" });

      const account = await prisma.pinAccount.findFirst({
        where: { token },
        select: { id: true, name: true, token: true },
      });

      if (!account) return res.json({ authenticated: false });
      res.json({ authenticated: true, user: { id: account.id, name: account.name }, token: account.token });
    } catch {
      res.json({ authenticated: false });
    }
  });

  // Translation: Save
  app.post("/api/translate/save", async (req, res) => {
    try {
      const { sourceText, sourceLang, targetLang, level, style, userId, translation } = req.body;

      // Save to DB
      await prisma.translation.create({
        data: { sourceLang, targetLang, sourceText, translatedText: translation || "", level, style, userId },
      });

      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Błąd zapisu tłumaczenia" });
    }
  });

  // Stats API
  app.get("/api/stats", async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId) return res.status(400).json({ error: "Brak userId" });
      const uid = String(userId);

      const [totalPractices, scoreResult, vocabCount, flashcardCount, recentRaw, userPoints] = await Promise.all([
        prisma.writingPractice.count({ where: { userId: uid } }),
        prisma.writingPractice.aggregate({
          where: { userId: uid },
          _avg: { score: true },
          _min: { score: true },
          _max: { score: true },
        }),
        prisma.vocabWord.count({ where: { userId: uid } }),
        prisma.flashcard.count({ where: { userId: uid } }),
        prisma.writingPractice.findMany({
          where: { userId: uid },
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: { score: true, targetLang: true, createdAt: true, mistakes: true },
        }),
        prisma.userPoints.findUnique({ where: { userId: uid } }),
      ]);

      // Language breakdown
      const languages: Record<string, number> = {};
      recentRaw.forEach(p => { languages[p.targetLang] = (languages[p.targetLang] || 0) + 1; });

      // Error categories from stored mistakes JSON
      const errorCategories: Record<string, number> = {};
      recentRaw.forEach(p => {
        try {
          const mistakes = JSON.parse(p.mistakes || '[]');
          if (Array.isArray(mistakes)) {
            mistakes.forEach((m: any) => {
              if (m?.category) errorCategories[m.category] = (errorCategories[m.category] || 0) + 1;
            });
          }
        } catch {}
      });

      // Score history oldest→newest for chart
      const scoreHistory = [...recentRaw].reverse().map(p => ({
        score: p.score,
        lang: p.targetLang,
        date: p.createdAt,
      }));

      // Recent practices newest first
      const recentPractices = recentRaw.slice(0, 5).map(p => ({
        score: p.score,
        lang: p.targetLang,
        date: p.createdAt,
        mistakeCount: (() => { try { return JSON.parse(p.mistakes || '[]').length; } catch { return 0; } })(),
      }));

      res.json({
        totalPractices,
        averageScore: Math.round(scoreResult._avg.score || 0),
        minScore: scoreResult._min.score || 0,
        maxScore: scoreResult._max.score || 0,
        streak: userPoints?.streak || 0,
        vocabCount,
        flashcardCount,
        scoreHistory,
        recentPractices,
        languages,
        errorCategories,
      });
    } catch (error) {
      res.status(500).json({ error: "Błąd statystyk" });
    }
  });

  // --- VITE MIDDLEWARE ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Seed challenges
  const seedChallenges = async () => {
    const count = await prisma.dailyChallenge.count();
    if (count === 0) {
      const today = new Date().toISOString().split('T')[0];
      await prisma.dailyChallenge.create({
        data: {
          date: today,
          prompt: "Napisz 3 zdania o swoim ulubionym zwierzątku!",
          lang: "en",
          level: "a1"
        }
      });
    }
  };
  seedChallenges().catch(e => console.error('[SEED]', e?.message || e));

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
