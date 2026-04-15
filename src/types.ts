export type MessageRole = 'user' | 'assistant';

export interface MessagePart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string | MessagePart[];
  timestamp: number;
  isImage?: boolean;
  imageUrl?: string;
  sessionId: string;
}

export interface Session {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  botName?: string;
  background?: string;
  difficulty: 'easy' | 'hard';
  hasSeenOnboarding: boolean;
  createdAt: number;
}

export interface Settings extends UserProfile {
  model: string;
  systemPrompt: string;
  useSearch: boolean;
  ttsEnabled: boolean;
  voiceName: string;
}

export const DEFAULT_SETTINGS: Settings = {
  uid: '',
  email: '',
  difficulty: 'easy',
  hasSeenOnboarding: false,
  createdAt: 0,
  model: 'gemini-3-flash-preview',
  systemPrompt: 'Ты — полезный ИИ-ассистент. Отвечай на русском языке. Ты можешь анализировать изображения, искать информацию в интернете и генерировать картинки.',
  useSearch: true,
  ttsEnabled: true,
  voiceName: 'ru-RU',
};
