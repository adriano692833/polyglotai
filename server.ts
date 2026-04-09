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

  // Transcript sources: Format with AI
  app.post("/api/transcripts/:id/format", async (req, res) => {
    const startedAt = Date.now();
    try {
      const { id } = req.params;
      const source = await prisma.transcriptSource.findUnique({ where: { id } });
      if (!source) return res.status(404).json({ error: "Nie znaleziono transkrypcji" });

      // Split into ~1400-char chunks at word boundaries to stay within free model token limits
      const CHUNK_SIZE = 1400;
      const raw = source.transcript.replace(/\s+/g, ' ').trim();
      const chunks: string[] = [];
      let pos = 0;
      while (pos < raw.length) {
        let end = Math.min(pos + CHUNK_SIZE, raw.length);
        // Break at last space to avoid cutting a word
        if (end < raw.length) {
          const lastSpace = raw.lastIndexOf(' ', end);
          if (lastSpace > pos) end = lastSpace;
        }
        chunks.push(raw.slice(pos, end).trim());
        pos = end + 1;
      }

      console.log(`[FORMAT] id=${id} chunks=${chunks.length} rawLen=${raw.length}`);

      const formatted: string[] = [];
      for (let i = 0; i < chunks.length; i++) {
        const prompt = `Poniższy tekst to fragment transkrypcji wideo (część ${i + 1} z ${chunks.length}). Podziel go na akapity (2-4 zdania każdy), dodaj brakującą interpunkcję i popraw wielkie litery na początku zdań. Nie tłumacz, nie skracaj, nie zmieniaj słów. Zwróć TYLKO sformatowany tekst, bez komentarzy:\n\n${chunks[i]}`;
        const result = await callAI(prompt);
        // Strip any think tags or markdown the model might add
        formatted.push(stripMarkdownJson(result));
      }

      const transcript = formatted.join('\n\n');
      const updated = await prisma.transcriptSource.update({
        where: { id },
        data: { transcript },
      });

      console.log(`[FORMAT] done id=${id} durationMs=${Date.now() - startedAt}`);
      res.json(updated);
    } catch (error: any) {
      console.error(`[FORMAT] error durationMs=${Date.now() - startedAt}`, error?.message || error);
      res.status(500).json({ error: error?.message || "Błąd formatowania transkrypcji" });
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
      const { word, translation, lang, userId } = req.body;
      if (!word || !translation || !userId) return res.status(400).json({ error: "Brak danych" });
      
      const newWord = await prisma.vocabWord.create({
        data: { 
          word, 
          translation, 
          lang, 
          userId,
          context: "",
          definition: ""
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

      const totalPractices = await prisma.writingPractice.count({ where: { userId: String(userId) } });
      const scoreResult = await prisma.writingPractice.aggregate({
        where: { userId: String(userId) },
        _avg: { score: true },
        _min: { score: true },
        _max: { score: true },
      });

      res.json({
        totalPractices,
        averageScore: Math.round(scoreResult._avg.score || 0),
        minScore: scoreResult._min.score || 0,
        maxScore: scoreResult._max.score || 0,
        streak: 0, // Placeholder
        vocabCount: await prisma.vocabWord.count({ where: { userId: String(userId) } }),
        flashcards: {}, // Placeholder
        scoreHistory: [],
        recentPractices: [],
        languages: {},
        errorCategories: {}
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
  seedChallenges();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
