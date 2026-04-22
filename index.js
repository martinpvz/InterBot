import { app } from './src/app.js';
import { env } from './src/config/env.js';
import { logger } from './src/lib/logger.js';

app.listen(env.port, () => {
  logger.info(`Bot InterProteccion corriendo en puerto ${env.port}`);
});
