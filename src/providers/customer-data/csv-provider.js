import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const insuredCsvPath = path.resolve(__dirname, '../../../data/asegurados.csv');
const policyWorkbookXlsxPath = path.resolve(__dirname, '../../../data/base_polizas_cobertura.xlsx');
const policyWorkbookCsvPath = path.resolve(__dirname, '../../../data/base_polizas_cobertura.csv');

let records = [];
let recordsByPolicyNumber = new Map();
let recordsByNormalizedName = new Map();
let policyCoveragesBySubGroup = new Map();
let policyBenefitsBySubGroup = new Map();

async function initializeCustomerCatalog() {
  const insuredContent = await loadInsuredCsvContent();

  if (!insuredContent) {
    records = [];
    recordsByPolicyNumber = new Map();
    recordsByNormalizedName = new Map();
    return;
  }

  loadCustomerRecordsFromContent(insuredContent);

  const policyWorkbookData = await loadPolicyWorkbookData();

  if (policyWorkbookData.summaryContent) {
    loadPolicySummariesFromContent(policyWorkbookData.summaryContent);
  }

  if (policyWorkbookData.benefitsContent) {
    loadPolicyBenefitsFromContent(policyWorkbookData.benefitsContent);
  }

  if (policyWorkbookData.summaryContent || policyWorkbookData.benefitsContent) {
    enrichCustomerRecordsWithPolicyData();
  }
}

async function loadInsuredCsvContent() {
  if (shouldLoadFromSupabaseStorage()) {
    const remoteContent = await loadTextFileFromSupabaseStorage(env.customerCsvPath, 'CSV de asegurados');

    if (remoteContent) {
      return remoteContent;
    }
  }

  if (!fs.existsSync(insuredCsvPath)) {
    logger.warn('No se encontro el CSV de asegurados ni en Storage ni en disco local', { insuredCsvPath });
    return null;
  }

  return fs.readFileSync(insuredCsvPath, 'utf8');
}

async function loadPolicyWorkbookData() {
  if (shouldLoadFromSupabaseStorage()) {
    const workbookBuffer = await loadBinaryFileFromSupabaseStorage(
      env.policyCoverageCsvPath,
      'archivo de polizas/coberturas',
    );

    if (workbookBuffer) {
      return parsePolicyWorkbookBuffer(workbookBuffer, env.policyCoverageCsvPath);
    }
  }

  const localPath = resolveExistingLocalPolicyWorkbookPath();

  if (!localPath) {
    logger.info('No se encontro archivo local de polizas/coberturas; se continua sin enriquecimiento', {
      policyWorkbookXlsxPath,
      policyWorkbookCsvPath,
    });
    return { summaryContent: null, benefitsContent: null };
  }

  if (isXlsxPath(localPath)) {
    return parsePolicyWorkbookBuffer(fs.readFileSync(localPath), localPath);
  }

  const csvContent = fs.readFileSync(localPath, 'utf8');
  return { summaryContent: csvContent, benefitsContent: null };
}

function parsePolicyWorkbookBuffer(buffer, sourceLabel) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });

  const summarySheetName = findWorkbookSheetName(workbook, [
    'Base normalizada de pólizas',
    'Base normalizada de polizas',
    'Base_Polizas',
    'Base polizas',
  ]);
  const benefitsSheetName = findWorkbookSheetName(workbook, [
    'Base_Coberturas',
    'Base coberturas',
    'Coberturas',
  ]);

  const summaryContent = summarySheetName
    ? sheetToCsv(workbook, summarySheetName)
    : null;
  const benefitsContent = benefitsSheetName
    ? sheetToCsv(workbook, benefitsSheetName)
    : null;

  logger.info('Workbook de polizas/coberturas procesado', {
    source: sourceLabel,
    summarySheetName,
    benefitsSheetName,
  });

  return { summaryContent, benefitsContent };
}

function findWorkbookSheetName(workbook, candidates) {
  const normalizedCandidates = candidates.map(normalizeSheetName);

  return workbook.SheetNames.find((sheetName) => normalizedCandidates.includes(normalizeSheetName(sheetName))) ?? null;
}

function normalizeSheetName(value) {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function sheetToCsv(workbook, sheetName) {
  return XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName], { blankrows: false });
}

function loadCustomerRecordsFromContent(content) {
  const lines = toNonEmptyLines(content);

  if (lines.length <= 1) {
    logger.warn('El CSV de asegurados esta vacio', { insuredCsvPath });
    return;
  }

  const headers = parseCsvLine(lines[0]);

  records = lines
    .slice(1)
    .map((line) => buildInsuredRecord(headers, parseCsvLine(line)))
    .filter(Boolean);

  rebuildInsuredIndexes();

  logger.info('Catalogo de asegurados cargado', {
    source: shouldLoadFromSupabaseStorage() ? 'supabase-storage-or-local-fallback' : 'local-file',
    totalRecords: records.length,
  });
}

function loadPolicySummariesFromContent(content) {
  const lines = toNonEmptyLines(content);

  if (lines.length <= 1) {
    logger.warn('La hoja/base de polizas esta vacia');
    return;
  }

  const headerLineIndex = findHeaderLineIndex(lines, 'Poliza_ID');

  if (headerLineIndex === -1) {
    logger.warn('No se encontro encabezado Poliza_ID en la base de polizas');
    return;
  }

  const headers = parseCsvLine(lines[headerLineIndex]);
  policyCoveragesBySubGroup = new Map();

  lines
    .slice(headerLineIndex + 1)
    .map((line) => buildPolicySummary(headers, parseCsvLine(line)))
    .filter(Boolean)
    .forEach((summary) => {
      policyCoveragesBySubGroup.set(normalizePolicyKey(summary.subGroup), summary);
    });

  logger.info('Catalogo de polizas cargado', {
    totalRecords: policyCoveragesBySubGroup.size,
  });
}

function loadPolicyBenefitsFromContent(content) {
  const lines = toNonEmptyLines(content);

  if (lines.length <= 1) {
    logger.warn('La hoja/base de coberturas esta vacia');
    return;
  }

  const headerLineIndex = findHeaderLineIndex(lines, 'Poliza_ID');

  if (headerLineIndex === -1) {
    logger.warn('No se encontro encabezado Poliza_ID en la base de coberturas');
    return;
  }

  const headers = parseCsvLine(lines[headerLineIndex]);
  policyBenefitsBySubGroup = new Map();

  lines
    .slice(headerLineIndex + 1)
    .map((line) => buildPolicyBenefit(headers, parseCsvLine(line)))
    .filter(Boolean)
    .forEach((benefit) => {
      const key = normalizePolicyKey(benefit.subGroup);
      const existing = policyBenefitsBySubGroup.get(key) ?? [];
      existing.push(benefit);
      policyBenefitsBySubGroup.set(key, existing);
    });

  logger.info('Catalogo de coberturas cargado', {
    totalSubGroups: policyBenefitsBySubGroup.size,
  });
}

function enrichCustomerRecordsWithPolicyData() {
  records = records.map((record) => {
    const policyParts = splitPolicyParts(record.policyNumber);
    const policyCoverage = findPolicySummaryByPolicyParts(policyParts);
    const policyBenefits = findPolicyBenefitsByPolicyParts(policyParts);

    return {
      ...record,
      policyCoverage,
      policyBenefits,
    };
  });

  rebuildInsuredIndexes();
}

function rebuildInsuredIndexes() {
  recordsByPolicyNumber = new Map();
  recordsByNormalizedName = new Map();

  for (const record of records) {
    indexRecord(recordsByPolicyNumber, normalizePolicyNumber(record.policyNumber), record);
    indexRecord(recordsByNormalizedName, normalizeName(record.fullName), record);
  }
}

function findPolicySummaryByPolicyParts(policyParts) {
  for (const policyPart of policyParts) {
    const summary = policyCoveragesBySubGroup.get(normalizePolicyKey(policyPart));

    if (summary) {
      return summary;
    }
  }

  return null;
}

function findPolicyBenefitsByPolicyParts(policyParts) {
  for (const policyPart of policyParts) {
    const benefits = policyBenefitsBySubGroup.get(normalizePolicyKey(policyPart));

    if (benefits?.length) {
      return benefits;
    }
  }

  return [];
}

async function loadTextFileFromSupabaseStorage(filePath, label) {
  const { data, error } = await getStorageClient()
    .from(env.customerCsvBucket)
    .download(filePath);

  if (error) {
    logger.warn(`No se pudo descargar ${label} desde Supabase Storage`, {
      bucket: env.customerCsvBucket,
      path: filePath,
      error: error.message,
    });
    return null;
  }

  logger.info(`${capitalizeLabel(label)} descargado desde Supabase Storage`, {
    bucket: env.customerCsvBucket,
    path: filePath,
  });

  return await data.text();
}

async function loadBinaryFileFromSupabaseStorage(filePath, label) {
  const { data, error } = await getStorageClient()
    .from(env.customerCsvBucket)
    .download(filePath);

  if (error) {
    logger.warn(`No se pudo descargar ${label} desde Supabase Storage`, {
      bucket: env.customerCsvBucket,
      path: filePath,
      error: error.message,
    });
    return null;
  }

  logger.info(`${capitalizeLabel(label)} descargado desde Supabase Storage`, {
    bucket: env.customerCsvBucket,
    path: filePath,
  });

  return Buffer.from(await data.arrayBuffer());
}

function getStorageClient() {
  const supabase = createClient(env.supabaseUrl, env.supabaseStorageServiceKey, {
    auth: { persistSession: false },
  });

  return supabase.storage;
}

function capitalizeLabel(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function resolveExistingLocalPolicyWorkbookPath() {
  if (fs.existsSync(policyWorkbookXlsxPath)) {
    return policyWorkbookXlsxPath;
  }

  if (fs.existsSync(policyWorkbookCsvPath)) {
    return policyWorkbookCsvPath;
  }

  return null;
}

function isXlsxPath(filePath) {
  return /\.xlsx$/i.test(filePath);
}

function toNonEmptyLines(content) {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function findHeaderLineIndex(lines, expectedHeader) {
  return lines.findIndex((line) => parseCsvLine(line).includes(expectedHeader));
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

function buildInsuredRecord(headers, values) {
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
    policyCoverage: null,
    policyBenefits: [],
  };
}

function buildPolicySummary(headers, values) {
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

function buildPolicyBenefit(headers, values) {
  if (headers.length !== values.length) {
    return null;
  }

  const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));

  if (!row.SubGrupo || !row.Cobertura) {
    return null;
  }

  return {
    policyId: row.Poliza_ID,
    profile: row.Perfil,
    branchNumber: row.No_Filial,
    subGroup: row.SubGrupo,
    plan: row.Plan,
    coverage: row.Cobertura,
    status: row.Estatus,
    value: row.Valor,
    unit: row.Unidad,
    observations: row.Observaciones,
    valueNumeric: row.Valor_Numerico,
    isCoverage: row.Es_Cobertura,
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

function splitPolicyParts(policyNumber) {
  return String(policyNumber ?? '')
    .split('|')
    .map(normalizePolicyKey)
    .filter(Boolean);
}

function normalizePolicyKey(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, '');
}

function normalizePolicyNumber(value) {
  return normalizePolicyKey(value);
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
