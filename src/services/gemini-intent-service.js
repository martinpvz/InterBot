import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import {
  CONSULTATION_INTENTS,
  consultationActions,
} from '../flows/consultation-menu-definitions.js';

const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const validIntentIds = new Set(Object.values(CONSULTATION_INTENTS));

async function classifyIntentWithGemini({ text, branchLabel }) {
  if (!env.aiIntentRoutingEnabled || !env.geminiApiKey) {
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

  const parsed = parseGeminiJson(rawText);

  if (!parsed || !validIntentIds.has(parsed.intent)) {
    logger.warn('Gemini regreso una clasificacion invalida', {
      rawText,
      finishReason: data.candidates?.[0]?.finishReason,
    });
    return null;
  }

  return {
    intent: parsed.intent,
    confidence: normalizeConfidence(parsed.confidence),
    source: 'gemini',
  };
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
          'No escribas frases como "Here is" o "La respuesta es".',
          'Tu salida debe ser exclusivamente un objeto JSON valido.',
        ].join(' '),
      }],
    },
    contents: [{
      role: 'user',
      parts: [{
        text: [
          'Clasifica la consulta de un asegurado de InterProteccion.',
          'Debes elegir exactamente una intencion de la lista.',
          'Responde solamente un objeto JSON valido, sin texto antes ni despues.',
          '',
          `Ramo seleccionado: ${branchLabel || 'Sin ramo'}`,
          `Consulta del usuario: ${text}`,
          '',
          'Intenciones permitidas:',
          intentDescriptions,
          '',
          'Formato obligatorio:',
          '{"intent":"policy_info","confidence":0.95}',
          '',
          'Ejemplo si el usuario dice "me acabo de lastimar":',
          '{"intent":"medical_urgency","confidence":0.95}',
          '',
          'Si el usuario no es claro, usa la intencion mas probable con confianza baja.',
        ].join('\n'),
      }],
    }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 80,
      responseMimeType: 'application/json',
    },
  };
}

function parseGeminiJson(rawText) {
  if (!rawText) {
    return null;
  }

  const cleanText = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  const jsonCandidate = extractJsonObject(cleanText) ?? cleanText;

  try {
    return JSON.parse(jsonCandidate);
  } catch (error) {
    logger.warn('No se pudo parsear JSON de Gemini', { error: error.message });
    return null;
  }
}

function extractJsonObject(value) {
  const start = value.indexOf('{');
  const end = value.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  return value.slice(start, end + 1);
}

function normalizeConfidence(value) {
  const confidence = Number(value);

  if (!Number.isFinite(confidence)) {
    return 0;
  }

  return Math.max(0, Math.min(1, confidence));
}

export { classifyIntentWithGemini };
