// Pure Name Formatter & Direct QR Payload Parser (Zero mock/fake fallbacks)

/**
 * Format Cadet Heading: CDT [LAST NAME] (e.g. CDT AUREA, CDT SANTOS, CDT ABAMO)
 * Strictly extracts the real name from the scanned data or falls back to CDT [ID].
 */
export function formatCadetHeading(scan) {
  if (!scan) return 'CDT CADET';

  const rawName = scan.name;

  // 1. If scan object has a real name
  if (rawName && rawName !== 'UNREGISTERED CADET' && rawName.trim().length > 0) {
    const trimmed = rawName.trim();

    // Comma format: "AUREA, REYMARK" -> "AUREA"
    if (trimmed.includes(',')) {
      const lastName = trimmed.split(',')[0].trim().toUpperCase();
      if (lastName) return `CDT ${lastName}`;
    }

    // Space format: "REYMARK AUREA" -> "AUREA"
    const parts = trimmed.split(/\s+/);
    if (parts.length > 0) {
      const lastName = parts.length > 1 ? parts[parts.length - 1].toUpperCase() : parts[0].toUpperCase();
      if (lastName) return `CDT ${lastName}`;
    }
  }

  // 2. Pure Fallback without mock names: "CDT 221-00003"
  const cleanId = (scan.cadetId || '').trim();
  return cleanId ? `CDT ${cleanId}` : 'CDT CADET';
}
