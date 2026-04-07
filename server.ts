import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function startServer() {
  const app = express();
  const PORT = 3000;

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
    try {
      const { prompt, isJson } = req.body;
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: isJson ? { responseMimeType: "application/json" } : undefined
      });
      res.json({ text: response.text });
    } catch (error) {
      console.error("AI Error:", error);
      res.status(500).json({ error: "Błąd generowania AI" });
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
      const { userId, lang, cards } = req.body;
      
      const savedCards = await Promise.all(cards.map((c: any) => 
        prisma.flashcard.create({
          data: {
            userId: userId || null,
            lang: lang || "en",
            front: c.front,
            back: c.back,
            status: "new",
          }
        })
      ));

      res.json({ flashcards: savedCards });
    } catch (error) {
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
