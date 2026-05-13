const CONSULTATION_INTENTS = {
  POLICY_INFO: 'policy_info',
  MEDICAL_URGENCY: 'medical_urgency',
  CLAIM_STATUS: 'claim_status',
  CLAIM_DOCUMENTS: 'claim_documents',
  HOSPITAL_ENTRY_EXIT: 'hospital_entry_exit',
  START_CLAIM: 'start_claim',
  PREVIOUS_MENU: 'previous_menu',
  ADVISOR: 'advisor',
};

const consultationActions = {
  [CONSULTATION_INTENTS.POLICY_INFO]: {
    number: '1',
    label: 'Informacion de mi poliza',
    pasoLabel: 'Informacion de mi poliza',
    aiDescription: 'El usuario quiere consultar informacion general de su poliza, plan, perfil, coberturas, circulo medico, deducible o suma asegurada.',
  },
  [CONSULTATION_INTENTS.MEDICAL_URGENCY]: {
    number: '2',
    label: 'Urgencia medica',
    pasoLabel: 'Urgencia medica',
    aiDescription: 'El usuario reporta una urgencia, emergencia, accidente, atencion inmediata o necesita saber que hacer ante una situacion medica urgente.',
  },
  [CONSULTATION_INTENTS.CLAIM_STATUS]: {
    number: '3',
    label: 'Estatus de siniestro',
    pasoLabel: 'Estatus de siniestro',
    aiDescription: 'El usuario quiere conocer el estado, seguimiento o avance de un siniestro, reclamacion, reembolso o caso ya iniciado.',
  },
  [CONSULTATION_INTENTS.CLAIM_DOCUMENTS]: {
    number: '4',
    label: 'Documentacion en caso',
    pasoLabel: 'Documentacion en caso',
    aiDescription: 'El usuario pregunta por documentos, requisitos, papeles, formatos o informacion necesaria para un caso o reclamacion.',
  },
  [CONSULTATION_INTENTS.HOSPITAL_ENTRY_EXIT]: {
    number: '5',
    label: 'Entrada/salida del hospital',
    pasoLabel: 'Entrada o salida del hospital',
    aiDescription: 'El usuario pregunta por ingreso, admision, entrada, egreso, alta, salida del hospital, carta pase o puntos importantes durante hospitalizacion.',
  },
  [CONSULTATION_INTENTS.START_CLAIM]: {
    number: '6',
    label: 'Iniciar tramite de siniestro',
    pasoLabel: 'Iniciar tramite de siniestro',
    aiDescription: 'El usuario quiere iniciar, abrir, levantar o comenzar un tramite de siniestro, reclamacion o reembolso.',
  },
  [CONSULTATION_INTENTS.PREVIOUS_MENU]: {
    number: '7',
    label: 'Regresar al menu anterior',
    pasoLabel: 'Menu anterior',
    aiDescription: 'El usuario quiere regresar, volver o cambiar el ramo seleccionado.',
  },
  [CONSULTATION_INTENTS.ADVISOR]: {
    number: '8',
    label: 'Hablar con un asesor',
    pasoLabel: 'Asesor',
    aiDescription: 'El usuario quiere hablar con una persona, asesor, humano o ejecutivo.',
  },
};

const consultationMenuSections = [{
  title: 'Consultas disponibles',
  rows: [
    {
      id: CONSULTATION_INTENTS.POLICY_INFO,
      title: 'Info de mi poliza',
      description: 'Perfil, plan, circulo medico y coberturas',
    },
    {
      id: CONSULTATION_INTENTS.MEDICAL_URGENCY,
      title: 'Urgencia medica',
      description: 'Que hacer si necesitas atencion inmediata',
    },
    {
      id: CONSULTATION_INTENTS.CLAIM_STATUS,
      title: 'Estatus siniestro',
      description: 'Seguimiento de un caso o reclamacion',
    },
    {
      id: CONSULTATION_INTENTS.CLAIM_DOCUMENTS,
      title: 'Documentacion caso',
      description: 'Requisitos y documentos necesarios',
    },
    {
      id: CONSULTATION_INTENTS.HOSPITAL_ENTRY_EXIT,
      title: 'Entrada/salida hospital',
      description: 'Puntos importantes para admision o alta',
    },
    {
      id: CONSULTATION_INTENTS.START_CLAIM,
      title: 'Iniciar siniestro',
      description: 'Comenzar un tramite o reclamacion',
    },
    {
      id: CONSULTATION_INTENTS.PREVIOUS_MENU,
      title: 'Menu anterior',
      description: 'Volver a elegir GMM, AP o Vida',
    },
    {
      id: CONSULTATION_INTENTS.ADVISOR,
      title: 'Hablar con asesor',
      description: 'Contactar a una persona de Inter',
    },
  ],
}];

const consultationInputAliases = new Map([
  ['1', CONSULTATION_INTENTS.POLICY_INFO],
  ['info de mi poliza', CONSULTATION_INTENTS.POLICY_INFO],
  ['informacion de mi poliza', CONSULTATION_INTENTS.POLICY_INFO],
  ['mi poliza', CONSULTATION_INTENTS.POLICY_INFO],
  ['poliza', CONSULTATION_INTENTS.POLICY_INFO],
  ['2', CONSULTATION_INTENTS.MEDICAL_URGENCY],
  ['urgencia medica', CONSULTATION_INTENTS.MEDICAL_URGENCY],
  ['urgencia', CONSULTATION_INTENTS.MEDICAL_URGENCY],
  ['emergencia', CONSULTATION_INTENTS.MEDICAL_URGENCY],
  ['3', CONSULTATION_INTENTS.CLAIM_STATUS],
  ['estatus de siniestro', CONSULTATION_INTENTS.CLAIM_STATUS],
  ['estado de siniestro', CONSULTATION_INTENTS.CLAIM_STATUS],
  ['estatus siniestro', CONSULTATION_INTENTS.CLAIM_STATUS],
  ['4', CONSULTATION_INTENTS.CLAIM_DOCUMENTS],
  ['documentacion en caso', CONSULTATION_INTENTS.CLAIM_DOCUMENTS],
  ['documentacion caso', CONSULTATION_INTENTS.CLAIM_DOCUMENTS],
  ['documentos', CONSULTATION_INTENTS.CLAIM_DOCUMENTS],
  ['5', CONSULTATION_INTENTS.HOSPITAL_ENTRY_EXIT],
  ['entrada salida hospital', CONSULTATION_INTENTS.HOSPITAL_ENTRY_EXIT],
  ['entrada/salida hospital', CONSULTATION_INTENTS.HOSPITAL_ENTRY_EXIT],
  ['entrada al hospital', CONSULTATION_INTENTS.HOSPITAL_ENTRY_EXIT],
  ['salida del hospital', CONSULTATION_INTENTS.HOSPITAL_ENTRY_EXIT],
  ['6', CONSULTATION_INTENTS.START_CLAIM],
  ['iniciar siniestro', CONSULTATION_INTENTS.START_CLAIM],
  ['iniciar tramite de siniestro', CONSULTATION_INTENTS.START_CLAIM],
  ['iniciar tramite', CONSULTATION_INTENTS.START_CLAIM],
  ['7', CONSULTATION_INTENTS.PREVIOUS_MENU],
  ['menu anterior', CONSULTATION_INTENTS.PREVIOUS_MENU],
  ['menu principal', CONSULTATION_INTENTS.PREVIOUS_MENU],
  ['menu_principal', CONSULTATION_INTENTS.PREVIOUS_MENU],
  ['regresar al menu anterior', CONSULTATION_INTENTS.PREVIOUS_MENU],
  ['volver', CONSULTATION_INTENTS.PREVIOUS_MENU],
  ['8', CONSULTATION_INTENTS.ADVISOR],
  ['hablar con asesor', CONSULTATION_INTENTS.ADVISOR],
  ['asesor', CONSULTATION_INTENTS.ADVISOR],
  ['humano', CONSULTATION_INTENTS.ADVISOR],
  ['persona', CONSULTATION_INTENTS.ADVISOR],
]);

function resolveConsultationMenuInput(input) {
  const normalizedInput = normalizeMenuInput(input);

  if (consultationInputAliases.has(normalizedInput)) {
    return consultationInputAliases.get(normalizedInput);
  }

  const matchingRow = consultationMenuSections[0].rows.find((row) => (
    normalizeMenuInput(row.id) === normalizedInput ||
    normalizeMenuInput(row.title) === normalizedInput
  ));

  return matchingRow?.id ?? null;
}

function normalizeMenuInput(value) {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[¿?¡!.,;:]+/g, '')
    .replace(/\s*\/\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export {
  CONSULTATION_INTENTS,
  consultationActions,
  consultationMenuSections,
  normalizeMenuInput,
  resolveConsultationMenuInput,
};
