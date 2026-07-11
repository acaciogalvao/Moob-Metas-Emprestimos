// Gerador de payload PIX estático (BR Code / EMV)

function crc16(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function field(id: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

/**
 * Detecta o tipo de chave PIX e normaliza para o formato aceito pelo Banco Central.
 */
export function normalizePixKey(raw: string): string {
  const trimmed = raw.trim();

  // 1. E-mail
  if (trimmed.includes("@")) {
    return trimmed.toLowerCase();
  }

  // 2. UUID / chave aleatória (EVP)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  // 3. Já está no formato E.164 (+55...)
  if (trimmed.startsWith("+")) {
    const digits = trimmed.replace(/\D/g, "");
    return `+${digits}`;
  }

  // 4. Telefone com formatação: contém parênteses como "(99)" ou traço com espaço
  const looksLikePhone = /^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/.test(trimmed.trim());
  if (looksLikePhone) {
    const digits = trimmed.replace(/\D/g, "");
    return `+55${digits}`;
  }

  const digitsOnly = trimmed.replace(/\D/g, "");

  // 5. CNPJ: 14 dígitos (pode ter pontos e barra)
  if (digitsOnly.length === 14) {
    return digitsOnly;
  }

  // 6. CPF: 11 dígitos COM formatação típica de CPF (pontos e traço: 000.000.000-00)
  const looksCpf = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(trimmed);
  if (looksCpf && digitsOnly.length === 11) {
    return digitsOnly;
  }

  // 7. Apenas dígitos sem formatação: 11 → CPF, 10/11 sem ponto → telefone ambíguo
  if (/^\d+$/.test(trimmed)) {
    if (trimmed.length === 11) return trimmed; // CPF ou telefone: retorna como está
    if (trimmed.length === 10) return `+55${trimmed}`; // DDD + 8 dígitos (fixo)
    return trimmed;
  }

  // 8. Fallback: retorna como está
  return trimmed;
}

export function generatePixPayload(
  pixKeyRaw: string,
  merchantName: string,
  amount?: number,
  city: string = "BRASIL"
): string {
  const pixKey = normalizePixKey(pixKeyRaw);

  const sanitize = (s: string, maxLen: number) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9 ]/g, "")
      .trim()
      .toUpperCase()
      .slice(0, maxLen);

  const name = sanitize(merchantName, 25) || "RECEBEDOR";
  const cityClean = sanitize(city, 15) || "BRASIL";

  const gui = field("00", "BR.GOV.BCB.PIX");
  const key = field("01", pixKey);
  const merchantInfo = field("26", gui + key);

  const amountStr =
    amount && amount > 0 ? field("54", amount.toFixed(2)) : "";

  let payload =
    field("00", "01") +
    "010212" +
    merchantInfo +
    field("52", "0000") +
    field("53", "986") +
    amountStr +
    field("58", "BR") +
    field("59", name) +
    field("60", cityClean) +
    field("62", field("05", "***")) +
    "6304";

  const crc = crc16(payload);
  return payload + crc;
}
