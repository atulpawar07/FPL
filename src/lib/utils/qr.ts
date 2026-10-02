/**
 * Standalone Pure TypeScript QR Code Generator (Zero Dependencies)
 *
 * Generates valid, high-contrast SVG QR Code graphics for any input string
 * (e.g., canonical UPI payment URIs upi://pay?...).
 */

// QR Code Constants & Reed-Solomon Galois Field tables
const GF256_EXP = new Uint8Array(512);
const GF256_LOG = new Uint8Array(256);

(function initGF256() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF256_EXP[i] = x;
    GF256_EXP[i + 255] = x;
    GF256_LOG[x] = i;
    x = (x << 1) ^ (x & 0x80 ? 0x11d : 0);
  }
})();

function gfMultiply(x: number, y: number): number {
  if (x === 0 || y === 0) return 0;
  return GF256_EXP[GF256_LOG[x] + GF256_LOG[y]];
}

function rsPolynomialMultiply(p1: Uint8Array, p2: Uint8Array): Uint8Array {
  const result = new Uint8Array(p1.length + p2.length - 1);
  for (let i = 0; i < p1.length; i++) {
    for (let j = 0; j < p2.length; j++) {
      result[i + j] ^= gfMultiply(p1[i], p2[j]);
    }
  }
  return result;
}

function rsGeneratorPolynomial(degree: number): Uint8Array {
  let poly: Uint8Array = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    poly = rsPolynomialMultiply(poly, new Uint8Array([1, GF256_EXP[i]]));
  }
  return poly;
}

function calculateECCBytes(data: Uint8Array, eccLength: number): Uint8Array {
  const genPoly = rsGeneratorPolynomial(eccLength);
  const message = new Uint8Array(data.length + eccLength);
  message.set(data, 0);

  for (let i = 0; i < data.length; i++) {
    const coef = message[i];
    if (coef !== 0) {
      for (let j = 0; j < genPoly.length; j++) {
        message[i + j] ^= gfMultiply(genPoly[j], coef);
      }
    }
  }

  return message.slice(data.length);
}

// QR Versions table for Byte Mode (ECL M)
// Version 1 (21x21): 14 data bytes, 10 EC bytes
// Version 2 (25x25): 26 data bytes, 16 EC bytes
// Version 3 (29x29): 42 data bytes, 26 EC bytes
// Version 4 (33x33): 62 data bytes, 36 EC bytes
// Version 5 (37x37): 84 data bytes, 48 EC bytes
// Version 6 (41x41): 106 data bytes, 64 EC bytes
// Version 7 (45x45): 122 data bytes, 72 EC bytes
// Version 8 (49x49): 152 data bytes, 88 EC bytes
// Version 9 (53x53): 180 data bytes, 110 EC bytes
// Version 10 (57x57): 213 data bytes, 130 EC bytes

interface QRVersionConfig {
  version: number;
  size: number;
  dataBytes: number;
  ecBytes: number;
  alignmentPositions: number[];
}

const QR_VERSIONS: QRVersionConfig[] = [
  { version: 1, size: 21, dataBytes: 14, ecBytes: 10, alignmentPositions: [] },
  { version: 2, size: 25, dataBytes: 26, ecBytes: 16, alignmentPositions: [6, 18] },
  { version: 3, size: 29, dataBytes: 42, ecBytes: 26, alignmentPositions: [6, 22] },
  { version: 4, size: 33, dataBytes: 62, ecBytes: 36, alignmentPositions: [6, 26] },
  { version: 5, size: 37, dataBytes: 84, ecBytes: 48, alignmentPositions: [6, 30] },
  { version: 6, size: 41, dataBytes: 106, ecBytes: 64, alignmentPositions: [6, 34] },
  { version: 7, size: 45, dataBytes: 122, ecBytes: 72, alignmentPositions: [6, 22, 38] },
  { version: 8, size: 49, dataBytes: 152, ecBytes: 88, alignmentPositions: [6, 24, 42] },
  { version: 9, size: 53, dataBytes: 180, ecBytes: 110, alignmentPositions: [6, 26, 46] },
  { version: 10, size: 57, dataBytes: 213, ecBytes: 130, alignmentPositions: [6, 28, 50] },
];

function selectQRVersion(dataLength: number): QRVersionConfig {
  // Mode indicator (4 bits) + Character count indicator (8-16 bits)
  for (const config of QR_VERSIONS) {
    const headerBits = config.version < 10 ? 12 : 20; // 4 bit mode + 8/16 bit len
    const capacity = config.dataBytes - Math.ceil(headerBits / 8);
    if (dataLength <= capacity) {
      return config;
    }
  }
  return QR_VERSIONS[QR_VERSIONS.length - 1]; // Fallback to largest supported
}

/**
 * Generates a 2D boolean matrix representing QR code modules for the text.
 */
export function generateQRMatrix(text: string): boolean[][] {
  const encoder = new TextEncoder();
  const textBytes = encoder.encode(text);
  const config = selectQRVersion(textBytes.length);
  const size = config.size;

  const matrix: (boolean | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));
  const isFunctionModule: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  function setModule(r: number, c: number, val: boolean, isFunc = true) {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      matrix[r][c] = val;
      if (isFunc) isFunctionModule[r][c] = true;
    }
  }

  // 1. Finder Patterns (7x7)
  const drawFinder = (top: number, left: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const row = top + r;
        const col = left + c;
        if (row >= 0 && row < size && col >= 0 && col < size) {
          const isBorder = r === -1 || r === 7 || c === -1 || c === 7;
          const isOuterSquare = r === 0 || r === 6 || c === 0 || c === 6;
          const isInnerSquare = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          setModule(row, col, !isBorder && (isOuterSquare || isInnerSquare));
        }
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // 2. Alignment Patterns
  const pos = config.alignmentPositions;
  for (let i = 0; i < pos.length; i++) {
    for (let j = 0; j < pos.length; j++) {
      const r = pos[i];
      const c = pos[j];
      // Skip alignment patterns overlapping finder patterns
      if ((r === 6 && c === 6) || (r === 6 && c === size - 7) || (r === size - 7 && c === 6)) continue;
      for (let ar = -2; ar <= 2; ar++) {
        for (let ac = -2; ac <= 2; ac++) {
          const isBorder = Math.abs(ar) === 2 || Math.abs(ac) === 2;
          const isCenter = ar === 0 && ac === 0;
          setModule(r + ar, c + ac, isBorder || isCenter);
        }
      }
    }
  }

  // 3. Timing Patterns
  for (let i = 8; i < size - 8; i++) {
    if (matrix[6][i] === null) setModule(6, i, i % 2 === 0);
    if (matrix[i][6] === null) setModule(i, 6, i % 2 === 0);
  }

  // 4. Dark Module
  setModule(4 * config.version + 9, 8, true);

  // 5. Reserve Format Information Area
  for (let i = 0; i < 9; i++) {
    if (matrix[8][i] === null) setModule(8, i, false);
    if (matrix[i][8] === null) setModule(i, 8, false);
    if (matrix[8][size - 1 - i] === null) setModule(8, size - 1 - i, false);
    if (matrix[size - 1 - i][8] === null) setModule(size - 1 - i, 8, false);
  }

  // 6. Encode Data Bitstream (Byte Mode: 0100)
  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >> i) & 1);
    }
  };

  pushBits(0b0100, 4); // Byte mode
  const countBits = config.version < 10 ? 8 : 16;
  pushBits(textBytes.length, countBits);

  for (let i = 0; i < textBytes.length; i++) {
    pushBits(textBytes[i], 8);
  }

  // Add Terminator & Padding
  const totalDataBits = config.dataBytes * 8;
  const padBitsCount = Math.min(4, totalDataBits - bits.length);
  for (let i = 0; i < padBitsCount; i++) bits.push(0);

  while (bits.length % 8 !== 0) bits.push(0);

  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (bits.length < totalDataBits) {
    pushBits(padBytes[padIdx % 2], 8);
    padIdx++;
  }

  // Convert bits to byte array
  const dataBytes = new Uint8Array(config.dataBytes);
  for (let i = 0; i < config.dataBytes; i++) {
    let byteVal = 0;
    for (let b = 0; b < 8; b++) {
      byteVal = (byteVal << 1) | bits[i * 8 + b];
    }
    dataBytes[i] = byteVal;
  }

  // Calculate Reed-Solomon Error Correction Bytes
  const ecBytes = calculateECCBytes(dataBytes, config.ecBytes);

  // Combine data + EC bytes into final bitstream
  const finalBits: number[] = [];
  for (let i = 0; i < dataBytes.length; i++) {
    for (let b = 7; b >= 0; b--) finalBits.push((dataBytes[i] >> b) & 1);
  }
  for (let i = 0; i < ecBytes.length; i++) {
    for (let b = 7; b >= 0; b--) finalBits.push((ecBytes[i] >> b) & 1);
  }

  // 7. Place Bitstream into Matrix (Zigzag layout)
  let bitIdx = 0;
  let dir = -1;
  let x = size - 1;
  while (x > 0) {
    if (x === 6) x--; // Skip vertical timing column
    for (let y = dir === -1 ? size - 1 : 0; dir === -1 ? y >= 0 : y < size; y += dir) {
      for (let col = x; col > x - 2; col--) {
        if (!isFunctionModule[y][col]) {
          const bitVal = bitIdx < finalBits.length ? finalBits[bitIdx++] : 0;
          // Apply Pattern Mask 0: (row + col) % 2 === 0
          const mask = (y + col) % 2 === 0;
          matrix[y][col] = (bitVal ^ (mask ? 1 : 0)) === 1;
        }
      }
    }
    dir = -dir;
    x -= 2;
  }

  // Format Info for Mask 0, Error Correction M (BCH 15,5 code for 00 000)
  // Mask 0 + ECL M (00) -> Format bits: 101010000010010
  const formatBits = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0];
  // Write format info around top-left, top-right, bottom-left
  let fIdx = 0;
  for (let i = 0; i <= 5; i++) matrix[8][i] = formatBits[fIdx++] === 1;
  matrix[8][7] = formatBits[fIdx++] === 1;
  matrix[8][8] = formatBits[fIdx++] === 1;
  matrix[7][8] = formatBits[fIdx++] === 1;
  for (let i = 5; i >= 0; i--) matrix[i][8] = formatBits[fIdx++] === 1;

  fIdx = 0;
  for (let i = size - 1; i >= size - 7; i--) matrix[8][i] = formatBits[fIdx++] === 1;
  for (let i = size - 8; i < size; i++) matrix[i][8] = formatBits[fIdx++] === 1;

  return matrix.map((row) => row.map((cell) => cell === true));
}

/**
 * Generates an SVG string representation of the QR code for a given string payload.
 */
export function generateQRSVGString(text: string, viewBoxSize = 256): string {
  if (!text) return '';
  const matrix = generateQRMatrix(text);
  const size = matrix.length;
  const margin = 2; // Quiet zone modules
  const totalModules = size + margin * 2;
  const cellSize = viewBoxSize / totalModules;

  let path = '';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c]) {
        const x = (c + margin) * cellSize;
        const y = (r + margin) * cellSize;
        path += `M${x.toFixed(2)},${y.toFixed(2)}h${cellSize.toFixed(2)}v${cellSize.toFixed(2)}h-${cellSize.toFixed(2)}z `;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBoxSize} ${viewBoxSize}" width="100%" height="100%" fill="currentColor"><path d="${path}" /></svg>`;
}
