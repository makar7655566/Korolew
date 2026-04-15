import { useState, useEffect } from 'react';
import { Button } from '../../components/ui/button';
import { 
  Play, 
  Pause, 
  Square, 
  FastForward, 
  Volume2, 
  X,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface VoicePlayerProps {
  text: string;
  onClose: () => void;
}

export function VoicePlayer({ text, onClose }: VoicePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [rate, setRate] = useState(1);
  const [utterance, setUtterance] = useState<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (!window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    const newUtterance = new SpeechSynthesisUtterance(text);
    newUtterance.lang = 'ru-RU';
    newUtterance.rate = rate;

    const voices = window.speechSynthesis.getVoices();
    const russianVoice = voices.find(v => v.lang.startsWith('ru')) || voices[0];
    if (russianVoice) {
      newUtterance.voice = russianVoice;
    }

    newUtterance.onend = () => {
      setIsPlaying(false);
      onClose();
    };

    setUtterance(newUtterance);
    window.speechSynthesis.speak(newUtterance);

    return () => {
      window.speechSynthesis.cancel();
    };
  }, [text]);

  const togglePlay = () => {
    if (isPlaying) {
      window.speechSynthesis.pause();
    } else {
      window.speechSynthesis.resume();
    }
    setIsPlaying(!isPlaying);
  };

  const stop = () => {
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    onClose();
  };

  const handleRateChange = (newRate: number) => {
    setRate(newRate);
    if (utterance) {
      window.speechSynthesis.cancel();
      const nextUtterance = new SpeechSynthesisUtterance(text);
      nextUtterance.lang = 'ru-RU';
      nextUtterance.rate = newRate;
      const voices = window.speechSynthesis.getVoices();
      const russianVoice = voices.find(v => v.lang.startsWith('ru')) || voices[0];
      if (russianVoice) nextUtterance.voice = russianVoice;
      nextUtterance.onend = () => {
        setIsPlaying(false);
        onClose();
      };
      setUtterance(nextUtterance);
      window.speechSynthesis.speak(nextUtterance);
      setIsPlaying(true);
    }
  };

  return (
    <motion.div 
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4"
    >
      <div className="bg-[#161922] border border-slate-800 rounded-2xl p-4 shadow-2xl flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Volume2 className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Озвучка сообщения</h4>
              <p className="text-[10px] text-slate-500">Синтез речи на русском</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-slate-500">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={togglePlay}
              className="h-12 w-12 rounded-full border-slate-700 bg-slate-900"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-1" />}
            </Button>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={stop}
              className="h-12 w-12 rounded-full border-slate-700 bg-slate-900"
            >
              <Square className="w-5 h-5" />
            </Button>
          </div>

          <div className="flex-1 space-y-2">
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>Скорость</span>
              <span>{rate}x</span>
            </div>
            <div className="flex gap-2">
              {[0.5, 1, 1.5, 2].map((r) => (
                <Button
                  key={r}
                  variant={rate === r ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleRateChange(r)}
                  className="flex-1 h-8 text-[10px] border-slate-700"
                >
                  {r}x
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
