import CryptoJS from 'crypto-js';
import { ec } from '../utils';

const privateKey = ec.genKeyPair();
const publicKey = privateKey.getPublic().encode('hex');
const publicKeyHash = CryptoJS.SHA256(publicKey).toString();

export const wallet = {
  privateKey,
  publicKey,
  publicKeyHash
};

const privateKey2 = ec.genKeyPair();
const publicKey2 = privateKey2.getPublic().encode('hex');
const publicKeyHash2 = CryptoJS.SHA256(publicKey2).toString();

export const recipientWallet = {
  privateKey: privateKey2,
  publicKey: publicKey2,
  publicKeyHash: publicKeyHash2
};

export default wallet;
