
import { GoogleGenAI, Type, Modality, GenerateContentResponse } from "@google/genai";
import { TranslationResult } from "../types";

// Base64 decoding helper
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Audio decoding helper for Gemini raw PCM
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const SYSTEM_INSTRUCTION = `You are a professional, high-fidelity translator. 
Your task is to translate the user's input while STRICTLY PRESERVING:
1. All line breaks and paragraph spacing.
2. All formatting (bullet points, lists, indentation).
3. The tone and nuance of the original text.
Do not add any preamble, explanations, or meta-commentary. Return ONLY the translated text.`;

export const translateTextStream = async (
  text: string,
  sourceLang: string,
  targetLang: string,
  onChunk: (chunk: string) => void
) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  const prompt = `Translate this text from ${sourceLang === 'auto' ? 'automatically detected language' : sourceLang} to ${targetLang}:
  
  "${text}"`;

  const stream = await ai.models.generateContentStream({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.2, // Low temperature for more literal, consistent translation
    },
  });

  for await (const chunk of stream) {
    const textChunk = chunk.text;
    if (textChunk) {
      onChunk(textChunk);
    }
  }
};

export const translateText = async (
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<TranslationResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  const prompt = `Translate the following text into ${targetLang}. 
  Source language: ${sourceLang === 'auto' ? 'Detect automatically' : sourceLang}.
  Text to translate: "${text}"`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          translatedText: { type: Type.STRING },
          detectedLanguage: { type: Type.STRING, description: "The ISO-639-1 code of the detected language if source was 'auto'" },
        },
        required: ["translatedText"],
      },
    },
  });

  const result = JSON.parse(response.text || '{}');
  return {
    translatedText: result.translatedText,
    detectedLanguage: result.detectedLanguage,
    sourceLanguage: sourceLang,
    targetLanguage: targetLang,
  };
};

export const playSpeech = async (text: string, languageName: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Say this in ${languageName}: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio data returned");

    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const audioBuffer = await decodeAudioData(
      decode(base64Audio),
      audioCtx,
      24000,
      1
    );

    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioCtx.destination);
    source.start();
  } catch (error) {
    console.error("Speech synthesis failed:", error);
  }
};
