import { GoogleGenAI, Modality, Type } from "@google/genai";
import { Message, MessagePart, Settings } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function chatWithGemini(
  messages: Message[],
  settings: Settings,
  onChunk?: (chunk: string) => void
) {
  const model = settings.model;
  
  // Custom system instruction based on settings
  const baseInstruction = settings.systemPrompt;
  const difficultyInstruction = settings.difficulty === 'hard' 
    ? 'Используй сложный язык, глубокие технические подробности и научный подход. Твои ответы должны быть максимально подробными и экспертными.'
    : 'Используй простой и понятный язык, избегай сложных терминов. Твои ответы должны быть лаконичными и доступными даже ребенку.';
  
  const addressInstruction = settings.displayName 
    ? `Обращайся к пользователю по имени: ${settings.displayName}.`
    : '';

  const botNameInstruction = settings.botName
    ? `Твое имя: ${settings.botName}. Представляйся так, если спросят.`
    : '';

  const fullSystemInstruction = `${baseInstruction}\n${difficultyInstruction}\n${addressInstruction}\n${botNameInstruction}\nПри анализе фото будь максимально внимателен к деталям. Если тебя просят создать фото, используй инструмент генерации изображений.`;

  // Convert messages to Gemini format
  const contents = messages.map(msg => {
    if (typeof msg.content === 'string') {
      return {
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      };
    } else {
      return {
        role: msg.role === 'user' ? 'user' : 'model',
        parts: msg.content.map(part => {
          if (part.text) return { text: part.text };
          if (part.inlineData) return { inlineData: part.inlineData };
          return { text: "" };
        })
      };
    }
  });

  const tools: any[] = [];
  if (settings.useSearch) {
    tools.push({ googleSearch: {} });
  }

  try {
    const response = await ai.models.generateContentStream({
      model: model,
      contents: contents as any,
      config: {
        systemInstruction: fullSystemInstruction,
        tools: tools.length > 0 ? tools : undefined,
      }
    });

    let fullText = "";
    for await (const chunk of response) {
      const text = chunk.text || "";
      fullText += text;
      if (onChunk) onChunk(text);
    }

    return fullText;
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    throw error;
  }
}

export async function generateImage(prompt: string) {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: prompt }]
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image generated");
  } catch (error) {
    console.error("Image Generation Error:", error);
    throw error;
  }
}

export function speakText(text: string, voiceName: string = 'ru-RU') {
  if (!window.speechSynthesis) return;

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = voiceName;
  
  // Try to find a Russian voice
  const voices = window.speechSynthesis.getVoices();
  const russianVoice = voices.find(v => v.lang.startsWith('ru')) || voices[0];
  if (russianVoice) {
    utterance.voice = russianVoice;
  }

  window.speechSynthesis.speak(utterance);
}
