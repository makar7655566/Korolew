import { motion } from 'motion/react';
import { Button } from '../../components/ui/button';
import { 
  Sparkles, 
  Camera, 
  Search, 
  ImageIcon, 
  Volume2, 
  Zap,
  CheckCircle2
} from 'lucide-react';

interface OnboardingProps {
  onComplete: () => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const features = [
    {
      icon: <Camera className="w-6 h-6 text-blue-400" />,
      title: "Анализ фото",
      description: "Загружайте изображения, и я подробно опишу их или отвечу на ваши вопросы."
    },
    {
      icon: <Search className="w-6 h-6 text-green-400" />,
      title: "Поиск в интернете",
      description: "Я могу искать актуальную информацию в Google, чтобы давать самые свежие ответы."
    },
    {
      icon: <ImageIcon className="w-6 h-6 text-purple-400" />,
      title: "Генерация картинок",
      description: "Просто опишите словами, что вы хотите увидеть, и я создам это для вас."
    },
    {
      icon: <Volume2 className="w-6 h-6 text-orange-400" />,
      title: "Голосовые ответы",
      description: "Я могу озвучивать свои сообщения на русском языке с разной скоростью."
    },
    {
      icon: <Zap className="w-6 h-6 text-yellow-400" />,
      title: "Два режима работы",
      description: "Выбирайте между 'Легким' и 'Трудным' режимом в зависимости от ваших задач."
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f1117] p-4 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl bg-[#161922] border border-slate-800 rounded-3xl p-8 md:p-12 shadow-2xl"
      >
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500/10 mb-6">
            <Sparkles className="w-10 h-10 text-blue-400" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">Добро пожаловать!</h1>
          <p className="text-slate-400 text-lg">Я ваш персональный ИИ-ассистент. Вот что я умею:</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          {features.map((feature, index) => (
            <motion.div 
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex gap-4 p-4 rounded-2xl bg-slate-900/50 border border-slate-800"
            >
              <div className="shrink-0">{feature.icon}</div>
              <div>
                <h3 className="font-bold text-white mb-1">{feature.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="flex justify-center">
          <Button 
            onClick={onComplete}
            className="px-12 py-6 text-lg bg-blue-600 hover:bg-blue-700 rounded-2xl gap-2 shadow-xl shadow-blue-600/20"
          >
            <CheckCircle2 className="w-5 h-5" />
            Понятно, поехали!
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
