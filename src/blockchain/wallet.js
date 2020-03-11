import CryptoJS from 'crypto-js';
import { ec } from '../utils';

const privateKey = ec
  .genKeyPair()
  .getPrivate()
  .toString(16);
const publicKey = getPublicKey(privateKey);
const publicKeyHash = CryptoJS.SHA256(publicKey).toString();

export const wallet = {
  privateKey,
  publicKey,
  publicKeyHash
};

const privateKey2 = ec
  .genKeyPair()
  .getPrivate()
  .toString(16);
const publicKey2 = getPublicKey(privateKey2)
const publicKeyHash2 = CryptoJS.SHA256(publicKey2).toString();

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

export default wallet;
