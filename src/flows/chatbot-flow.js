import { env } from '../config/env.js';
import {
  findCustomerMatch,
  formatCustomerProfile,
  getCustomerCatalogStats,
  looksLikeFreshLookupInput,
  looksLikeRelationshipInput,
  refineCustomerMatchesByAge,
  refineCustomerMatchesByRelationship,
} from '../services/customer-data-service.js';
import {
  extractAgeInput,
  extractLookupInput,
  extractRelationshipInput,
} from '../services/input-normalizer.js';
import { assignAdvisor } from '../services/advisor-service.js';
import { routeConsultationIntent } from '../services/consultation-router-service.js';
import { sendButtons, sendList, sendText } from '../services/whatsapp-service.js';

import { ramoMenu } from './branch-menu-definitions.js';
import {
  CONSULTATION_INTENTS,
  consultationActions,
  consultationMenuSections,
} from './consultation-menu-definitions.js';

function resetSession(state) {
  state.rama = null;
  state.paso = 'inicio';
  state.ramaLabel = '';
  state.pasoLabel = '';
  state.consultaIntent = null;
}

function resetCustomerIdentity(state) {
  state.identificationAttempted = false;
  state.identificationStep = null;
  state.identificationContext = null;
  state.customerProfile = null;
}

function prepareIdentificationRestart(state) {
  state.identificationAttempted = true;
  state.identificationStep = 'awaiting_lookup';
  state.identificationContext = null;
}

async function processIncomingText({ phoneNumber, userId, state, text }) {
  const normalizedText = text.trim();
  const lowered = normalizedText.toLowerCase();

  if (
    lowered === 'no soy yo' ||
    lowered.includes('cambiar usuario') ||
    lowered.includes('reiniciar datos')
  ) {
    resetSession(state);
    resetCustomerIdentity(state);
    prepareIdentificationRestart(state);
    await sendText({
      to: phoneNumber,
      userId,
      text: 'Entendido. Vamos a reiniciar tu identificación. Comparte tu número de póliza o tu nombre completo.',
    });
    return state;
  }

  if (
    normalizedText === 'asesor' ||
    lowered === '0' ||
    (state.customerProfile && state.paso === 'consulta_abierta' && lowered === '8') ||
    lowered.includes('asesor') ||
    lowered.includes('humano') ||
    lowered.includes('persona')
  ) {
    await handoffToAdvisor({ phoneNumber, userId, state });
    return state;
  }

  if (
    lowered === 'menu' ||
    lowered === 'menú' ||
    lowered.includes('inicio') ||
    lowered.includes('volver')
  ) {
    resetSession(state);
  }

  if (!state.customerProfile) {
    return identifyCustomer({ phoneNumber, userId, state, text: normalizedText });
  }

  if (state.paso === 'inicio') {
    return showBranchSelection({ phoneNumber, userId, state });
  }

  if (state.paso === 'elegir_rama') {
    const selectedBranch = resolveBranch(normalizedText, lowered);

    if (!selectedBranch) {
      await sendText({
        to: phoneNumber,
        userId,
        text: 'Por favor selecciona GMM, Accidentes Personales o Vida para continuar.',
      });
      return state;
    }

    setSelectedBranch(state, selectedBranch);
    await showConsultationPrompt({ phoneNumber, userId, state });
    return state;
  }

  if (state.paso === 'consulta_abierta') {
    return routeOpenConsultation({ phoneNumber, userId, state, text: normalizedText });
  }

  resetSession(state);
  return processIncomingText({ phoneNumber, userId, state, text: 'inicio' });
}

async function showBranchSelection({ phoneNumber, userId, state }) {
  state.paso = 'elegir_rama';

  await sendList({
    to: phoneNumber,
    userId,
    header: `Bienvenido a ${env.companyName}`,
    body: `Hola ${state.customerProfile.firstName}, ¿sobre qué ramo es tu consulta?`,
    footer: 'Escribe 0 en cualquier momento para hablar con un asesor',
    sections: ramoMenu,
  });

  return state;
}

function setSelectedBranch(state, selectedBranch) {
  const branchLabels = {
    gmm: 'Gastos Médicos Mayores (GMM)',
    ap: 'Accidentes Personales (AP)',
    vida: 'Seguro de Vida',
  };

  state.rama = selectedBranch;
  state.ramaLabel = branchLabels[selectedBranch];
  state.paso = 'consulta_abierta';
  state.pasoLabel = '';
  state.consultaIntent = null;
}

async function showConsultationPrompt({ phoneNumber, userId, state }) {
  await sendList({
    to: phoneNumber,
    userId,
    header: state.ramaLabel,
    body: '¿Cuál es tu consulta? Puedes escribirla con tus palabras o elegir una opción.',
    footer: 'Gemini me ayuda a canalizar tu solicitud',
    sections: consultationMenuSections,
  });
}

async function routeOpenConsultation({ phoneNumber, userId, state, text }) {
  const routing = await routeConsultationIntent({
    text,
    branchLabel: state.ramaLabel,
  });

  if (!routing.intent) {
    await sendList({
      to: phoneNumber,
      userId,
      header: state.ramaLabel,
      body: 'No estoy seguro de haber entendido tu consulta. Puedes escribirla de otra forma o elegir una opción.',
      footer: 'Escribe 8 para hablar con un asesor',
      sections: consultationMenuSections,
    });
    return state;
  }

  state.consultaIntent = routing.intent;

  if (routing.intent === CONSULTATION_INTENTS.ADVISOR) {
    await handoffToAdvisor({ phoneNumber, userId, state });
    return state;
  }

  if (routing.intent === CONSULTATION_INTENTS.PREVIOUS_MENU) {
    state.rama = null;
    state.ramaLabel = '';
    state.pasoLabel = '';
    state.consultaIntent = null;
    return showBranchSelection({ phoneNumber, userId, state });
  }

  const action = consultationActions[routing.intent];
  state.pasoLabel = action.pasoLabel;

  await sendButtons({
    to: phoneNumber,
    userId,
    body: buildConsultationResponseBody(state, routing.intent),
    footer: `Ramo: ${state.ramaLabel}`,
    buttons: [
      { id: CONSULTATION_INTENTS.PREVIOUS_MENU, title: '🔙 Ramo' },
      { id: 'menu_principal', title: '🏠 Inicio' },
      { id: CONSULTATION_INTENTS.ADVISOR, title: '👤 Asesor' },
    ],
  });

  return state;
}

function resolveBranch(text, lowered) {
  if (text === 'gmm' || text === '1' || lowered.includes('gmm') || lowered.includes('gastos')) {
    return 'gmm';
  }

  if (text === 'ap' || text === '2' || lowered.includes('accidente')) {
    return 'ap';
  }

  if (text === 'vida' || text === '3' || lowered.includes('vida')) {
    return 'vida';
  }

  return null;
}

function buildConsultationResponseBody(state, intent) {
  const action = consultationActions[intent];
  const bodyByIntent = {
    [CONSULTATION_INTENTS.POLICY_INFO]: buildPolicyInformationBody(state),
    [CONSULTATION_INTENTS.MEDICAL_URGENCY]: buildMedicalUrgencyBody(state),
    [CONSULTATION_INTENTS.CLAIM_STATUS]: buildClaimStatusBody(),
    [CONSULTATION_INTENTS.CLAIM_DOCUMENTS]: buildClaimDocumentsBody(state),
    [CONSULTATION_INTENTS.HOSPITAL_ENTRY_EXIT]: buildHospitalEntryExitBody(state),
    [CONSULTATION_INTENTS.START_CLAIM]: buildStartClaimBody(state),
  };

  return [
    `*${action.label}*`,
    '',
    bodyByIntent[intent] ?? 'Estoy revisando tu consulta.',
    '',
    'Puedes escribir otra consulta o usar los botones de abajo.',
  ].join('\n');
}

function buildPolicyInformationBody(state) {
  const profile = state.customerProfile;
  const policyCoverage = profile?.policyCoverage;
  const benefits = profile?.policyBenefits ?? [];
  const lines = [
    `Aseguradora: ${profile?.insurer || 'No disponible'}`,
    `Póliza: ${profile?.policyNumber || 'No disponible'}`,
    `Parentesco: ${profile?.relationship || 'No disponible'}`,
  ];

  if (policyCoverage) {
    lines.push(
      '',
      'Datos de tu póliza:',
      `Perfil: ${policyCoverage.profile}`,
      `Plan: ${policyCoverage.plan}`,
      `Subgrupo: ${policyCoverage.subGroup}`,
      `No. filial: ${policyCoverage.branchNumber}`,
      `Círculo médico: ${policyCoverage.medicalCircle}`,
      `Círculo médico reembolso: ${policyCoverage.reimbursementMedicalCircle}`,
    );
  }

  if (benefits.length > 0) {
    lines.push('', 'Coberturas principales:');
    lines.push(...benefits.slice(0, 8).map((benefit) => `- ${formatBenefitLine(benefit)}`));

    if (benefits.length > 8) {
      lines.push(`- Y ${benefits.length - 8} cobertura(s) adicional(es).`);
    }
  }

  return lines.join('\n');
}

function buildMedicalUrgencyBody(state) {
  return [
    'Si es una emergencia que pone en riesgo tu vida, llama primero al 911.',
    '',
    'Para atención médica, ten a la mano:',
    '- Número de póliza',
    '- Identificación oficial',
    '- Nombre del hospital o médico',
    '- Motivo de la atención',
    '',
    `Ramo seleccionado: ${state.ramaLabel}.`,
    'Si necesitas apoyo inmediato, elige Asesor.',
  ].join('\n');
}

function buildClaimStatusBody() {
  return [
    'Para revisar el estatus necesitamos el número de caso, siniestro o reclamación.',
    '',
    'Si no lo tienes a la mano, un asesor puede ayudarte a ubicarlo con tus datos de póliza.',
  ].join('\n');
}

function buildClaimDocumentsBody(state) {
  return [
    `Para ${state.ramaLabel}, normalmente se solicitan documentos de identificación, póliza, comprobantes y formatos de la aseguradora.`,
    '',
    'Como los requisitos pueden cambiar según el tipo de caso, te puedo canalizar con un asesor para confirmar la lista exacta.',
  ].join('\n');
}

function buildHospitalEntryExitBody(state) {
  return [
    `Para entrada o salida del hospital en ${state.ramaLabel}, considera tener listos:`,
    '- Identificación oficial',
    '- Datos de póliza',
    '- Informe médico o diagnóstico',
    '- Hospital y médico tratante',
    '- Autorizaciones o cartas de la aseguradora, si aplican',
    '',
    'Antes de firmar o pagar, conviene validar cobertura y proceso con asesoría.',
  ].join('\n');
}

function buildStartClaimBody(state) {
  return [
    `Para iniciar un trámite de siniestro en ${state.ramaLabel}:`,
    '1. Reúne datos de póliza y asegurado.',
    '2. Ten documentos médicos o soporte del caso.',
    '3. Conserva facturas, recibos y reportes originales.',
    '4. Contacta a un asesor para validar el proceso correcto con la aseguradora.',
  ].join('\n');
}

function formatBenefitLine(benefit) {
  const detailParts = [
    benefit.status,
    formatBenefitValue(benefit.value, benefit.unit),
    benefit.observations,
  ].filter(Boolean);

  return `${benefit.coverage}: ${detailParts.join(' | ') || 'Sin detalle disponible'}`;
}

function formatBenefitValue(value, unit) {
  const cleanValue = String(value ?? '').trim();
  const cleanUnit = String(unit ?? '').trim();

  if (!cleanValue) {
    return '';
  }

  return cleanUnit ? `${cleanValue} ${cleanUnit}` : cleanValue;
}

async function handoffToAdvisor({ phoneNumber, userId, state }) {
  const assignment = await assignAdvisor({
    userId,
    ramaLabel: state.ramaLabel,
    pasoLabel: state.pasoLabel,
    customerProfile: state.customerProfile,
  });

  await sendText({
    to: phoneNumber,
    userId,
    text: `*Te conectamos con un asesor de ${env.companyName}*\n\nToca el enlace para iniciar la conversación:\n${assignment.waLink}\n\nHorario de mensajes: Lun-Dom 7:30am - 3:00pm\nLlamadas: 24/7`,
  });
}

async function identifyCustomer({ phoneNumber, userId, state, text }) {
  const catalogStats = getCustomerCatalogStats();

  if (!catalogStats.loaded) {
    state.paso = 'inicio';
    await sendText({
      to: phoneNumber,
      userId,
      text: 'En este momento no tengo acceso al catálogo de asegurados. Escribe 0 para hablar con un asesor.',
    });
    return state;
  }

  if (!state.identificationAttempted) {
    prepareIdentificationRestart(state);
    state.paso = 'identificar_cliente';

    await sendText({
      to: phoneNumber,
      userId,
      text: '👋 Hola, soy el asistente de Inter.\n\nPara ubicar tu información, comparte tu número de póliza o nombre completo.',
    });

    return state;
  }

  if (state.identificationStep === 'awaiting_age') {
    return continueCustomerIdentificationByAge({ phoneNumber, userId, state, text });
  }

  if (state.identificationStep === 'awaiting_relationship') {
    return continueCustomerIdentificationByRelationship({ phoneNumber, userId, state, text });
  }

  const lookupInput = extractLookupInput(text);
  const lookupResult = findCustomerMatch(lookupInput);

  if (lookupResult.matches.length === 1) {
    return finalizeCustomerIdentification({
      phoneNumber,
      userId,
      state,
      customer: lookupResult.matches[0],
    });
  }

  if (lookupResult.matches.length > 1) {
    state.identificationStep = 'awaiting_age';
    state.identificationContext = {
      lookupType: lookupResult.type,
      matchMode: lookupResult.matchMode,
      pendingMatches: lookupResult.matches,
    };

    await sendText({
      to: phoneNumber,
      userId,
      text: 'Encontré varias coincidencias con ese dato. Para ubicarte sin mostrar información sensible, comparte tu edad, tu año de nacimiento o tu fecha de nacimiento.',
    });

    return state;
  }

  await sendText({
    to: phoneNumber,
    userId,
    text: 'No encontré coincidencias con ese dato. Intenta con tu número de póliza completo o tu nombre completo como aparece en la póliza.',
  });

  return state;
}

async function continueCustomerIdentificationByAge({ phoneNumber, userId, state, text }) {
  const ageInput = extractAgeInput(text);

  if (looksLikeFreshLookupInput(text) && !/^\d+$/.test(String(ageInput).trim())) {
    prepareIdentificationRestart(state);
    return identifyCustomer({ phoneNumber, userId, state, text });
  }

  const pendingMatches = state.identificationContext?.pendingMatches ?? [];
  const result = refineCustomerMatchesByAge(pendingMatches, ageInput);

  if (!result.valid) {
    await sendText({
      to: phoneNumber,
      userId,
      text: 'Necesito tu edad, tu año de nacimiento o tu fecha de nacimiento para continuar. Por ejemplo: 36, 1990 o 01/01/1990.',
    });
    return state;
  }

  if (result.matches.length === 1) {
    return finalizeCustomerIdentification({
      phoneNumber,
      userId,
      state,
      customer: result.matches[0],
    });
  }

  if (result.matches.length > 1) {
    state.identificationStep = 'awaiting_relationship';
    state.identificationContext = {
      ...state.identificationContext,
      pendingMatches: result.matches,
    };

    await sendText({
      to: phoneNumber,
      userId,
      text: 'Gracias. Todavía necesito un dato adicional para ubicarte mejor. Comparte tu parentesco en la póliza, por ejemplo: TITULAR, CÓNYUGE o HIJO(A).',
    });
    return state;
  }

  state.identificationStep = 'awaiting_lookup';
  state.identificationContext = null;

  await sendText({
    to: phoneNumber,
    userId,
    text: 'Con esa edad no encontré una coincidencia única. Intenta con tu número de póliza completo o con tu nombre completo como aparece en la póliza.',
  });

  return state;
}

async function continueCustomerIdentificationByRelationship({ phoneNumber, userId, state, text }) {
  const relationshipInput = extractRelationshipInput(text);

  if (looksLikeFreshLookupInput(text) && !looksLikeRelationshipInput(relationshipInput)) {
    prepareIdentificationRestart(state);
    return identifyCustomer({ phoneNumber, userId, state, text });
  }

  const pendingMatches = state.identificationContext?.pendingMatches ?? [];
  const result = refineCustomerMatchesByRelationship(pendingMatches, relationshipInput);

  if (!result.valid) {
    await sendText({
      to: phoneNumber,
      userId,
      text: 'Necesito tu parentesco tal como aparece en la póliza. Por ejemplo: TITULAR, CÓNYUGE o HIJO(A).',
    });
    return state;
  }

  if (result.matches.length === 1) {
    return finalizeCustomerIdentification({
      phoneNumber,
      userId,
      state,
      customer: result.matches[0],
    });
  }

  state.identificationStep = 'awaiting_lookup';
  state.identificationContext = null;

  await sendText({
    to: phoneNumber,
    userId,
    text: 'Aún no pude ubicar un registro único con esos datos. Intenta con tu número de póliza completo o escribe 0 para hablar con un asesor.',
  });

  return state;
}

async function finalizeCustomerIdentification({ phoneNumber, userId, state, customer }) {
  state.customerProfile = formatCustomerProfile(customer);
  state.paso = 'inicio';
  state.identificationStep = null;
  state.identificationContext = null;

  await sendText({
    to: phoneNumber,
    userId,
    text: `✅ Gracias, ${state.customerProfile.firstName}.\n\nYa encontré tu registro con la aseguradora ${state.customerProfile.insurer}.`,
  });

  return processIncomingText({ phoneNumber, userId, state, text: 'inicio' });
}

export { processIncomingText };
