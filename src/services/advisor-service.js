import { env } from '../config/env.js';
import { runInTransaction } from '../db/run-in-transaction.js';
import {
  getActiveAdvisors,
  getAndAdvanceAdvisorCursor,
  insertHandoff,
} from '../repositories/advisor-repository.js';
import { HttpError } from '../lib/http-error.js';

async function assignAdvisor({ userId, ramaLabel, pasoLabel }) {
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

    const context = ramaLabel && pasoLabel
      ? `Tengo una consulta sobre *${ramaLabel}* especificamente en el apartado de *${pasoLabel}*.`
      : ramaLabel
        ? `Tengo una consulta sobre *${ramaLabel}*.`
        : 'Requiero orientacion con mi caso.';

    const message = encodeURIComponent(
      `Hola, me comunico desde el chatbot de ${env.companyName}. ${context} Me podria apoyar?`,
    );

    return {
      advisor,
      waLink: `https://wa.me/${env.countryCode}${advisor.phone_number}?text=${message}`,
    };
  });
}

export { assignAdvisor };
