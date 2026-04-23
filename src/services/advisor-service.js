import { env } from '../config/env.js';
import { runInTransaction } from '../db/run-in-transaction.js';
import {
  getActiveAdvisors,
  getAndAdvanceAdvisorCursor,
  insertHandoff,
} from '../repositories/advisor-repository.js';
import { HttpError } from '../lib/http-error.js';

async function assignAdvisor({ userId, ramaLabel, pasoLabel, customerProfile }) {
  return runInTransaction(async (client) => {
    const advisors = await getActiveAdvisors(client);

    if (advisors.length === 0) {
      throw new HttpError(503, 'No hay asesores activos configurados');
    }

    const selectedIndex = await getAndAdvanceAdvisorCursor(client, advisors.length);
    const advisor = advisors[selectedIndex];

    await insertHandoff(client, {
      userId,
      advisorId: advisor.id,
      branch: ramaLabel || null,
      stepLabel: pasoLabel || null,
    });

    const customerLines = customerProfile
      ? [
          `Nombre: ${customerProfile.fullName}`,
          `Poliza: ${customerProfile.policyNumber}`,
          `Genero: ${customerProfile.gender}`,
          `Aseguradora: ${customerProfile.insurer}`,
          `Parentesco: ${customerProfile.relationship}`,
          `Edad: ${customerProfile.age}`,
          `Grupo economico: ${customerProfile.economicGroup}`,
        ]
      : [];
    const policyCoverageLines = customerProfile?.policyCoverage
      ? [
          `Perfil: ${customerProfile.policyCoverage.profile}`,
          `Plan: ${customerProfile.policyCoverage.plan}`,
          `Subgrupo: ${customerProfile.policyCoverage.subGroup}`,
          `No. filial: ${customerProfile.policyCoverage.branchNumber}`,
          `Circulo medico: ${customerProfile.policyCoverage.medicalCircle}`,
          `Circulo medico reembolso: ${customerProfile.policyCoverage.reimbursementMedicalCircle}`,
        ]
      : [];

    const consultationLines = [
      `Ramo: ${ramaLabel || 'Sin definir'}`,
      `Tema: ${pasoLabel || 'Orientacion general'}`,
    ];

    const messageBody = [
      `Hola, me comunico desde el chatbot de ${env.companyName}.`,
      '',
      'Resumen del asegurado:',
      ...(customerLines.length > 0 ? customerLines : ['Sin datos de asegurado identificados.']),
      ...(policyCoverageLines.length > 0 ? ['', 'Datos de poliza:', ...policyCoverageLines] : []),
      '',
      'Consulta actual:',
      ...consultationLines,
      '',
      'Me podria apoyar, por favor?',
    ].join('\n');

    const message = encodeURIComponent(
      messageBody,
    );

    return {
      advisor,
      waLink: `https://wa.me/${env.countryCode}${advisor.phone_number}?text=${message}`,
    };
  });
}

export { assignAdvisor };
