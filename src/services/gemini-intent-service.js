import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import {
  CONSULTATION_INTENTS,
  consultationActions,
} from '../flows/consultation-menu-definitions.js';

const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const validIntentIds = new Set(Object.values(CONSULTATION_INTENTS));
let geminiRetryAfterUntil = 0;

async function classifyIntentWithGemini({ text, branchLabel }) {
  if (!env.aiIntentRoutingEnabled || !env.geminiApiKey) {
    return null;
  }

  if (Date.now() < geminiRetryAfterUntil) {
    return null;
  }

  const response = await fetch(
    `${GEMINI_API_BASE_URL}/models/${encodeURIComponent(env.geminiModel)}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': env.geminiApiKey,
      },
      body: JSON.stringify(buildGeminiRequest({ text, branchLabel })),
    },
  );

  const data = await response.json();

  if (!response.ok) {
    if (response.status === 429) {
      geminiRetryAfterUntil = Date.now() + getRetryAfterMs(data.error?.message);
    }

    logger.warn('Gemini no pudo clasificar la consulta', {
      status: response.status,
      error: data.error?.message,
    });
    return null;
  }

  const rawText = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? '')
    .join('')
    .trim();

  const intent = parseGeminiIntent(rawText);

  if (!intent) {
    logger.warn('Gemini regreso una clasificacion invalida', {
      rawText,
      finishReason: data.candidates?.[0]?.finishReason,
    });
    return null;
  }

  return {
    intent,
    confidence: 0.9,
    source: 'gemini',
  };
}

function getRetryAfterMs(errorMessage) {
  const match = String(errorMessage ?? '').match(/retry in ([0-9.]+)s/i);
  const retrySeconds = match ? Number(match[1]) : 60;

  if (!Number.isFinite(retrySeconds) || retrySeconds <= 0) {
    return 60000;
  }

  return Math.ceil(retrySeconds * 1000);
}

function buildGeminiRequest({ text, branchLabel }) {
  const intentDescriptions = Object.entries(consultationActions)
    .map(([intent, action]) => `- ${intent}: ${action.aiDescription}`)
    .join('\n');

  return {
    systemInstruction: {
      parts: [{
        text: [
          'Eres un clasificador de intenciones para un bot de seguros.',
          'No converses con el usuario.',
          'No expliques tu respuesta.',
          'No uses markdown.',
          'Tu salida debe ser exclusivamente una de las intenciones permitidas.',
        ].join(' '),
      }],
    },
    contents: [{
      role: 'user',
      parts: [{
        text: [
          'Clasifica la consulta de un asegurado de InterProteccion.',
          'Debes elegir exactamente una intencion de la lista.',
          'Responde solamente el identificador de la intencion, sin texto antes ni despues.',
          '',
          `Ramo seleccionado: ${branchLabel || 'Sin ramo'}`,
          `Consulta del usuario: ${text}`,
          '',
          'Intenciones permitidas:',
          intentDescriptions,
          '',
          'Ejemplo de formato obligatorio:',
          'medical_urgency',
          '',
          'Ejemplo si el usuario dice "me acabo de lastimar":',
          'medical_urgency',
          '',
          'Si el usuario no es claro, usa la intencion mas probable.',
        ].join('\n'),
      }],
    }],
    generationConfig: buildGenerationConfig(),
  };
}

function buildGenerationConfig() {
  const config = {
    temperature: 0,
    maxOutputTokens: 20,
    responseMimeType: 'text/x.enum',
    responseSchema: {
      type: 'STRING',
      enum: Object.values(CONSULTATION_INTENTS),
    },
  };

  if (env.geminiModel.includes('2.5')) {
    config.thinkingConfig = {
      thinkingBudget: 0,
    };
  }

  return config;
}

function parseGeminiIntent(rawText) {
  if (!rawText) {
    return null;
  }

  const cleanText = rawText
    .replace(/^```[a-z]*\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim()
    .replace(/^["']|["']$/g, '');

  if (validIntentIds.has(cleanText)) {
    return cleanText;
  }

  const embeddedIntent = Object.values(CONSULTATION_INTENTS)
    .find((intent) => cleanText.includes(intent));

  return embeddedIntent ?? null;
}

export { classifyIntentWithGemini };
