import {
  getBlockHash,
  getMerkleRoot,
  getBits,
  getNonce,
  getBlockchainDifficulty,
  getTransactionHash,
  getTransactionMessage,
  isValidBlockHeader
} from '../src/blockchain/block';
import { blockchain } from './index';

export function blockTest() {
  console.log(getBlockHash(blockchain[0]));
  console.log(getBlockchainDifficulty(blockchain));
  console.log(getTransactionHash(blockchain[1].transactions[0]));
  console.log(getBits(blockchain[0].id, blockchain[0].timestamp));
  console.log(getBits(blockchain[1].id, blockchain[1].timestamp));
  //console.log(getTransactionMessage(genesisBlock.transactions[0], ));
  return (
    getMerkleRoot(blockchain[0].transactions) === blockchain[0].merkleRoot &&
    getMerkleRoot(blockchain[1].transactions) === blockchain[1].merkleRoot &&
    getNonce(blockchain[0]) === blockchain[0].nonce &&
    getNonce(blockchain[1]) === blockchain[1].nonce &&
    isValidBlockHeader(blockchain[1], blockchain[0])
  );
}

export default blockTest;
