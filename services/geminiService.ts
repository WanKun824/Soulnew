
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Question, QuizAnswer, UserDemographics, MatchProfile, Language, QuestionType } from "../types";
import { MASTER_QUESTION_BANK } from "../data/questionBank";
import { calculateScores } from "./scoring";
import { saveToCache, getFromCache } from "./database";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const MODEL = 'gemini-3-flash-preview';

// ============================================================
// SEEDED PRNG (Mulberry32) & SHUFFLE
// ============================================================

function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(array: T[], seed: number): T[] {
  const rng = mulberry32(seed);
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ============================================================
// SOUL ID ENCODING
// Bit layout (209 bits = 27 bytes → 36 Base62 chars):
//   [0-15]   seed (uint16)
//   [16-22]  age-18 (uint7)
//   [23-24]  gender index
//   [25-26]  interestedIn
//   [27-28]  language
//   [29-208] 60 answers × 3 bits
// ============================================================

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const SOUL_ID_B62_LEN = 36;
const SOUL_ID_BYTE_LEN = 27;
const BIT_SCHEMA = [16, 7, 2, 2, 2, ...Array<number>(60).fill(3)];
const GENDER_LIST = ['male', 'female', 'non-binary'];
const INTERESTED_LIST = ['everyone', 'men', 'women'];
const LANG_LIST: Language[] = ['en', 'zh', 'ja'];

function bytesToBase62(bytes: Uint8Array): string {
  let num = BigInt(0);
  for (const b of bytes) num = (num << BigInt(8)) | BigInt(b);
  if (num === BigInt(0)) return BASE62[0].repeat(SOUL_ID_B62_LEN);
  let s = '';
  const big62 = BigInt(62);
  while (num > BigInt(0)) { s = BASE62[Number(num % big62)] + s; num /= big62; }
  return s.padStart(SOUL_ID_B62_LEN, BASE62[0]);
}

function base62ToBytes(str: string): Uint8Array {
  let num = BigInt(0);
  const big62 = BigInt(62);
  for (const ch of str) {
    const idx = BASE62.indexOf(ch);
    if (idx < 0) throw new Error(`Invalid Soul ID char: ${ch}`);
    num = num * big62 + BigInt(idx);
  }
  const bytes = new Uint8Array(SOUL_ID_BYTE_LEN);
  for (let i = SOUL_ID_BYTE_LEN - 1; i >= 0; i--) { bytes[i] = Number(num & BigInt(0xff)); num >>= BigInt(8); }
  return bytes;
}

function packBits(fields: { value: number; bits: number }[]): Uint8Array {
  const total = fields.reduce((s, f) => s + f.bits, 0);
  const buf = new Uint8Array(Math.ceil(total / 8));
  let pos = 0;
  for (const { value, bits } of fields) {
    for (let b = bits - 1; b >= 0; b--) {
      if ((value >> b) & 1) buf[Math.floor(pos / 8)] |= 1 << (7 - (pos % 8));
      pos++;
    }
  }
  return buf;
}

function unpackBits(buf: Uint8Array, schema: number[]): number[] {
  const out: number[] = [];
  let pos = 0;
  for (const bits of schema) {
    let v = 0;
    for (let b = bits - 1; b >= 0; b--) {
      if (pos < buf.length * 8 && (buf[Math.floor(pos / 8)] >> (7 - (pos % 8))) & 1) v |= 1 << b;
      pos++;
    }
    out.push(v);
  }
  return out;
}

export function encodeSoulId(
  seed: number, demographics: UserDemographics,
  questions: Question[], answers: QuizAnswer[], language: Language
): string {
  const age = Math.min(Math.max(parseInt(demographics.age || '22') - 18, 0), 82);
  const fields = [
    { value: seed & 0xffff, bits: 16 },
    { value: age, bits: 7 },
    { value: Math.max(0, GENDER_LIST.indexOf(demographics.gender)), bits: 2 },
    { value: Math.max(0, INTERESTED_LIST.indexOf(demographics.interestedIn)), bits: 2 },
    { value: Math.max(0, LANG_LIST.indexOf(language)), bits: 2 },
    ...questions.map(q => {
      const ans = answers.find(a => a.questionId === q.id);
      return { value: Math.min(Math.max((ans?.value ?? 3) - 1, 0), 4), bits: 3 };
    }),
  ];
  const raw = bytesToBase62(packBits(fields));
  return `${raw.slice(0, 6)}-${raw.slice(6)}`;
}

export function decodeSoulId(soulId: string): {
  seed: number; demographics: UserDemographics; answerValues: number[]; language: Language;
} | null {
  try {
    const raw = soulId.replace(/-/g, '');
    if (raw.length !== SOUL_ID_B62_LEN) return null;
    if (![...raw].every(c => BASE62.includes(c))) return null;
    const vals = unpackBits(base62ToBytes(raw), BIT_SCHEMA);
    const [seed, ageDelta, genderIdx, intIdx, langIdx, ...rawAnswers] = vals;
    return {
      seed,
      demographics: {
        age: String(Math.max(18, ageDelta + 18)),
        gender: GENDER_LIST[Math.min(genderIdx, 2)],
        interestedIn: INTERESTED_LIST[Math.min(intIdx, 2)],
      },
      answerValues: rawAnswers.slice(0, 60).map(v => Math.min(Math.max(v + 1, 1), 5)),
      language: LANG_LIST[Math.min(langIdx, 2)],
    };
  } catch { return null; }
}

// ============================================================
// QUESTION GENERATION
// ============================================================

export const generateQuizQuestions = async (
  language: Language = 'en', seed?: number
): Promise<{ questions: Question[]; seed: number }> => {
  const { Dimension } = await import('../types');
  const actualSeed = seed ?? Math.floor(Math.random() * 65536);
  const selectedQuestions: Question[] = [];
  const dimensions = [Dimension.WEALTH, Dimension.FAMILY, Dimension.LIFESTYLE, Dimension.COMMUNICATION, Dimension.GROWTH];
  dimensions.forEach(dim => {
    const shuffled = seededShuffle(MASTER_QUESTION_BANK.filter(q => q.dimension === dim), actualSeed);
    shuffled.slice(0, 12).forEach(q => selectedQuestions.push({
      id: q.id, text: q.text[language], dimension: dim, questionType: 'likert' as QuestionType,
    }));
  });
  return { questions: selectedQuestions, seed: actualSeed };
};

export const translateQuestions = (currentQuestions: Question[], targetLang: Language): Question[] =>
  currentQuestions.map(q => {
    const masterQ = MASTER_QUESTION_BANK.find(mq => mq.id === q.id);
    return masterQ ? { ...q, text: masterQ.text[targetLang] } : q;
  });

// ============================================================
// AI ANALYSIS
// ============================================================

interface AIResult {
  summary: string;
  mbtiType: string;
  idealPartner: { description: string; traits: string[]; dealBreakers: string[] };
  compatibilityAdvice: string;
}

const LOCAL_FALLBACK: Record<Language, AIResult> = {
  en: {
    mbtiType: 'The Harmonic Traveler',
    summary: 'Your soul profile is crystallizing — connect to the network for a full deep analysis.',
    idealPartner: { description: 'Someone who aligns with your core truth.', traits: ['Empathy', 'Respect', 'Growth'], dealBreakers: ['Dishonesty', 'Stagnation'] },
    compatibilityAdvice: 'Reload when online for personalised guidance.',
  },
  zh: {
    mbtiType: '和谐的旅人',
    summary: '您的灵魂映像正在凝聚——请连接网络以获取完整深度解析。',
    idealPartner: { description: '一个能理解你核心价值观的人。', traits: ['共情', '尊重', '成长'], dealBreakers: ['虚伪', '停滞'] },
    compatibilityAdvice: '网络恢复后重新加载，获取专属建议。',
  },
  ja: {
    mbtiType: '調和のとれた旅人',
    summary: 'あなたの魂の映像が形になりつつあります。ネットワークに接続して完全な分析を取得してください。',
    idealPartner: { description: 'あなたの核心的な真実と一致する人。', traits: ['共感', '尊重', '成長'], dealBreakers: ['不誠実', '停滞'] },
    compatibilityAdvice: 'オンラインになったらリロードして個別のガイダンスを取得してください。',
  },
};

const callGeminiAI = async (
  demographics: UserDemographics, questions: Question[],
  answers: QuizAnswer[], language: Language
): Promise<AIResult | null> => {
  if (!apiKey) return null;
  const transcript = questions.map(q => {
    const ans = answers.find(a => a.questionId === q.id);
    return `[${q.dimension}] ${q.text.substring(0, 50)}... : ${ans?.value ?? '?'}/5`;
  }).join('\n');
  const langName = language === 'zh' ? 'Simplified Chinese' : language === 'ja' ? 'Japanese' : 'English';
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      summary: { type: Type.STRING },
      mbtiType: { type: Type.STRING, description: "A creative, metaphorical soul title" },
      idealPartner: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING },
          traits: { type: Type.ARRAY, items: { type: Type.STRING } },
          dealBreakers: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
      },
      compatibilityAdvice: { type: Type.STRING },
    },
  };
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: `You are a world-class relationship psychologist. Analyze this 60-question "Soul Journey" profile.
Input: Age/Gender/Seeking: ${demographics.age}, ${demographics.gender}, ${demographics.interestedIn}
Answers (1=Strongly Disagree, 5=Strongly Agree):
${transcript}

Generate:
1. Soul Title: A poetic archetype (e.g. "The Velvet Storm").
2. Deep Summary: Profound analysis of their inner contradictions using metaphors grounded in data.
3. Ideal Partner: Description paragraph + 3-5 magnetic traits to seek + 3-5 dealbreakers.
4. Compatibility Advice: One specific, actionable relationship tip.

Output Language: ${langName}. ALL JSON string values MUST be in ${langName}.`,
      config: { responseMimeType: 'application/json', responseSchema: schema },
    });
    if (response.text) return JSON.parse(response.text) as AIResult;
    return null;
  } catch (e) {
    console.warn('Gemini call failed, using offline fallback', e);
    return null;
  }
};

// ============================================================
// PUBLIC API
// ============================================================

export const analyzeProfile = async (
  demographics: UserDemographics, questions: Question[],
  answers: QuizAnswer[], language: Language, seed: number
): Promise<MatchProfile> => {
  const aiResult = (await callGeminiAI(demographics, questions, answers, language)) ?? LOCAL_FALLBACK[language];
  const scores = calculateScores(questions, answers, language);
  const soulId = encodeSoulId(seed, demographics, questions, answers, language);
  const profile: MatchProfile = {
    soulId, summary: aiResult.summary, mbtiType: aiResult.mbtiType, scores,
    idealPartner: aiResult.idealPartner, compatibilityAdvice: aiResult.compatibilityAdvice,
    timestamp: Date.now(), history: { questions, answers }, seed,
  };
  await saveToCache(profile);
  return profile;
};

export const getProfileBySoulId = async (soulId: string): Promise<MatchProfile | null> => {
  const cached = getFromCache(soulId);
  if (cached) return cached;

  const decoded = decodeSoulId(soulId);
  if (!decoded) return null;

  const { questions } = await generateQuizQuestions(decoded.language, decoded.seed);
  const answers: QuizAnswer[] = decoded.answerValues.map((v, i) => ({
    questionId: questions[i]?.id ?? i, value: v as import('../types').LikertValue,
  }));

  const aiResult = (await callGeminiAI(decoded.demographics, questions, answers, decoded.language)) ?? LOCAL_FALLBACK[decoded.language];
  const scores = calculateScores(questions, answers, decoded.language);
  const profile: MatchProfile = {
    soulId, summary: aiResult.summary, mbtiType: aiResult.mbtiType, scores,
    idealPartner: aiResult.idealPartner, compatibilityAdvice: aiResult.compatibilityAdvice,
    timestamp: Date.now(), history: { questions, answers }, seed: decoded.seed,
  };
  await saveToCache(profile);
  return profile;
};
