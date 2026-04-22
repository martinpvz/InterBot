import { env } from '../config/env.js';
import { assignAdvisor } from '../services/advisor-service.js';
import { sendButtons, sendList, sendText } from '../services/whatsapp-service.js';

import { menuDefinitions, ramoMenu } from './menu-definitions.js';

function resetSession(state) {
  state.rama = null;
  state.paso = 'inicio';
  state.ramaLabel = '';
  state.pasoLabel = '';
}

async function processIncomingText({ phoneNumber, userId, state, text }) {
  const normalizedText = text.trim();
  const lowered = normalizedText.toLowerCase();

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

  if (state.paso === 'inicio') {
    state.paso = 'elegir_rama';

    await sendList({
      to: phoneNumber,
      userId,
      header: `Bienvenido a ${env.companyName}`,
      body: 'Sobre que ramo es tu consulta?',
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
          { id: branchDefinition.backId, title: 'Volver al menu' },
          { id: 'asesor', title: 'Hablar con asesor' },
        ],
      });

      return state;
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
  });

  await sendText({
    to: phoneNumber,
    userId,
    text: `*Te conectamos con un asesor de ${env.companyName}*\n\nToca el enlace para iniciar la conversacion:\n${assignment.waLink}\n\nHorario de mensajes: Lun-Dom 7:30am - 3:00pm\nLlamadas: 24/7`,
  });
}

export { processIncomingText };
