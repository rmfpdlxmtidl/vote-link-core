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
import { blockchain_ } from './index';

export function blockTest() {
  console.log(getBlockchainDifficulty(blockchain_));
  //console.log(getTransactionMessage(genesisBlock.transactions[0], ));
  return (
    getBlockHash(blockchain_[0]) === blockchain_[1].previousBlockHash &&
    getMerkleRoot(blockchain_[0].transactions) === blockchain_[0].merkleRoot &&
    getMerkleRoot(blockchain_[1].transactions) === blockchain_[1].merkleRoot &&
    getBits(blockchain_[0].id, blockchain_[0].timestamp) === blockchain_[0].bits &&
    getBits(blockchain_[1].id, blockchain_[1].timestamp) === blockchain_[1].bits &&
    getNonce(blockchain_[0]) === blockchain_[0].nonce &&
    getNonce(blockchain_[1]) === blockchain_[1].nonce &&
    getTransactionHash(blockchain_[0].transactions[0]) ===
      blockchain_[0].merkleRoot &&
    isValidBlockHeader(blockchain_[1], blockchain_[0])
  );
}

export default blockTest;
