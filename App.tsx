import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WelcomeScreen } from './components/WelcomeScreen';

// Lazily load heavier screens
const QuizScreen = React.lazy(() => import('./components/QuizScreen').then(m => ({ default: m.QuizScreen })));
const ResultsScreen = React.lazy(() => import('./components/ResultsScreen').then(m => ({ default: m.ResultsScreen })));
const LookupScreen = React.lazy(() => import('./components/LookupScreen').then(m => ({ default: m.LookupScreen })));

import { ToastContainer, useToast } from './components/Toast';
import { AppStep, Question, UserDemographics, QuizAnswer, MatchProfile, Language } from './types';
import { generateQuizQuestions, analyzeProfile, getProfileBySoulId, translateQuestions } from './services/geminiService';
import { Loader2 } from 'lucide-react';
import { translations } from './utils/translations';

// ── Animated analysis messages ────────────────────────
const ANALYSIS_MESSAGES_ZH = [
  '正在解析你的金钱观模式…',
  '深度扫描家庭边界结构…',
  '绘制情绪雷达图谱…',
  '寻找与你灵魂共鸣的频率…',
  '生成专属灵魂档案…',
];
const ANALYSIS_MESSAGES_EN = [
  'Decoding your financial patterns…',
  'Scanning family boundary structures…',
  'Mapping your emotional radar…',
  'Finding your soul resonance frequency…',
  'Generating your soul profile…',
];
const ANALYSIS_MESSAGES_JA = [
  '金銭パターンを解析中…',
  '家族の境界構造をスキャン中…',
  '感情レーダーマップを描画中…',
  '魂の共鳴周波数を探索中…',
  '専属ソウルプロファイルを生成中…',
];
const ANALYSIS_MSGS: Record<Language, string[]> = {
  zh: ANALYSIS_MESSAGES_ZH, en: ANALYSIS_MESSAGES_EN, ja: ANALYSIS_MESSAGES_JA,
};

function AnalyzingScreen({ language }: { language: Language }) {
  const msgs = ANALYSIS_MSGS[language] ?? ANALYSIS_MESSAGES_ZH;
  const [msgIdx, setMsgIdx] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const msgInterval = setInterval(() => setMsgIdx(i => Math.min(i + 1, msgs.length - 1)), 4500);
    const progInterval = setInterval(() => setProgress(p => Math.min(p + 1.2, 95)), 500);
    return () => { clearInterval(msgInterval); clearInterval(progInterval); };
  }, [msgs.length]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center text-white px-6 gap-8">
      {/* Spinner with glow */}
      <div className="relative">
        <div className="absolute inset-0 bg-indigo-500 blur-3xl opacity-20 animate-pulse" />
        <Loader2 className="w-10 h-10 text-white/60 animate-spin relative z-10" />
      </div>

      {/* Animated message */}
      <div className="h-8 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.p
            key={msgIdx}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.4 }}
            className="text-lg font-light text-white/80 tracking-tight"
          >
            {msgs[msgIdx]}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Pseudo progress bar */}
      <div className="w-56 h-0.5 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-indigo-400 to-rose-400 rounded-full"
          style={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>

      {/* Progress dots */}
      <div className="flex gap-2">
        {msgs.map((_, i) => (
          <motion.div key={i}
            className="w-1.5 h-1.5 rounded-full"
            animate={{ background: i <= msgIdx ? '#a5b4fc' : 'rgba(255,255,255,0.15)' }}
            transition={{ duration: 0.3 }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────
export default function App() {
  const [step, setStep] = useState<AppStep>(AppStep.WELCOME);
  const [demographics, setDemographics] = useState<UserDemographics | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionSeed, setQuestionSeed] = useState<number>(0);
  const [profile, setProfile] = useState<MatchProfile | null>(null);
  const [language, setLanguage] = useState<Language>('zh');
  const { toasts, showToast, dismiss } = useToast();

  // Handle ?code= URL param for direct Soul ID lookup
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code');
    if (code) {
      setStep(AppStep.LOADING_QUIZ);
      getProfileBySoulId(code).then(p => {
        setProfile(p ?? null);
        setStep(p ? AppStep.RESULTS : AppStep.LOOKUP);
        if (!p) showToast('未找到对应档案，请检查特征码', 'error');
      });
    }
  }, []);

  const t = translations[language];

  // Pre-load questions on welcome
  useEffect(() => {
    if (questions.length === 0 && step === AppStep.WELCOME) {
      generateQuizQuestions(language).then(({ questions: qs, seed }) => {
        setQuestions(qs); setQuestionSeed(seed);
      });
    }
  }, [questions.length, step]);

  const handleStart = () => {
    if (questions.length > 0) {
      setStep(AppStep.QUIZ);
    } else {
      setStep(AppStep.LOADING_QUIZ);
      generateQuizQuestions(language).then(({ questions: qs, seed }) => {
        setQuestions(qs); setQuestionSeed(seed); setStep(AppStep.QUIZ);
      });
    }
  };

  const handleQuizComplete = async (demo: UserDemographics, userAnswers: QuizAnswer[]) => {
    setDemographics(demo);
    setStep(AppStep.ANALYZING);
    try {
      const result = await analyzeProfile(demo, questions, userAnswers, language, questionSeed);
      setProfile(result);
      setStep(AppStep.RESULTS);
    } catch (err) {
      console.error('Analysis error', err);
      showToast('分析失败，请重试', 'error');
      setStep(AppStep.WELCOME);
    }
  };

  const handleRestart = () => {
    setProfile(null);
    setStep(AppStep.WELCOME);
    window.history.pushState({}, document.title, window.location.pathname);
    generateQuizQuestions(language).then(({ questions: qs, seed }) => {
      setQuestions(qs); setQuestionSeed(seed);
    });
  };

  const toggleLanguage = () => {
    if (step === AppStep.QUIZ || step === AppStep.ANALYZING) return;
    const newLang: Language = language === 'en' ? 'zh' : language === 'zh' ? 'ja' : 'en';
    setLanguage(newLang);
    if (questions.length > 0) setQuestions(translateQuestions(questions, newLang));
  };

  return (
    <>
      {/* ── Global flowing background ── */}
      <div className="fixed inset-0 -z-10 bg-[#07070f] overflow-hidden pointer-events-none">
        <motion.div animate={{ scale: [1,1.35,1], x:[0,40,0], y:[0,-30,0] }} transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-[40vw] -left-[20vw] w-[120vw] h-[120vw] rounded-full"
          style={{ background: 'radial-gradient(circle at center, rgba(30,27,75,0.8) 0%, rgba(30,27,75,0) 60%)' }} />
        <motion.div animate={{ scale: [1,1.2,1], x:[0,-35,0], y:[0,40,0] }} transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut', delay: 5 }}
          className="absolute -bottom-[30vw] -right-[20vw] w-[110vw] h-[110vw] rounded-full"
          style={{ background: 'radial-gradient(circle at center, rgba(88,28,135,0.6) 0%, rgba(88,28,135,0) 60%)' }} />
        <motion.div animate={{ scale:[1,1.5,1], x:[0,20,0], y:[0,50,0] }} transition={{ duration: 19, repeat: Infinity, ease: 'easeInOut', delay: 9 }}
          className="absolute top-[20%] left-[20%] w-[80vw] h-[80vw] rounded-full"
          style={{ background: 'radial-gradient(circle at center, rgba(136,19,55,0.25) 0%, rgba(136,19,55,0) 50%)' }} />
      </div>

      <div className="flex flex-col font-sans text-white min-h-screen">
        {/* ── Header ── */}
        <header className="fixed top-0 w-full p-5 z-50 flex justify-between items-center">
          <button onClick={() => { setStep(AppStep.WELCOME); window.history.pushState({}, document.title, window.location.pathname); }}
            className="font-bold text-sm tracking-widest uppercase text-white/80 hover:text-white transition-opacity">
            Soul Journey
          </button>
          <div className="flex items-center gap-3">
            <button onClick={toggleLanguage}
              disabled={step === AppStep.QUIZ || step === AppStep.ANALYZING}
              className={`text-xs font-bold uppercase text-white/50 hover:text-white transition-colors bg-white/8 px-3 py-1 rounded-full backdrop-blur border border-white/10
                ${step === AppStep.QUIZ || step === AppStep.ANALYZING ? 'opacity-30 cursor-not-allowed' : ''}`}>
              {language === 'en' ? 'EN' : language === 'zh' ? '中文' : '日本語'}
            </button>
            {step !== AppStep.WELCOME && (
              <button onClick={handleRestart} className="text-xs font-bold uppercase text-white/40 hover:text-white transition-colors">Exit</button>
            )}
          </div>
        </header>

        {/* ── Pages ── */}
        <main className="flex-grow w-full">
          {step === AppStep.WELCOME && <WelcomeScreen onStart={handleStart} onLookup={() => setStep(AppStep.LOOKUP)} text={t.welcome} />}

          {step === AppStep.LOOKUP && (
            <div className="min-h-screen flex items-center justify-center px-4 pt-20">
              <React.Suspense fallback={<div className="text-white/50">Loading...</div>}>
                <LookupScreen onBack={() => setStep(AppStep.WELCOME)}
                  onProfileFound={p => { setProfile(p); setStep(AppStep.RESULTS); }} text={t.lookup} />
              </React.Suspense>
            </div>
          )}

          {step === AppStep.LOADING_QUIZ && (
            <div className="min-h-screen flex flex-col items-center justify-center text-center text-white gap-6">
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-500 blur-3xl opacity-20 animate-pulse" />
                <Loader2 className="w-10 h-10 text-white/70 animate-spin relative z-10" />
              </div>
              <h2 className="text-2xl font-light tracking-tight animate-pulse">{t.loading.calibrating}</h2>
              <p className="text-white/40 font-mono text-xs uppercase tracking-widest">{t.loading.generating}</p>
            </div>
          )}

          {step === AppStep.ANALYZING && <AnalyzingScreen language={language} />}

          {step === AppStep.QUIZ && questions.length > 0 && (
            <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center text-white/50">Loading quiz...</div>}>
              <QuizScreen questions={questions} language={language} onComplete={handleQuizComplete} text={t.quiz} />
            </React.Suspense>
          )}

          {step === AppStep.RESULTS && profile && (
            <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center text-white/50">Loading results...</div>}>
              <ResultsScreen profile={profile} onRestart={handleRestart} text={t.results} />
            </React.Suspense>
          )}
        </main>
      </div>

      {/* ── Global Toast container ── */}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </>
  );
}
