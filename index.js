import { app } from './src/app.js';
import { env } from './src/config/env.js';
import { logger } from './src/lib/logger.js';
import { initializeCustomerCatalog } from './src/providers/customer-data/csv-provider.js';

initializeCustomerCatalog()
  .then(() => {
    app.listen(env.port, () => {
      logger.info(`Bot InterProteccion corriendo en puerto ${env.port}`);
    });
  })
  .catch((error) => {
    logger.error('No fue posible inicializar el catalogo de asegurados', {
      message: error.message,
      stack: error.stack,
    });
    process.exit(1);
  });
