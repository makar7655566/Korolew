import { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { 
  Plus, 
  Settings as SettingsIcon, 
  Image as ImageIcon, 
  Search, 
  Volume2, 
  Download, 
  Send, 
  Trash2, 
  MessageSquare,
  PanelLeft,
  X,
  Loader2,
  Camera,
  Sparkles,
  LogOut,
  Copy,
  Check,
  User as UserIcon,
  Bot,
  Palette,
  Zap,
  Search as SearchIcon,
  Info,
  ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '@/components/ui/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { 
  Session, 
  Message, 
  Settings, 
  DEFAULT_SETTINGS, 
  MessagePart,
  UserProfile
} from './types';
import { chatWithGemini, generateImage, speakText } from './lib/gemini';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { Auth } from './components/Auth';
import { Onboarding } from './components/Onboarding';
import { VoicePlayer } from './components/VoicePlayer';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [input, setInput] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ mimeType: string; data: string } | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeVoiceText, setActiveVoiceText] = useState<string | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auth State Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setIsAuthLoading(true);
      setUser(u);
      if (u) {
        try {
          const profileDoc = await getDoc(doc(db, 'users', u.uid));
          if (profileDoc.exists()) {
            const profileData = profileDoc.data() as UserProfile;
            setProfile(profileData);
            setSettings(prev => ({ ...prev, ...profileData }));
          } else {
            // Profile might be being created right now during registration
            // We'll wait a bit or let the registration component handle it
            setProfile(null);
          }
        } catch (error) {
          console.error("Error fetching profile:", error);
        }
      } else {
        setProfile(null);
        setSessions([]);
        setCurrentSessionId(null);
      }
      setIsAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  // Sessions Listener
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'sessions'), 
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sessionsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session));
      setSessions(sessionsData);
      
      if (sessionsData.length > 0 && !currentSessionId) {
        setCurrentSessionId(sessionsData[0].id);
      } else if (sessionsData.length === 0) {
        createNewSession();
      }
    });

    return unsubscribe;
  }, [user]);

  // Messages Listener
  const [messages, setMessages] = useState<Message[]>([]);
  useEffect(() => {
    if (!currentSessionId) {
      setMessages([]);
      return;
    }

    const q = query(
      collection(db, `sessions/${currentSessionId}/messages`),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messagesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(messagesData);
    });

    return unsubscribe;
  }, [currentSessionId]);

  // Scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 100;
    setShowScrollButton(!isAtBottom);
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  const createNewSession = async () => {
    if (!user) return;
    const id = uuidv4();
    const newSession = {
      id,
      userId: user.uid,
      title: 'Новый чат',
      createdAt: Date.now(),
    };
    await setDoc(doc(db, 'sessions', id), newSession);
    setCurrentSessionId(id);
  };

  const deleteSession = async (id: string) => {
    if (sessions.length <= 1) return; // Cannot delete last session
    await deleteDoc(doc(db, 'sessions', id));
    if (currentSessionId === id) {
      const remaining = sessions.filter(s => s.id !== id);
      setCurrentSessionId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!input.trim() && !selectedImage) || isLoading || !currentSessionId) return;

    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content: selectedImage 
        ? [
            { text: input || 'Проанализируй это изображение' },
            { inlineData: selectedImage }
          ]
        : input,
      timestamp: Date.now(),
      sessionId: currentSessionId
    };

    // Update session title if first message
    if (messages.length === 0) {
      await updateDoc(doc(db, 'sessions', currentSessionId), {
        title: input.slice(0, 30) || 'Анализ фото'
      });
    }

    await setDoc(doc(db, `sessions/${currentSessionId}/messages`, userMessage.id), userMessage);
    
    setInput('');
    setSelectedImage(null);
    setIsLoading(true);

    try {
      const responseText = await chatWithGemini(
        [...messages, userMessage],
        settings,
      );

      const assistantMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: responseText,
        timestamp: Date.now(),
        sessionId: currentSessionId
      };

      await setDoc(doc(db, `sessions/${currentSessionId}/messages`, assistantMessage.id), assistantMessage);

      if (settings.ttsEnabled) {
        setActiveVoiceText(responseText);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!input.trim() || isLoading || !currentSessionId) return;

    setIsGeneratingImage(true);
    setIsLoading(true);

    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content: `Сгенерируй изображение: ${input}`,
      timestamp: Date.now(),
      sessionId: currentSessionId
    };

    await setDoc(doc(db, `sessions/${currentSessionId}/messages`, userMessage.id), userMessage);

    try {
      const imageUrl = await generateImage(input);
      const assistantMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: `Вот сгенерированное изображение по вашему запросу: "${input}"`,
        timestamp: Date.now(),
        isImage: true,
        imageUrl: imageUrl,
        sessionId: currentSessionId
      };

      await setDoc(doc(db, `sessions/${currentSessionId}/messages`, assistantMessage.id), assistantMessage);
      setInput('');
    } catch (error) {
      console.error(error);
    } finally {
      setIsGeneratingImage(false);
      setIsLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        setSelectedImage({
          mimeType: file.type,
          data: base64,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleOnboardingComplete = async () => {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid), { hasSeenOnboarding: true });
    setProfile(prev => prev ? { ...prev, hasSeenOnboarding: true } : null);
  };

  const handleUpdateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid), updates);
    setProfile(prev => prev ? { ...prev, ...updates } : null);
    setSettings(prev => ({ ...prev, ...updates }));
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    
    const confirmDelete = confirm('ВНИМАНИЕ: Это действие безвозвратно удалит ваш аккаунт и все ваши сообщения. Вы уверены?');
    if (!confirmDelete) return;

    setIsLoading(true);
    try {
      // 1. Delete user profile
      await deleteDoc(doc(db, 'users', user.uid));
      
      // 2. Delete auth user
      await user.delete();
      
      // 3. Sign out (just in case)
      await signOut(auth);
      
      alert('Аккаунт успешно удален.');
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/requires-recent-login') {
        alert('Для удаления аккаунта требуется недавний вход в систему. Пожалуйста, выйдите и войдите снова, затем повторите попытку.');
      } else {
        alert('Произошла ошибка при удалении аккаунта: ' + error.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const filteredSessions = sessions.filter(s => 
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isAuthLoading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[#0f1117] text-white">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500 mb-4" />
        <p className="text-slate-400 animate-pulse">Загрузка...</p>
      </div>
    );
  }

  if (!user) return <Auth />;
  
  // If we have a user but no profile yet, show loading unless we are in the middle of registration
  if (!profile) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[#0f1117] text-white p-4 text-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-500 mb-4" />
        <p className="text-slate-400 animate-pulse mb-8">Инициализация профиля...</p>
        <Button variant="outline" onClick={() => signOut(auth)} className="border-slate-700 text-slate-400">
          Выйти из системы
        </Button>
      </div>
    );
  }

  if (!profile.hasSeenOnboarding) return <Onboarding onComplete={handleOnboardingComplete} />;

  return (
    <TooltipProvider>
      <div 
        className="flex h-screen text-slate-200 font-sans overflow-hidden transition-all duration-500"
        style={{ backgroundColor: settings.background || '#0f1117' }}
      >
        {/* Sidebar */}
        <AnimatePresence mode="wait">
          {isSidebarOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 300, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="flex flex-col border-r border-slate-800 bg-black/20 backdrop-blur-xl z-20"
            >
              <div className="p-4 flex items-center justify-between">
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-blue-400" />
                  AI Bot
                </h1>
                <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(false)}>
                  <PanelLeft className="w-5 h-5" />
                </Button>
              </div>

              <div className="px-4 mb-4 space-y-3">
                <Button 
                  onClick={createNewSession}
                  className="w-full justify-start gap-2 bg-blue-600 hover:bg-blue-700 text-white border-none shadow-lg shadow-blue-600/20"
                >
                  <Plus className="w-4 h-4" />
                  Новый чат
                </Button>
                
                <div className="relative">
                  <SearchIcon className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <Input 
                    placeholder="Поиск чатов..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 bg-slate-900/50 border-slate-800 h-9 text-xs"
                  />
                </div>
              </div>

              <ScrollArea className="flex-1 px-2">
                <div className="space-y-1">
                  {filteredSessions.map(session => (
                    <div
                      key={session.id}
                      onClick={() => setCurrentSessionId(session.id)}
                      className={cn(
                        "group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all",
                        currentSessionId === session.id 
                          ? "bg-slate-800 text-white" 
                          : "hover:bg-slate-800/50 text-slate-400"
                      )}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <MessageSquare className="w-4 h-4 shrink-0" />
                        <span className="truncate text-sm font-medium">{session.title}</span>
                      </div>
                      {sessions.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 h-8 w-8 text-slate-500 hover:text-red-400"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSession(session.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="p-4 border-t border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Avatar className="w-8 h-8 border border-slate-700">
                    <AvatarFallback className="bg-blue-600 text-[10px]">{user.email?.[0].toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold truncate text-white">{profile?.displayName || user.email}</span>
                    <span className="text-[10px] text-slate-500 truncate">{user.email}</span>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => signOut(auth)} className="text-slate-500 hover:text-red-400">
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main Chat Area */}
        <main className="flex-1 flex flex-col relative min-w-0">
          {/* Top Bar */}
          <header className="h-16 border-b border-slate-800 bg-black/20 backdrop-blur-xl flex items-center justify-between px-4 md:px-6 z-10">
            <div className="flex items-center gap-4">
              {!isSidebarOpen && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setIsSidebarOpen(true)}
                >
                  <PanelLeft className="w-5 h-5" />
                </Button>
              )}
              <div className="flex flex-col">
                <h2 className="text-sm font-bold text-white truncate max-w-[200px]">
                  {sessions.find(s => s.id === currentSessionId)?.title || 'Чат'}
                </h2>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "w-2 h-2 rounded-full animate-pulse",
                    isLoading ? "bg-yellow-500" : "bg-green-500"
                  )} />
                  <span className="text-[10px] text-slate-500">{isLoading ? 'Обработка...' : 'Онлайн'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Dialog>
                <DialogTrigger render={
                  <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-slate-800">
                    <SettingsIcon className="w-5 h-5" />
                  </Button>
                } />
                <DialogContent className="bg-[#161922] border-slate-800 text-slate-200 sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                      <SettingsIcon className="w-5 h-5 text-blue-400" />
                      Настройки профиля
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-6 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <UserIcon className="w-3 h-3" /> Ваше имя
                        </Label>
                        <Input 
                          value={profile?.displayName || ''}
                          onChange={(e) => handleUpdateProfile({ displayName: e.target.value })}
                          className="bg-slate-900 border-slate-700"
                          placeholder="Как вас называть?"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Bot className="w-3 h-3" /> Имя бота
                        </Label>
                        <Input 
                          value={profile?.botName || ''}
                          onChange={(e) => handleUpdateProfile({ botName: e.target.value })}
                          className="bg-slate-900 border-slate-700"
                          placeholder="Имя ассистента"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Palette className="w-3 h-3" /> Фон приложения
                      </Label>
                      <div className="grid grid-cols-5 gap-2">
                        {['#0f1117', '#1a1c2c', '#161b22', '#2d1b2d', '#1b2d2d'].map(color => (
                          <button
                            key={color}
                            onClick={() => handleUpdateProfile({ background: color })}
                            className={cn(
                              "h-8 rounded-lg border-2 transition-all",
                              profile?.background === color ? "border-blue-500 scale-110" : "border-transparent"
                            )}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Zap className="w-3 h-3" /> Режим работы
                      </Label>
                      <Select 
                        value={profile?.difficulty || 'easy'} 
                        onValueChange={(v: any) => handleUpdateProfile({ difficulty: v })}
                      >
                        <SelectTrigger className="bg-slate-900 border-slate-700">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-700 text-slate-200">
                          <SelectItem value="easy">Легкий (Простые ответы)</SelectItem>
                          <SelectItem value="hard">Трудный (Экспертные ответы)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="pt-4 border-t border-slate-800 flex flex-col gap-3">
                      <div className="flex justify-between items-center">
                        <Button variant="ghost" size="sm" onClick={() => signOut(auth)} className="gap-2 text-slate-400 hover:text-white">
                          <LogOut className="w-4 h-4" /> Выйти
                        </Button>
                        <p className="text-[10px] text-slate-500">Версия 2.1.0</p>
                      </div>
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        onClick={handleDeleteAccount}
                        className="w-full gap-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20"
                      >
                        <Trash2 className="w-4 h-4" /> Удалить аккаунт навсегда
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </header>

          {/* Messages */}
          <ScrollArea ref={scrollRef} onScroll={handleScroll} className="flex-1 p-4 md:p-8">
            <div className="max-w-3xl mx-auto space-y-8 pb-24">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex gap-4 group",
                    message.role === 'user' ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  <Avatar className={cn(
                    "w-10 h-10 border",
                    message.role === 'user' ? "border-blue-500/50" : "border-slate-700"
                  )}>
                    <AvatarFallback className={message.role === 'user' ? "bg-blue-600" : "bg-slate-800"}>
                      {message.role === 'user' ? 'U' : 'AI'}
                    </AvatarFallback>
                    {message.role === 'assistant' && <AvatarImage src={`https://api.dicebear.com/7.x/bottts/svg?seed=${profile?.botName || 'Felix'}`} />}
                  </Avatar>
                  
                  <div className={cn(
                    "flex flex-col max-w-[85%] space-y-2",
                    message.role === 'user' ? "items-end" : "items-start"
                  )}>
                    <div className={cn(
                      "p-4 rounded-2xl shadow-sm relative",
                      message.role === 'user' 
                        ? "bg-blue-600 text-white rounded-tr-none" 
                        : "bg-slate-800/80 text-slate-200 border border-slate-700 rounded-tl-none"
                    )}>
                      {typeof message.content === 'string' ? (
                        <div className="prose prose-invert max-w-none text-sm leading-relaxed">
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {message.content.map((part, i) => (
                            <div key={i}>
                              {part.text && (
                                <div className="prose prose-invert max-w-none text-sm">
                                  <ReactMarkdown>{part.text}</ReactMarkdown>
                                </div>
                              )}
                              {part.inlineData && (
                                <img 
                                  src={`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`} 
                                  alt="Uploaded" 
                                  className="rounded-lg max-w-full h-auto border border-slate-700 mt-2"
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {message.isImage && message.imageUrl && (
                        <div className="mt-4 space-y-3 overflow-hidden rounded-xl border border-slate-700 bg-slate-900/50">
                          <div className="relative group/img">
                            <img 
                              src={message.imageUrl} 
                              alt="Generated" 
                              className="w-full h-auto transition-transform duration-500 group-hover/img:scale-105"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                              <Button 
                                variant="secondary" 
                                size="sm" 
                                className="gap-2 bg-white text-black hover:bg-slate-200"
                                onClick={() => {
                                  const link = document.createElement('a');
                                  link.href = message.imageUrl!;
                                  link.download = `ai-image-${Date.now()}.png`;
                                  link.click();
                                }}
                              >
                                <Download className="w-4 h-4" />
                                Скачать оригинал
                              </Button>
                            </div>
                          </div>
                          <div className="p-3 flex items-center justify-between border-t border-slate-800">
                            <span className="text-[10px] text-slate-500">Изображение создано ИИ</span>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-7 text-[10px] gap-1 hover:bg-slate-800"
                              onClick={() => {
                                const link = document.createElement('a');
                                link.href = message.imageUrl!;
                                link.download = `ai-image-${Date.now()}.png`;
                                link.click();
                              }}
                            >
                              <Download className="w-3 h-3" />
                              Скачать
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Message Actions */}
                      <div className={cn(
                        "absolute top-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1",
                        message.role === 'user' ? "right-full mr-2" : "left-full ml-2"
                      )}>
                        <Tooltip>
                          <TooltipTrigger render={
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 bg-slate-900/50 backdrop-blur border border-slate-800"
                              onClick={() => copyToClipboard(typeof message.content === 'string' ? message.content : '', message.id)}
                            >
                              {copiedId === message.id ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                            </Button>
                          } />
                          <TooltipContent>Копировать</TooltipContent>
                        </Tooltip>
                        {message.role === 'assistant' && (
                          <Tooltip>
                            <TooltipTrigger render={
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 bg-slate-900/50 backdrop-blur border border-slate-800"
                                onClick={() => setActiveVoiceText(typeof message.content === 'string' ? message.content : '')}
                              >
                                <Volume2 className="w-3 h-3" />
                              </Button>
                            } />
                            <TooltipContent>Прослушать</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                    
                    <span className="text-[10px] text-slate-500 px-1">
                      {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </motion.div>
              ))}
              
              {isLoading && !isGeneratingImage && (
                <div className="flex gap-4">
                  <Avatar className="w-10 h-10 border border-slate-700">
                    <AvatarFallback className="bg-slate-800">AI</AvatarFallback>
                    <AvatarImage src={`https://api.dicebear.com/7.x/bottts/svg?seed=${profile?.botName || 'Felix'}`} />
                  </Avatar>
                  <div className="bg-slate-800/80 p-4 rounded-2xl rounded-tl-none border border-slate-700 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                    <span className="text-sm text-slate-400">Думаю...</span>
                  </div>
                </div>
              )}

              {isGeneratingImage && (
                <div className="flex gap-4">
                  <Avatar className="w-10 h-10 border border-slate-700">
                    <AvatarFallback className="bg-slate-800">AI</AvatarFallback>
                    <AvatarImage src={`https://api.dicebear.com/7.x/bottts/svg?seed=${profile?.botName || 'Felix'}`} />
                  </Avatar>
                  <div className="bg-slate-800/80 p-4 rounded-2xl rounded-tl-none border border-slate-700 w-full max-w-sm space-y-4">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                      <span className="text-sm text-slate-400">Генерирую шедевр...</span>
                    </div>
                    <div className="aspect-square bg-slate-900 rounded-lg animate-pulse flex items-center justify-center">
                      <ImageIcon className="w-12 h-12 text-slate-800" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input Area */}
          <div className="p-4 md:p-6 bg-gradient-to-t from-black/40 to-transparent relative">
            <AnimatePresence>
              {showScrollButton && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute bottom-full mb-8 left-1/2 -translate-x-1/2 z-30"
                >
                  <Button
                    onClick={scrollToBottom}
                    className="rounded-full h-10 w-10 bg-blue-600 hover:bg-blue-500 shadow-xl shadow-blue-600/30 border-none"
                    size="icon"
                  >
                    <ChevronDown className="w-5 h-5" />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="max-w-3xl mx-auto relative">
              {selectedImage && (
                <div className="absolute bottom-full mb-4 left-0 p-2 bg-slate-800 rounded-xl border border-slate-700 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
                  <img 
                    src={`data:${selectedImage.mimeType};base64,${selectedImage.data}`} 
                    className="w-16 h-16 object-cover rounded-lg border border-slate-600"
                    alt="Preview"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-slate-200">Изображение готово</span>
                    <span className="text-[10px] text-slate-500">Нажмите отправить для анализа</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-slate-400 hover:text-red-400"
                    onClick={() => setSelectedImage(null)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}

              <form 
                onSubmit={handleSendMessage}
                className="relative flex items-end gap-2 bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-2 shadow-2xl focus-within:border-blue-500/50 transition-all"
              >
                <div className="flex items-center gap-1 px-1 mb-1">
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                  />
                  <Tooltip>
                    <TooltipTrigger render={
                      <Button 
                        type="button"
                        variant="ghost" 
                        size="icon" 
                        className="h-10 w-10 text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-xl"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Camera className="w-5 h-5" />
                      </Button>
                    } />
                    <TooltipContent>Анализировать фото</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger render={
                      <Button 
                        type="button"
                        variant="ghost" 
                        size="icon" 
                        className={cn(
                          "h-10 w-10 rounded-xl transition-colors",
                          isGeneratingImage ? "text-purple-400 bg-purple-400/10" : "text-slate-400 hover:text-purple-400 hover:bg-purple-400/10"
                        )}
                        onClick={handleGenerateImage}
                        disabled={!input.trim() || isLoading}
                      >
                        <Sparkles className="w-5 h-5" />
                      </Button>
                    } />
                    <TooltipContent>Сгенерировать картинку</TooltipContent>
                  </Tooltip>
                </div>

                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Спроси что-нибудь или попроси создать картинку..."
                  className="flex-1 bg-transparent border-none focus-visible:ring-0 resize-none min-h-[44px] max-h-[200px] py-3 text-sm text-slate-200 placeholder:text-slate-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />

                <div className="flex items-center gap-1 px-1 mb-1">
                  <Button 
                    type="submit"
                    disabled={(!input.trim() && !selectedImage) || isLoading}
                    className="h-10 w-10 bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:bg-slate-800"
                  >
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </main>

        {/* Voice Player Overlay */}
        <AnimatePresence>
          {activeVoiceText && (
            <VoicePlayer 
              text={activeVoiceText} 
              onClose={() => setActiveVoiceText(null)} 
            />
          )}
        </AnimatePresence>
      </div>
    </TooltipProvider>
  );
}
