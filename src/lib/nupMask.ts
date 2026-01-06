// NUP (Número Único de Protocolo) mask: 62000.001753/2025-56
export function formatNUP(value: string): string {
  // Remove all non-numeric characters
  const numbers = value.replace(/\D/g, '');
  
  // Apply mask: XXXXX.XXXXXX/XXXX-XX
  let formatted = '';
  
  for (let i = 0; i < numbers.length && i < 17; i++) {
    if (i === 5) formatted += '.';
    if (i === 11) formatted += '/';
    if (i === 15) formatted += '-';
    formatted += numbers[i];
  }
  
  return formatted;
}

export function unformatNUP(value: string): string {
  return value.replace(/\D/g, '');
}

export function isValidNUP(value: string): boolean {
  const numbers = value.replace(/\D/g, '');
  return numbers.length === 17;
}
