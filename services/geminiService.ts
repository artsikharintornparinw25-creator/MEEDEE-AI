
import { GoogleGenAI, Modality, GenerateContentResponse, Chat, Type } from "@google/genai";
import { Message } from "../types";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export async function analyzeAndWriteStory(
  imageBase64: string, 
  style: string = 'Cinematic', 
  pacing: string = 'Normal',
  genre: string = 'Sci-Fi'
): Promise<string> {
  const ai = getAI();
  const imagePart = {
    inlineData: {
      mimeType: 'image/jpeg',
      data: imageBase64.split(',')[1],
    },
  };

  let pacingInstruction = "";
  if (pacing === 'Slow') {
    pacingInstruction = "Use a slow, deliberate narrative pace. Focus extensively on intricate sensory details, long flowing sentences, and deep atmosphere to let the scene breathe.";
  } else if (pacing === 'Fast') {
    pacingInstruction = "Use a fast, punchy narrative pace. Focus on immediate action, short sentences, and direct sensory impressions to throw the reader straight into a moment of change or movement.";
  } else {
    pacingInstruction = "Use a balanced, standard narrative pace, mixing description with narrative momentum.";
  }

  const textPart = {
    text: `Analyze the mood, atmosphere, and setting of this image. Based on this, write a single, captivating opening paragraph (approx 100-150 words) for a story set in this world. 
    
    CRITICAL GENRE REQUIREMENT: The story MUST be in the "${genre}" genre. Ensure the plot elements, tropes, and vocabulary strictly align with standard ${genre} storytelling conventions.

    CRITICAL STYLE REQUIREMENT: The user has requested the narrative style: "${style}". 
    Ensure the vocabulary, sentence structure, and imagery strictly adhere to the "${style}" aesthetic. 
    
    CRITICAL PACING REQUIREMENT: ${pacingInstruction}
    
    Focus on sensory details and establishing a compelling tone. Output ONLY the story paragraph.`,
  };

  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: { parts: [imagePart, textPart] },
  });

  return response.text || "The image remained silent, but the story was waiting to be told.";
}

export async function generatePlotSuggestions(story: string): Promise<string[]> {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Based on this story opening: "${story}", suggest 3 unique, atmospheric plot points or twists that could advance the narrative. Each suggestion should be a short, intriguing phrase (max 15 words).`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.STRING,
          description: "A creative plot twist or story direction."
        }
      }
    }
  });

  try {
    return JSON.parse(response.text || "[]");
  } catch (e) {
    console.error("Failed to parse plot suggestions", e);
    return [];
  }
}

export async function summarizeConversation(messages: Message[]): Promise<string> {
  if (messages.length === 0) return "";
  const ai = getAI();
  const historyString = messages.map(m => `${m.role}: ${m.text}`).join('\n');
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Summarize the following creative discussion history between a writer and their AI assistant MEEDEE. 
    Focus on key narrative decisions, character ideas, and world-building progress. 
    Keep it concise (max 60 words). 
    
    Discussion History:
    ${historyString}`,
  });
  return response.text || "No summary available.";
}

export async function generateSpeech(text: string, ambience: string = 'Automatic'): Promise<Uint8Array> {
  const ai = getAI();
  
  let ambienceDetail = "";
  switch(ambience) {
    case 'Rainy Night':
      ambienceDetail = "Include heavy, soothing rain sounds, occasional distant thunder, and the subtle splash of puddles.";
      break;
    case 'Enchanted Forest':
      ambienceDetail = "Include mystical birdsong, rustling leaves, a gentle breeze, and a faint magical shimmering chime.";
      break;
    case 'Distopian City':
      ambienceDetail = "Include a low technological hum, distant neon buzzing, occasional sirens, and the muffled sound of a futuristic metropolis.";
      break;
    case 'Ancient Hall':
      ambienceDetail = "Include deep cavernous echoes, the sound of wind whistling through stone, and occasional drips of water.";
      break;
    case 'Ethereal Void':
      ambienceDetail = "Include deep, cosmic drones, rhythmic pulsing, and high-pitched crystalline textures.";
      break;
    case 'Ocean Shore':
      ambienceDetail = "Include rhythmic, crashing waves, distant seagulls, and the low foghorn of a ship.";
      break;
    case 'Busy Tavern':
      ambienceDetail = "Include muffled crowd chatter, clinking mugs, a crackling fireplace, and soft string music.";
      break;
    case 'Mechanical Works':
      ambienceDetail = "Include rhythmic metallic hammering, gears grinding, escaping steam hisses, and heavy machinery thuds.";
      break;
    case 'Snowy Peak':
      ambienceDetail = "Include howling winds, the crunch of snow underfoot, and the sharp crack of freezing ice.";
      break;
    case 'Summer Meadow':
      ambienceDetail = "Include buzzing bees, chirping crickets, gentle grass rustling, and distant warm winds.";
      break;
    case 'Zen Garden':
      ambienceDetail = "Include soft trickling water, a rhythmic bamboo 'shishi-odoshi' click, and delicate wind chimes.";
      break;
    default:
      ambienceDetail = "Include subtle, high-quality atmospheric background sound effects and foley that naturally match the scene described in the story.";
  }

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-native-audio-preview-12-2025",
    contents: [{ 
      parts: [{ 
        text: `Narrate the following story opening with an expressive, cinematic voice. 
               
               ATMOSPHERE INSTRUCTION: ${ambienceDetail}
               
               The sound effects should be immersive, cinematic, and perfectly timed with the narration but not overpower the voice. 
               
               Story: ${text}` 
      }] 
    }],
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
  
  return decodeBase64ToUint8Array(base64Audio);
}

function decodeBase64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
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

export function createStoryChat(systemPrompt: string): Chat {
  const ai = getAI();
  return ai.chats.create({
    model: 'gemini-3-pro-preview',
    config: {
      systemInstruction: systemPrompt,
    },
  });
}
