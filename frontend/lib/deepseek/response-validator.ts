/** Guard rail enforcement for AI responses. */

const PROHIBITED_PATTERNS = [
  /\b(\d+)\s*(people|persons|civilians|casualties|fatalities|deaths|injured)\b/i,
  /\bconfirmed\s+(dead|killed|deaths|casualties)\b/i,
  /\bI\s+(predict|forecast|estimate)\b/i,
  /risk\s+score\s+(is|of|=)\s*\d+/i,
];

const REQUIRED_DISCLOSURE_WHEN_STALE =
  "No current verified source was retrieved";

export interface ResponseValidationResult {
  safe: boolean;
  warnings: string[];
}

/**
 * Validate an AI response for guardrail compliance.
 * Returns warnings if the response appears to invent data.
 * This is a best-effort client-side check; the primary guardrail is the system prompt.
 */
export function validateAiResponse(
  response: string,
  hasStaleSources: boolean
): ResponseValidationResult {
  const warnings: string[] = [];

  for (const pattern of PROHIBITED_PATTERNS) {
    if (pattern.test(response)) {
      warnings.push(
        `Response may contain invented statistics or predictions (matched: ${pattern.source})`
      );
    }
  }

  if (hasStaleSources && !response.includes(REQUIRED_DISCLOSURE_WHEN_STALE)) {
    warnings.push(
      "Response does not disclose that some sources are stale — user should be informed"
    );
  }

  return {
    safe: warnings.length === 0,
    warnings,
  };
}
