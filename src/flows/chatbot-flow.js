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
import { assignAdvisor } from '../services/advisor-service.js';
import { sendButtons, sendList, sendText } from '../services/whatsapp-service.js';

import { menuDefinitions, ramoMenu } from './menu-definitions.js';

function resetSession(state) {
  state.rama = null;
  state.paso = 'inicio';
  state.ramaLabel = '';
  state.pasoLabel = '';
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
      text: 'Entendido. Vamos a reiniciar tu identificacion. Comparte tu numero de poliza o tu nombre completo.',
    });
    return state;
  }

  if (
    normalizedText === 'asesor' ||
    lowered === '0' ||
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
    state.paso = 'elegir_rama';

    await sendList({
      to: phoneNumber,
      userId,
      header: `Bienvenido a ${env.companyName}`,
      body: `Hola ${state.customerProfile.firstName}, sobre que ramo es tu consulta?`,
      footer: 'Escribe 0 en cualquier momento para hablar con un asesor',
      sections: ramoMenu,
    });

    return state;
  }

  if (state.paso === 'elegir_rama') {
    const selectedBranch = resolveBranch(normalizedText, lowered);

    if (!selectedBranch) {
      await sendText({
        to: phoneNumber,
        userId,
        text: 'Por favor selecciona una opcion del menu. Escribe menu para verlo de nuevo.',
      });
      return state;
    }

    const branchDefinition = menuDefinitions[selectedBranch];
    state.rama = selectedBranch;
    state.paso = branchDefinition.menuKey;
    state.ramaLabel = branchDefinition.ramaLabel;
    state.pasoLabel = '';

    await showBranchMenu({ phoneNumber, userId, branchKey: selectedBranch });
    return state;
  }

  if (state.rama && menuDefinitions[state.rama] && state.paso === menuDefinitions[state.rama].menuKey) {
    const branchDefinition = menuDefinitions[state.rama];

    if (normalizedText === branchDefinition.backId) {
      state.pasoLabel = '';
      await showBranchMenu({ phoneNumber, userId, branchKey: state.rama });
      return state;
    }

    const action = branchDefinition.actions[normalizedText];

    if (action) {
      state.pasoLabel = action.pasoLabel;

      await sendButtons({
        to: phoneNumber,
        userId,
        body: `${action.body}\n\n_Ramo: ${state.ramaLabel}_`,
        footer: env.companyName,
        buttons: [
          { id: branchDefinition.backId, title: '↩️ Submenu' },
          { id: 'menu_principal', title: '🏠 Inicio' },
          { id: 'asesor', title: '👤 Asesor' },
        ],
      });

      return state;
    }

    if (normalizedText === 'menu_principal') {
      resetSession(state);
      return processIncomingText({ phoneNumber, userId, state, text: 'inicio' });
    }
  }

  resetSession(state);
  return processIncomingText({ phoneNumber, userId, state, text: 'inicio' });
}

function resolveBranch(text, lowered) {
  if (text === 'gmm' || lowered.includes('gmm') || lowered.includes('gastos')) {
    return 'gmm';
  }

  if (text === 'ap' || lowered.includes('accidente')) {
    return 'ap';
  }

  if (text === 'vida' || lowered.includes('vida')) {
    return 'vida';
  }

  return null;
}

async function showBranchMenu({ phoneNumber, userId, branchKey }) {
  const branch = menuDefinitions[branchKey];

  await sendList({
    to: phoneNumber,
    userId,
    header: branch.header,
    body: branch.body,
    footer: branch.footer,
    sections: branch.sections,
  });
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
    text: `*Te conectamos con un asesor de ${env.companyName}*\n\nToca el enlace para iniciar la conversacion:\n${assignment.waLink}\n\nHorario de mensajes: Lun-Dom 7:30am - 3:00pm\nLlamadas: 24/7`,
  });
}

async function identifyCustomer({ phoneNumber, userId, state, text }) {
  const catalogStats = getCustomerCatalogStats();

  if (!catalogStats.loaded) {
    state.paso = 'inicio';
    await sendText({
      to: phoneNumber,
      userId,
      text: 'En este momento no tengo acceso al catalogo de asegurados. Escribe 0 para hablar con un asesor.',
    });
    return state;
  }

  if (!state.identificationAttempted) {
    prepareIdentificationRestart(state);
    state.paso = 'identificar_cliente';

    await sendText({
      to: phoneNumber,
      userId,
      text: `Hola, soy el asistente de ${env.companyName}. Para ubicar tu informacion, comparte tu numero de poliza o tu nombre completo.`,
    });

    return state;
  }

  if (state.identificationStep === 'awaiting_age') {
    return continueCustomerIdentificationByAge({ phoneNumber, userId, state, text });
  }

  if (state.identificationStep === 'awaiting_relationship') {
    return continueCustomerIdentificationByRelationship({ phoneNumber, userId, state, text });
  }

  const lookupResult = findCustomerMatch(text);

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
      text: 'Encontre varias coincidencias con ese dato. Para ubicarte sin mostrar informacion sensible, comparte tu edad en numero.',
    });

    return state;
  }

  await sendText({
    to: phoneNumber,
    userId,
    text: 'No encontre coincidencias con ese dato. Intenta con tu numero de poliza completo o tu nombre completo como aparece en la poliza.',
  });

  return state;
}

async function continueCustomerIdentificationByAge({ phoneNumber, userId, state, text }) {
  if (looksLikeFreshLookupInput(text) && !/^\d+$/.test(String(text).trim())) {
    prepareIdentificationRestart(state);
    return identifyCustomer({ phoneNumber, userId, state, text });
  }

  const pendingMatches = state.identificationContext?.pendingMatches ?? [];
  const result = refineCustomerMatchesByAge(pendingMatches, text);

  if (!result.valid) {
    await sendText({
      to: phoneNumber,
      userId,
      text: 'Necesito tu edad en numero para continuar. Por ejemplo: 36.',
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
      text: 'Gracias. Todavia necesito un dato adicional para ubicarte mejor. Comparte tu parentesco en la poliza, por ejemplo: TITULAR, CONYUGE o HIJO(A).',
    });
    return state;
  }

  state.identificationStep = 'awaiting_lookup';
  state.identificationContext = null;

  await sendText({
    to: phoneNumber,
    userId,
    text: 'Con esa edad no encontre una coincidencia unica. Intenta con tu numero de poliza completo o con tu nombre completo como aparece en la poliza.',
  });

  return state;
}

async function continueCustomerIdentificationByRelationship({ phoneNumber, userId, state, text }) {
  if (looksLikeFreshLookupInput(text) && !looksLikeRelationshipInput(text)) {
    prepareIdentificationRestart(state);
    return identifyCustomer({ phoneNumber, userId, state, text });
  }

  const pendingMatches = state.identificationContext?.pendingMatches ?? [];
  const result = refineCustomerMatchesByRelationship(pendingMatches, text);

  if (!result.valid) {
    await sendText({
      to: phoneNumber,
      userId,
      text: 'Necesito tu parentesco tal como aparece en la poliza. Por ejemplo: TITULAR, CONYUGE o HIJO(A).',
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
    text: 'Aun no pude ubicar un registro unico con esos datos. Intenta con tu numero de poliza completo o escribe 0 para hablar con un asesor.',
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
    text: `Gracias, ${state.customerProfile.firstName}. Ya encontre tu registro con la aseguradora ${state.customerProfile.insurer}.`,
  });

  return processIncomingText({ phoneNumber, userId, state, text: 'inicio' });
}

export { processIncomingText };
