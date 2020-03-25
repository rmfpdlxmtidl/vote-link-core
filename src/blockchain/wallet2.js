import CryptoJS from 'crypto-js';
import { ec } from '../utils';

const privateKey =
  'a2fe6f13a9828bc30455a16ed2d561904e27c1e98cd765bff0554cbf43d78eef';
//const privateKey = ec
//  .genKeyPair()
//  .getPrivate()
//  .toString(16);
const publicKey = getPublicKey(privateKey);
const publicKeyHash = getDoubleHash(publicKey);

export const wallet = {
  privateKey,
  publicKey,
  publicKeyHash
};

const privateKey2 =
  'a5923471ef3a9ab2d4ed321972345d8afe541521405b911319081f5a5db3fb87';
//const privateKey2 = ec
//  .genKeyPair()
//  .getPrivate()
//  .toString(16);
const publicKey2 = getPublicKey(privateKey2);
const publicKeyHash2 = getDoubleHash(publicKey2);

export const recipientWallet = {
  privateKey: privateKey2,
  publicKey: publicKey2,
  publicKeyHash: publicKeyHash2
};

export function getPublicKey(privateKey) {
  return ec
    .keyFromPrivate(privateKey, 'hex')
    .getPublic()
    .encode('hex');
}

export function getAddress(publicKey) {
  // 해싱
  // 인코딩
}

export default wallet;
