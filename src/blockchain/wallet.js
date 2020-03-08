import { ec } from '../utils';

export const wallet = {
  privateKey: ec.genKeyPair()
};

function initWallet() {
  publicKey: privateKey.getPublic().encode('hex');
}

export default wallet;
