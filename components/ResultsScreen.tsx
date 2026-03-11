
import React, { useState } from 'react';
import { MatchProfile } from '../types';
import { Button } from './Button';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { Copy, Check, Sparkles, Heart, AlertTriangle, Fingerprint, ChevronDown, ChevronUp } from 'lucide-react';
import { translations } from '../utils/translations';
import { QRCodeSVG } from 'qrcode.react';

interface Props {
  profile: MatchProfile;
  onRestart: () => void;
  text: typeof translations['en']['results'];
}

export const ResultsScreen: React.FC<Props> = ({ profile, onRestart, text }) => {
  const [showHistory, setShowHistory] = useState(false);
  const [copied, setCopied] = useState(false);

  const getDimensionLabel = (key: string) =>
    text.dimensions?.[key as keyof typeof text.dimensions] ?? key;

  const scores = profile.scores || [];
  const chartData = scores.map(s => ({
    subject: getDimensionLabel(s.dimension),
    A: s.score,
    fullMark: 100,
  }));

  const retrievalLink = `${window.location.origin}${window.location.pathname}?code=${profile.soulId}`;

  const copySoulId = () => {
    navigator.clipboard.writeText(profile.soulId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const idealPartner = profile.idealPartner || { description: '', traits: [], dealBreakers: [] };

  return (
    <div className="min-h-screen w-full pt-20 pb-20 px-4 md:px-6 font-sans text-white">
      <div className="max-w-2xl mx-auto flex flex-col gap-4">

        {/* ── 标题 ── */}
        <div className="text-center pt-4 pb-2 relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-indigo-500/20 rounded-full blur-[60px] -z-10" />
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40 mb-3">{text.title}</p>
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight text-white">{profile.mbtiType}</h1>
        </div>

        {/* ── 灵魂档案概述 ── */}
        <div className="liquid-glass rounded-3xl p-6">
          <p className="text-base md:text-lg font-light leading-relaxed text-white/85 font-serif">
            {profile.summary}
          </p>
        </div>

        {/* ── 雷达图 ── */}
        <div className="liquid-glass rounded-3xl p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/35 mb-1">{text.chartTitle}</p>
          <div className="w-full aspect-square max-w-[320px] mx-auto">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="68%" data={chartData}>
                <PolarGrid stroke="rgba(255,255,255,0.08)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 500 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name="You" dataKey="A" stroke="#a5b4fc" strokeWidth={2} fill="#6366f1" fillOpacity={0.35} isAnimationActive />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── 理想伴侣 ── */}
        <div className="liquid-glass rounded-3xl p-6 overflow-hidden relative">
          <div className="absolute -right-12 -top-12 w-40 h-40 bg-rose-500/15 rounded-full blur-[50px]" />
          <div className="flex items-center gap-2 mb-4 relative z-10">
            <div className="p-1.5 bg-rose-500/20 rounded-full">
              <Heart className="text-rose-300 fill-current" size={14} />
            </div>
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/40">{text.idealMatchTitle}</h3>
          </div>
          <p className="text-sm md:text-base text-white/80 leading-relaxed mb-5 font-light border-l-2 border-rose-400/30 pl-4 relative z-10">
            {idealPartner.description}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 relative z-10">
            {/* 寻找特质 */}
            <div className="liquid-glass rounded-2xl p-4">
              <span className="text-[9px] font-bold text-emerald-400/70 block mb-3 uppercase tracking-widest">{text.lookFor}</span>
              <ul className="space-y-2.5">
                {(idealPartner.traits || []).map(t => (
                  <li key={t} className="text-sm text-white/85 flex items-start gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)] mt-1.5 shrink-0" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            {/* 核心雷区 */}
            <div className="liquid-glass rounded-2xl p-4">
              <span className="text-[9px] font-bold text-amber-400/70 block mb-3 uppercase tracking-widest">{text.dealBreakers}</span>
              <ul className="space-y-2.5">
                {(idealPartner.dealBreakers || []).map(t => (
                  <li key={t} className="text-sm text-white/70 flex items-start gap-2.5">
                    <AlertTriangle size={12} className="text-amber-500/70 mt-1 shrink-0" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* ── 兼容建议 ── */}
        <div className="liquid-glass rounded-3xl p-6 relative overflow-hidden" style={{background:'linear-gradient(140deg,rgba(99,102,241,0.12),rgba(139,92,246,0.06))'}}>
          <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-[60px]" />
          <div className="flex items-center gap-2 mb-4 relative z-10">
            <Sparkles className="text-amber-300" size={15} />
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/40">{text.adviceTitle}</h3>
          </div>
          <p className="text-sm md:text-base font-light leading-relaxed text-white/85 whitespace-pre-wrap relative z-10">
            {profile.compatibilityAdvice}
          </p>
        </div>

        {/* ── Soul ID 卡片 ── */}
        <div className="liquid-glass rounded-3xl p-5">
          <div className="flex flex-col sm:flex-row items-center gap-5">
            {/* QR */}
            <div className="bg-white p-2.5 rounded-2xl shrink-0">
              <QRCodeSVG value={retrievalLink} size={64} fgColor="#000" />
            </div>
            {/* ID text */}
            <div className="flex-1 text-center sm:text-left min-w-0">
              <p className="text-[9px] font-bold text-white/35 uppercase tracking-widest mb-2 flex items-center gap-1.5 justify-center sm:justify-start">
                <Fingerprint size={10} /> {text.featureCodeLabel}
              </p>
              <button onClick={copySoulId}
                className="flex items-center gap-2 group bg-white/5 px-3 py-2 rounded-xl border border-white/10 hover:bg-white/10 transition-colors mx-auto sm:mx-0 max-w-full overflow-hidden">
                <span className="text-sm font-mono text-white/85 tracking-wide truncate">{profile.soulId}</span>
                {copied ? <Check size={13} className="text-emerald-400 shrink-0" /> : <Copy size={13} className="text-white/35 group-hover:text-white shrink-0 transition-colors" />}
              </button>
            </div>
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="flex gap-3 pt-1">
          <button onClick={onRestart}
            className="liquid-glass-btn flex-1 rounded-2xl py-4 text-white/70 text-sm font-medium">
            {text.retakeBtn}
          </button>
          <button onClick={copySoulId}
            className="liquid-glass-primary flex-1 rounded-2xl py-4 text-sm font-semibold">
            {copied ? '✓ 已复制' : text.shareBtn}
          </button>
        </div>

        {/* ── 历史答题记录 ── */}
        <div className="flex justify-center">
          <button onClick={() => setShowHistory(!showHistory)}
            className="text-xs text-white/30 hover:text-white/60 transition-colors flex items-center gap-1.5 uppercase tracking-widest py-2 px-4 rounded-full hover:bg-white/5">
            {showHistory ? text.hideHistory : text.viewHistory}
            {showHistory ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>

        {showHistory && profile.history && (
          <div className="liquid-glass rounded-3xl p-5">
            <div className="space-y-4">
              {(profile.history.questions || []).map((q, idx) => {
                const answerVal = profile.history!.answers.find(a => a.questionId === q.id)?.value;
                return (
                  <div key={q.id} className="border-b border-white/8 pb-4 last:border-0">
                    <div className="flex gap-3">
                      <span className="text-[10px] font-mono text-white/25 pt-0.5 shrink-0">{String(idx + 1).padStart(2, '0')}</span>
                      <div className="flex-1">
                        <p className="text-sm text-white/75 mb-2 leading-relaxed">{q.text}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-bold uppercase text-white/25 tracking-wider bg-white/5 px-2 py-0.5 rounded">
                            {getDimensionLabel(q.dimension)}
                          </span>
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map(v => (
                              <div key={v} className={`w-2 h-2 rounded-full ${v <= (answerVal || 0) ? 'bg-indigo-400 shadow-[0_0_6px_rgba(129,140,248,0.5)]' : 'bg-white/10'}`} />
                            ))}
                          </div>
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
    </div>
  );
};
