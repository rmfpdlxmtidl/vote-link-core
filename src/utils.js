import CryptoJS from 'crypto-js';
import ecdsa from 'elliptic';

export const ec = new ecdsa.ec('secp256k1');
export const hashRegExp = /[0-9A-Fa-f]{64}/;
export const publicPointRegExp = /[0-9A-Fa-f]{130}/;
export const urlRegExp = /\b((http|https):\/\/?)[^\s()<>]+(?:\([\w\d]+\)|([^[:punct:]\s]|\/?))/;

export function getDoubleHash(str) {
  return CryptoJS.SHA256(CryptoJS.SHA256(str).toString()).toString();
}

export function hexToBinary(s) {
  const result = [];
  const lookupTable = {
    '0': '0000',
    '1': '0001',
    '2': '0010',
    '3': '0011',
    '4': '0100',
    '5': '0101',
    '6': '0110',
    '7': '0111',
    '8': '1000',
    '9': '1001',
    a: '1010',
    b: '1011',
    c: '1100',
    d: '1101',
    e: '1110',
    f: '1111'
  };
  const stringLength = s.length;
  for (let i = 0; i < stringLength; i++) {
    if (lookupTable[s[i]]) {
      result[i] = lookupTable[s[i]];
    } else {
      return null;
    }
  }
  return result.join('');
}

export function getStringSize(s, b, i, c) {
  for (b = i = 0; (c = s.charCodeAt(i++)); b += c >> 11 ? 3 : c >> 7 ? 2 : 1);
  return b;
}
