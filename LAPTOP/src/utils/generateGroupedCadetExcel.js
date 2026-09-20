/**
 * ============================================================================
 * ROTC BULK UPLOAD TEMPLATE & CADET ROSTER EXCEL EXPORTER
 * generateGroupedCadetExcel.js
 * 
 * Generates an Excel workbook with:
 * - Dynamic Letterhead fetched from Supabase system_settings
 *   (motto_text, heading_title, unit_name, unit_address, base64 seal images)
 * - Dynamic Unit Structure query (active Battalions, Companies, Platoons only)
 * - Centered Echelon Section Banners merged across Columns A through I (9 cols)
 *   - BATTALION ECHELON: ... (Fill #006633, Bold White Text, Centered)
 *   - ... COMPANY (Strength: ...) (Fill #006633, Bold White Text, Centered)
 *   - ... PLATOON (Strength: ...) (Fill #008040, Bold White Text, Centered)
 * - Pre-filled Registered Cadets: Queries existing registered cadets from Supabase
 *   and populates them under their assigned Platoon first, then fills any
 *   remaining slots up to 37 with numbered blank rows.
 * - Strictly 9 Columns (#, Cadet ID, Last Name, First Name, Middle Initial,
 *   Contact Number, Gender, Department, Academic Program)
 * ============================================================================
 */

import {
  exportCadetRosterToExcel,
  downloadDynamicCadetTemplate,
  fetchActiveLetterhead,
  fetchActiveUnitStructure,
  generateSampleCadetsForStructure,
  DEFAULT_LETTERHEAD
} from './excelExport';

/**
 * Main export function aliasing exportCadetRosterToExcel
 */
export const generateGroupedCadetExcel = exportCadetRosterToExcel;

/**
 * Dynamic template export pre-filling registered cadets and padding up to 37 rows
 */
export const generateGroupedCadetTemplate = downloadDynamicCadetTemplate;

export {
  exportCadetRosterToExcel,
  downloadDynamicCadetTemplate,
  fetchActiveLetterhead,
  fetchActiveUnitStructure,
  generateSampleCadetsForStructure,
  DEFAULT_LETTERHEAD
};

export default generateGroupedCadetExcel;
