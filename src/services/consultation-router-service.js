import { logger } from '../lib/logger.js';
import {
  CONSULTATION_INTENTS,
  normalizeMenuInput,
  resolveConsultationMenuInput,
} from '../flows/consultation-menu-definitions.js';
import { classifyIntentWithGemini } from './gemini-intent-service.js';

const HIGH_CONFIDENCE = 0.85;
const MEDIUM_CONFIDENCE = 0.7;

async function routeConsultationIntent({ text, branchLabel }) {
  const directIntent = resolveConsultationMenuInput(text);

  if (directIntent) {
    return {
      intent: directIntent,
      confidence: 1,
      source: 'direct',
    };
  }

  const geminiResult = await safelyClassifyWithGemini({ text, branchLabel });

  if (geminiResult?.intent && geminiResult.confidence >= MEDIUM_CONFIDENCE) {
    return geminiResult;
  }

  const localResult = classifyIntentLocally(text);

  if (localResult.intent) {
    return localResult;
  }

  return {
    intent: null,
    confidence: geminiResult?.confidence ?? 0,
    source: geminiResult?.source ?? 'unknown',
  };
}

async function safelyClassifyWithGemini({ text, branchLabel }) {
  try {
    return await classifyIntentWithGemini({ text, branchLabel });
  } catch (error) {
    logger.warn('No se pudo consultar Gemini; se usara clasificacion local', {
      error: error.message,
    });
    return null;
  }
}

function classifyIntentLocally(text) {
  const normalizedText = normalizeMenuInput(text);

  if (hasAny(normalizedText, ['asesor', 'humano', 'persona', 'ejecutivo', 'agente'])) {
    return buildLocalResult(CONSULTATION_INTENTS.ADVISOR, HIGH_CONFIDENCE);
  }

  if (hasAny(normalizedText, ['menu anterior', 'regresar', 'volver', 'cambiar ramo'])) {
    return buildLocalResult(CONSULTATION_INTENTS.PREVIOUS_MENU, HIGH_CONFIDENCE);
  }

  if (hasAny(normalizedText, ['entrada', 'salida', 'ingreso', 'admision', 'alta', 'hospitalizacion', 'hospitalizar', 'carta pase'])) {
    return buildLocalResult(CONSULTATION_INTENTS.HOSPITAL_ENTRY_EXIT, HIGH_CONFIDENCE);
  }

  if (hasAny(normalizedText, [
    'urgencia',
    'emergencia',
    '911',
    'ambulancia',
    'accidente',
    'dolor fuerte',
    'atencion inmediata',
    'lastimar',
    'lastime',
    'lesion',
    'lesionado',
    'herida',
    'herido',
    'golpe',
    'caida',
    'fractura',
    'sangrado',
  ])) {
    return buildLocalResult(CONSULTATION_INTENTS.MEDICAL_URGENCY, HIGH_CONFIDENCE);
  }

  if (hasAny(normalizedText, ['estatus', 'estado', 'seguimiento', 'avance', 'como va', 'reclamacion', 'caso'])) {
    return buildLocalResult(CONSULTATION_INTENTS.CLAIM_STATUS, HIGH_CONFIDENCE);
  }

  if (hasAny(normalizedText, ['documento', 'documentacion', 'requisito', 'papeles', 'formato', 'que necesito'])) {
    return buildLocalResult(CONSULTATION_INTENTS.CLAIM_DOCUMENTS, HIGH_CONFIDENCE);
  }

  if (hasAny(normalizedText, ['iniciar', 'abrir', 'levantar', 'comenzar', 'tramite', 'siniestro', 'reembolso'])) {
    return buildLocalResult(CONSULTATION_INTENTS.START_CLAIM, HIGH_CONFIDENCE);
  }

  if (hasAny(normalizedText, ['poliza', 'cobertura', 'cubre', 'plan', 'perfil', 'deducible', 'suma asegurada', 'circulo medico'])) {
    return buildLocalResult(CONSULTATION_INTENTS.POLICY_INFO, HIGH_CONFIDENCE);
  }

  return buildLocalResult(null, 0);
}

function hasAny(value, terms) {
  return terms.some((term) => value.includes(term));
}

function buildLocalResult(intent, confidence) {
  return {
    intent,
    confidence,
    source: 'local',
  };
}

export { routeConsultationIntent };
