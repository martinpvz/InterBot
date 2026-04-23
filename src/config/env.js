import dotenv from 'dotenv';

dotenv.config();

function required(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function optional(name, fallback = '') {
  return process.env[name] ?? fallback;
}

const env = {
  accessToken: required('ACCESS_TOKEN'),
  phoneNumberId: required('PHONE_NUMBER_ID'),
  verifyToken: required('VERIFY_TOKEN'),
  databaseUrl: required('DATABASE_URL'),
  metaAppSecret: optional('META_APP_SECRET'),
  companyName: optional('COMPANY_NAME', 'InterProteccion'),
  countryCode: optional('COUNTRY_CODE', '52'),
  timezone: optional('TIMEZONE', 'America/Mexico_City'),
  port: Number(optional('PORT', '3000')),
  nodeEnv: optional('NODE_ENV', 'development'),
  databaseSslMode: optional('DATABASE_SSL_MODE', 'require'),
  supabaseUrl: optional('SUPABASE_URL'),
  supabaseStorageServiceKey: optional('SUPABASE_STORAGE_SERVICE_KEY'),
  customerCsvBucket: optional('CUSTOMER_CSV_BUCKET'),
  customerCsvPath: optional('CUSTOMER_CSV_PATH', 'asegurados.csv'),
};

if (Number.isNaN(env.port)) {
  throw new Error('PORT must be a valid number');
}

export { env };
