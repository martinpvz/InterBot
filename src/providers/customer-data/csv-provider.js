import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const csvPath = path.resolve(__dirname, '../../../data/asegurados.csv');
const policyCoverageXlsxPath = path.resolve(__dirname, '../../../data/base_polizas_cobertura.xlsx');
const policyCoverageCsvPath = path.resolve(__dirname, '../../../data/base_polizas_cobertura.csv');

let records = [];
let recordsByPolicyNumber = new Map();
let recordsByNormalizedName = new Map();
let policyCoverages = [];
let policyCoveragesBySubGroup = new Map();

async function initializeCustomerCatalog() {
  const content = await loadCsvContent();

  if (!content) {
    records = [];
    recordsByPolicyNumber = new Map();
    recordsByNormalizedName = new Map();
    return;
  }

  loadCustomerRecordsFromContent(content);
  const policyCoverageContent = await loadPolicyCoverageCsvContent();

  if (policyCoverageContent) {
    loadPolicyCoveragesFromContent(policyCoverageContent);
    enrichCustomerRecordsWithPolicyCoverage();
  }
}

async function loadCsvContent() {
  if (shouldLoadFromSupabaseStorage()) {
    const remoteContent = await loadCsvFromSupabaseStorage(env.customerCsvPath);

    if (remoteContent) {
      return remoteContent;
    }
  }

  if (!fs.existsSync(csvPath)) {
    logger.warn('No se encontro el CSV de asegurados ni en Storage ni en disco local', { csvPath });
    return null;
  }

  return fs.readFileSync(csvPath, 'utf8');
}

async function loadPolicyCoverageCsvContent() {
  if (shouldLoadFromSupabaseStorage()) {
    const remoteContent = await loadSpreadsheetFromSupabaseStorage(env.policyCoverageCsvPath);

    if (remoteContent) {
      return remoteContent;
    }
  }

  const localPath = resolveExistingLocalPolicyCoveragePath();

  if (!localPath) {
    logger.info('No se encontro CSV de coberturas de poliza; se continua sin enriquecimiento', {
      policyCoverageXlsxPath,
      policyCoverageCsvPath,
    });
    return null;
  }

  return readSpreadsheetFromLocalFile(localPath);
}

function loadCustomerRecordsFromContent(content) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length <= 1) {
    logger.warn('El CSV de asegurados esta vacio', { csvPath });
    return;
  }

  const headers = parseCsvLine(lines[0]);

  records = lines
    .slice(1)
    .map((line) => buildRecord(headers, parseCsvLine(line)))
    .filter(Boolean);

  recordsByPolicyNumber = new Map();
  recordsByNormalizedName = new Map();

  for (const record of records) {
    indexRecord(recordsByPolicyNumber, normalizePolicyNumber(record.policyNumber), record);
    indexRecord(recordsByNormalizedName, normalizeName(record.fullName), record);
  }

  logger.info('Catalogo de asegurados cargado', {
    source: shouldLoadFromSupabaseStorage() ? 'supabase-storage-or-local-fallback' : 'local-file',
    totalRecords: records.length,
  });
}

function loadPolicyCoveragesFromContent(content) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length <= 1) {
    logger.warn('El archivo de coberturas esta vacio', { policyCoverageXlsxPath, policyCoverageCsvPath });
    return;
  }

  const headerLineIndex = findHeaderLineIndex(lines, 'Poliza_ID');

  if (headerLineIndex === -1) {
    logger.warn('No se encontro encabezado Poliza_ID en el CSV de coberturas');
    return;
  }

  const headers = parseCsvLine(lines[headerLineIndex]);

  policyCoverages = lines
    .slice(headerLineIndex + 1)
    .map((line) => buildPolicyCoverage(headers, parseCsvLine(line)))
    .filter(Boolean);

  policyCoveragesBySubGroup = new Map();

  for (const coverage of policyCoverages) {
    policyCoveragesBySubGroup.set(normalizePolicyNumber(coverage.subGroup), coverage);
  }

  logger.info('Catalogo de coberturas cargado', {
    totalRecords: policyCoverages.length,
  });
}

function findHeaderLineIndex(lines, expectedHeader) {
  return lines.findIndex((line) => parseCsvLine(line).includes(expectedHeader));
}

function buildPolicyCoverage(headers, values) {
  if (headers.length !== values.length) {
    return null;
  }

  const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));

  if (!row.SubGrupo) {
    return null;
  }

  return {
    policyId: row.Poliza_ID,
    profile: row.Perfil,
    branchNumber: row.No_Filial,
    subGroup: row.SubGrupo,
    plan: row.Plan,
    medicalCircle: row.Circulo_Medico,
    reimbursementMedicalCircle: row.Circulo_Medico_Reembolso,
  };
}

function enrichCustomerRecordsWithPolicyCoverage() {
  records = records.map((record) => ({
    ...record,
    policyCoverage: findPolicyCoverageForPolicyNumber(record.policyNumber),
  }));
}

function findPolicyCoverageForPolicyNumber(policyNumber) {
  const policyParts = String(policyNumber ?? '')
    .split('|')
    .map(normalizePolicyNumber)
    .filter(Boolean);

  for (const policyPart of policyParts) {
    const coverage = policyCoveragesBySubGroup.get(policyPart);

    if (coverage) {
      return coverage;
    }
  }

  return null;
}

async function loadCsvFromSupabaseStorage(filePath) {
  const supabase = createClient(env.supabaseUrl, env.supabaseStorageServiceKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase.storage
    .from(env.customerCsvBucket)
    .download(filePath);

  if (error) {
    logger.warn('No se pudo descargar el CSV desde Supabase Storage', {
      bucket: env.customerCsvBucket,
      path: filePath,
      error: error.message,
    });
    return null;
  }

  logger.info('CSV descargado desde Supabase Storage', {
    bucket: env.customerCsvBucket,
    path: filePath,
  });

  return await data.text();
}

async function loadSpreadsheetFromSupabaseStorage(filePath) {
  const supabase = createClient(env.supabaseUrl, env.supabaseStorageServiceKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase.storage
    .from(env.customerCsvBucket)
    .download(filePath);

  if (error) {
    logger.warn('No se pudo descargar el archivo de coberturas desde Supabase Storage', {
      bucket: env.customerCsvBucket,
      path: filePath,
      error: error.message,
    });
    return null;
  }

  logger.info('Archivo de coberturas descargado desde Supabase Storage', {
    bucket: env.customerCsvBucket,
    path: filePath,
  });

  if (isXlsxPath(filePath)) {
    const arrayBuffer = await data.arrayBuffer();
    return workbookFirstSheetToCsv(Buffer.from(arrayBuffer));
  }

  return await data.text();
}

function resolveExistingLocalPolicyCoveragePath() {
  if (fs.existsSync(policyCoverageXlsxPath)) {
    return policyCoverageXlsxPath;
  }

  if (fs.existsSync(policyCoverageCsvPath)) {
    return policyCoverageCsvPath;
  }

  return null;
}

function readSpreadsheetFromLocalFile(filePath) {
  if (isXlsxPath(filePath)) {
    return workbookFirstSheetToCsv(fs.readFileSync(filePath));
  }

  return fs.readFileSync(filePath, 'utf8');
}

function workbookFirstSheetToCsv(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    return '';
  }

  return XLSX.utils.sheet_to_csv(workbook.Sheets[firstSheetName], { blankrows: false });
}

function isXlsxPath(filePath) {
  return /\.xlsx$/i.test(filePath);
}

function shouldLoadFromSupabaseStorage() {
  return Boolean(
    env.supabaseUrl &&
    env.supabaseStorageServiceKey &&
    env.customerCsvBucket &&
    env.customerCsvPath,
  );
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += character;
  }

  values.push(current);
  return values.map((value) => value.trim());
}

function buildRecord(headers, values) {
  if (headers.length !== values.length) {
    return null;
  }

  const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));

  return {
    policyNumber: row.NumeroPoliza,
    gender: row.GeneroAsegurado,
    fullName: row.nombrecompleto,
    economicGroup: row.GrupoEconomico,
    insurer: row.dGrupoAseguradora,
    relationship: row.Parentesco_Descriptivo,
    age: row.EDAD ? Number(row.EDAD) : null,
  };
}

function indexRecord(indexMap, key, record) {
  if (!key) {
    return;
  }

  const existing = indexMap.get(key) ?? [];
  existing.push(record);
  indexMap.set(key, existing);
}

function normalizePolicyNumber(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, '');
}

function normalizeName(value) {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function findCustomersByPolicyNumber(policyNumber) {
  return recordsByPolicyNumber.get(normalizePolicyNumber(policyNumber)) ?? [];
}

function findCustomersByFullName(fullName) {
  return recordsByNormalizedName.get(normalizeName(fullName)) ?? [];
}

function getCustomerCatalogStats() {
  return {
    totalRecords: records.length,
    loaded: records.length > 0,
  };
}

function getAllCustomerRecords() {
  return records;
}

export {
  getAllCustomerRecords,
  findCustomersByFullName,
  findCustomersByPolicyNumber,
  getCustomerCatalogStats,
  initializeCustomerCatalog,
  normalizeName,
  normalizePolicyNumber,
};
