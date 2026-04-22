const ramoMenu = [{
  title: 'Ramos disponibles',
  rows: [
    { id: 'gmm', title: 'Gastos Medicos', description: 'Coberturas, hospitales, siniestros' },
    { id: 'ap', title: 'Accidentes Personales', description: 'Coberturas, reembolsos, siniestros' },
    { id: 'vida', title: 'Vida', description: 'Reclamaciones, documentos, pagos' },
  ],
}];

const menuDefinitions = {
  gmm: {
    ramaLabel: 'Gastos Medicos Mayores (GMM)',
    menuKey: 'menu_gmm',
    header: 'Gastos Medicos Mayores',
    body: 'En que te podemos ayudar?',
    footer: 'Escribe 0 en cualquier momento para hablar con un asesor',
    sections: [{
      title: 'Opciones GMM',
      rows: [
        { id: 'gmm_coberturas', title: 'Coberturas', description: 'Que cubre tu plan' },
        { id: 'gmm_hospitales', title: 'Hospitales en red', description: 'Donde atenderte' },
        { id: 'gmm_siniestro', title: 'Iniciar siniestro', description: 'Pasos a seguir' },
        { id: 'gmm_reclamacion', title: 'Estado reclamacion', description: 'Consulta tu caso' },
      ],
    }],
    actions: {
      gmm_coberturas: {
        pasoLabel: 'Coberturas del plan',
        body: `*Coberturas GMM (Demo)*\n\nIncluye:\n- Hospitalizacion\n- Cirugias\n- Medicamentos en hospital\n- Estudios de laboratorio\n- Honorarios medicos\n- Urgencias\n\nSuma asegurada: hasta $5,000,000 MXN\nDeducible: desde $5,000 MXN`,
      },
      gmm_hospitales: {
        pasoLabel: 'Hospitales y medicos en red',
        body: `*Hospitales en red GMM (Demo)*\n\n- Hospital ABC - CDMX\n- Medica Sur - CDMX\n- Hospital Angeles - Varias sedes\n- TecSalud - Monterrey\n- Puerta de Hierro - GDL\n\nPara verificar si tu hospital esta en red, contacta a un asesor.`,
      },
      gmm_siniestro: {
        pasoLabel: 'Como iniciar un siniestro',
        body: `*Como iniciar un siniestro GMM*\n\n1. Llama al 800-XXX-XXXX (24/7)\n2. Ten a la mano tu numero de poliza\n3. Describe el motivo de la atencion\n4. Te asignaran un numero de caso\n5. Acude al hospital en red indicado`,
      },
      gmm_reclamacion: {
        pasoLabel: 'Estado de reclamacion',
        body: `*Estado de reclamacion GMM*\n\nPara consultar el estado de tu reclamacion necesitamos tu numero de caso.\n\nEscribelo a continuacion o contacta a un asesor.`,
      },
    },
    backId: 'gmm_back',
  },
  ap: {
    ramaLabel: 'Accidentes Personales (AP)',
    menuKey: 'menu_ap',
    header: 'Accidentes Personales',
    body: 'En que te podemos ayudar?',
    footer: 'Escribe 0 en cualquier momento para hablar con un asesor',
    sections: [{
      title: 'Opciones AP',
      rows: [
        { id: 'ap_coberturas', title: 'Coberturas', description: 'Que cubre tu plan' },
        { id: 'ap_acudir', title: 'A donde acudir?', description: 'En caso de accidente' },
        { id: 'ap_reembolso', title: 'Formato reembolso', description: 'Solicita tu formato' },
        { id: 'ap_siniestro', title: 'Iniciar siniestro', description: 'Pasos a seguir' },
      ],
    }],
    actions: {
      ap_coberturas: {
        pasoLabel: 'Coberturas del plan',
        body: `*Coberturas AP (Demo)*\n\nIncluye:\n- Muerte accidental\n- Invalidez total y permanente\n- Gastos medicos por accidente\n- Gastos funerarios\n- Fracturas\n\nSuma asegurada: desde $500,000 MXN`,
      },
      ap_acudir: {
        pasoLabel: 'A donde acudir en caso de accidente?',
        body: '*A donde acudir en caso de accidente?*\n\nEmergencia grave: llama al 911 primero, luego notifica a InterProteccion.\n\nTelefono: 800-XXX-XXXX (24/7)\n\nTen listo:\n- Numero de poliza\n- Descripcion del accidente\n- Hospital donde te encuentras',
      },
      ap_reembolso: {
        pasoLabel: 'Formato de reembolso',
        body: `*Formato de Reembolso AP (Demo)*\n\nPara enviarte el formato necesitamos tu correo electronico.\n\nEscribelo a continuacion y te lo enviamos de inmediato.`,
      },
      ap_siniestro: {
        pasoLabel: 'Como iniciar un siniestro',
        body: `*Como iniciar un siniestro AP*\n\n1. Llama al 800-XXX-XXXX\n2. Ten tu numero de poliza a la mano\n3. Describe el accidente (fecha, lugar, como ocurrio)\n4. Te asignaran un ajustador\n5. Reune los documentos solicitados`,
      },
    },
    backId: 'ap_back',
  },
  vida: {
    ramaLabel: 'Seguro de Vida',
    menuKey: 'menu_vida',
    header: 'Seguro de Vida',
    body: 'Estamos aqui para ayudarte. Selecciona una opcion.',
    footer: 'Escribe 0 en cualquier momento para hablar con un asesor',
    sections: [{
      title: 'Opciones Vida',
      rows: [
        { id: 'vida_pasos', title: 'Pasos para reclamar', description: 'Como iniciar el proceso' },
        { id: 'vida_documentos', title: 'Documentos necesarios', description: 'Que necesitas presentar' },
        { id: 'vida_tiempos', title: 'Tiempos de pago', description: 'Cuando recibiras el pago' },
        { id: 'vida_reclamacion', title: 'Estado reclamacion', description: 'Consulta tu caso' },
      ],
    }],
    actions: {
      vida_pasos: {
        pasoLabel: 'Pasos para reclamar el seguro',
        body: `*Pasos para reclamar seguro de Vida (Demo)*\n\n1. Notifica a InterProteccion al 800-XXX-XXXX\n2. Reune los documentos necesarios\n3. Presenta la documentacion en oficinas o enviala digitalmente\n4. Un ajustador revisara el caso\n5. Pago en un plazo de 30 dias habiles`,
      },
      vida_documentos: {
        pasoLabel: 'Documentos necesarios',
        body: `*Documentos necesarios - Vida (Demo)*\n\n- Acta de defuncion (original)\n- Poliza de seguro\n- Identificacion oficial del beneficiario\n- CURP del beneficiario\n- Comprobante de domicilio\n- Estado de cuenta bancario del beneficiario\n- Certificado medico de causa de muerte`,
      },
      vida_tiempos: {
        pasoLabel: 'Tiempos de pago',
        body: `*Tiempos de pago - Vida (Demo)*\n\n- Muerte natural: 30 dias habiles\n- Muerte accidental: 15 dias habiles\n- Casos especiales: hasta 60 dias\n\nLos tiempos inician una vez que la documentacion esta completa.`,
      },
      vida_reclamacion: {
        pasoLabel: 'Estado de reclamacion',
        body: `*Estado de reclamacion Vida*\n\nEscribe tu numero de caso o numero de poliza a continuacion, o contacta a un asesor.`,
      },
    },
    backId: 'vida_back',
  },
};

export { menuDefinitions, ramoMenu };
