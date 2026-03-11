import React, { useState } from 'react';
import { Button } from './Button';
import { Search, ArrowLeft } from 'lucide-react';
import { translations } from '../utils/translations';
import { getProfileBySoulId } from '../services/geminiService';
import { MatchProfile } from '../types';

interface Props {
  onBack: () => void;
  onProfileFound: (profile: MatchProfile) => void;
  text: typeof translations['en']['lookup'];
}

export const LookupScreen: React.FC<Props> = ({ onBack, onProfileFound, text }) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) return;
    setLoading(true);
    setError('');
    try {
      const profile = await getProfileBySoulId(code.trim());
      if (profile) {
        onProfileFound(profile);
      } else {
        setError(text.notFound);
      }
    } catch {
      setError('System Error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto liquid-glass rounded-[32px] p-8 md:p-10">
      <button onClick={onBack} className="flex items-center gap-2 text-white/40 hover:text-white mb-8 transition-colors">
        <ArrowLeft size={16} />
        <span className="text-sm font-medium uppercase tracking-widest">{text.back}</span>
      </button>

      <h2 className="text-2xl font-semibold text-white mb-2 text-center tracking-tight">{text.title}</h2>
      <p className="text-center text-white/40 mb-8 text-sm font-mono uppercase tracking-widest">
        Enter Soul ID to reconstruct profile
      </p>

      <form onSubmit={handleLookup} className="space-y-4">
        <div className="relative">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder={text.placeholder}
            className="w-full pl-12 pr-4 py-4 rounded-2xl liquid-glass focus:border-indigo-400/60 focus:ring-0 outline-none transition-all font-mono text-lg text-white uppercase tracking-wider placeholder:normal-case placeholder:font-sans placeholder:tracking-normal placeholder:text-white/20"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={20} />
        </div>

        {error && (
          <div className="text-rose-300 text-sm text-center font-medium bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !code}
          className="w-full liquid-glass-primary py-4 rounded-full font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {loading ? 'Reconstructing...' : text.submit}
        </button>
      </form>
    </div>
  );
};