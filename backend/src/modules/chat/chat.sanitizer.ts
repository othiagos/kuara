// Sanitizer to prevent platform bypass / leakage prior to escrow confirmation
export const EMAIL_REGEX =
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

export const WHATSAPP_LINK_REGEX =
  /(?:https?:\/\/)?(?:www\.)?(?:wa\.me|api\.whatsapp\.com|t\.me|telegram\.me|instagram\.com|instagr\.am|facebook\.com|fb\.com|bit\.ly|linktr\.ee|x\.com|twitter\.com|tiktok\.com|linkedin\.com)(?:\/[^\s<>]*)?/gi;

export const EXTERNAL_URL_REGEX =
  /(?:https?:\/\/|www\.)[^\s<>]+|\b[a-zA-Z0-9-]{2,}\.(?:com\.br|org\.br|net\.br|com|net|org|io|app|dev|xyz|site|online|store|me)(?:\/[^\s<>]*)?\b/gi;

export const SOCIAL_HANDLE_REGEX =
  /(^|[\s(,;:])(@[a-zA-Z_][a-zA-Z0-9_.]{2,29})(?=$|[\s).,;:!?])/g;

export const UUID_PIX_REGEX =
  /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g;

export const FORMATTED_CNPJ_REGEX = /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g;

export const FORMATTED_CPF_REGEX = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g;

export const PHONE_REGEX =
  /(?:(?:\+|00)?55[\s.-]?)?(?:\(?\d{2}\)?[\s.-]?)?(?:9[\s.-]?\d{4}[\s.-]?\d{4}|\d{4}[\s.-]?\d{4})/g;

export const OBFUSCATED_DIGITS_REGEX =
  /(?<!\d)(?:\+?55[\s.-]?)?(?:\(\d{2}\)[\s.-]?)?(?:\d{1,5}[\s.-]+){2,12}\d{1,5}(?!\d)|\b\d{10,14}\b/g;

export const BLOCKED_NOTICE = "[CONTATO PROTEGIDO - LIBERADO APÓS CUSTÓDIA]";

function isDateLike(value: string): boolean {
  return (
    /^\d{1,2}[-.]\d{1,2}[-.]\d{2,4}$/.test(value) ||
    /^\d{4}[-.]\d{2}[-.]\d{2}$/.test(value)
  );
}

export function sanitizeMessageContent(content: string): {
  sanitized: string;
  hasBlockedContact: boolean;
} {
  let hasBlockedContact = false;

  const replaceWithNotice = () => {
    hasBlockedContact = true;
    return BLOCKED_NOTICE;
  };

  let sanitized = content.replace(EMAIL_REGEX, replaceWithNotice);
  sanitized = sanitized.replace(WHATSAPP_LINK_REGEX, replaceWithNotice);
  sanitized = sanitized.replace(EXTERNAL_URL_REGEX, replaceWithNotice);
  sanitized = sanitized.replace(SOCIAL_HANDLE_REGEX, (_full, prefix: string) => {
    hasBlockedContact = true;
    return `${prefix}${BLOCKED_NOTICE}`;
  });
  sanitized = sanitized.replace(UUID_PIX_REGEX, replaceWithNotice);
  sanitized = sanitized.replace(FORMATTED_CNPJ_REGEX, replaceWithNotice);
  sanitized = sanitized.replace(FORMATTED_CPF_REGEX, replaceWithNotice);

  const replacePhoneIfValid = (match: string) => {
    const trimmed = match.trim();
    if (isDateLike(trimmed)) {
      return match;
    }
    const digitsOnly = trimmed.replace(/\D/g, "");
    if (digitsOnly.length >= 8) {
      hasBlockedContact = true;
      return BLOCKED_NOTICE;
    }
    return match;
  };

  sanitized = sanitized.replace(PHONE_REGEX, replacePhoneIfValid);
  sanitized = sanitized.replace(OBFUSCATED_DIGITS_REGEX, replacePhoneIfValid);

  return { sanitized, hasBlockedContact };
}
