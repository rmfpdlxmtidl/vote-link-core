import {
  getCoinbaseTransaction,
  getCoinbaseBasicValue,
  getTransactionHash,
  getTransactionMessage,
  isValidTransactionStructure,
  isCoinbaseTransaction
} from '../src/blockchain/transaction';
import { blockchain_ } from './index';

export function transactionTest() {
  const coinbaseTransaction = getCoinbaseTransaction(
    '27086715199eed734b1bb43951e25ea337d71635fc312684f31e5126764d78f6',
    0,
    0,
    "Genesis Block's Coinbase Transaction"
  );
  coinbaseTransaction.timestamp = 1583842481997;

  const coinbaseTransaction2 = getCoinbaseTransaction(
    '27086715199eed734b1bb43951e25ea337d71635fc312684f31e5126764d78f6',
    1,
    1,
    'Coinbase Transaction'
  );
  coinbaseTransaction2.timestamp = 1583842481997;

  return (
    getCoinbaseBasicValue(blockchain_[0].id) ===
      blockchain_[0].transactions[0].outputs[0].value &&
    getCoinbaseBasicValue(blockchain_[1].id) + 1 ===
      blockchain_[1].transactions[0].outputs[0].value &&
    getTransactionHash(blockchain_[0].transactions[0]) ===
      blockchain_[0].merkleRoot &&
    JSON.stringify(coinbaseTransaction) ===
      JSON.stringify(blockchain_[0].transactions[0]) &&
    JSON.stringify(coinbaseTransaction2) ===
      JSON.stringify(blockchain_[1].transactions[0]) &&
    isValidTransactionStructure(blockchain_[0].transactions[0]) &&
    isValidTransactionStructure(blockchain_[1].transactions[0]) &&
    isValidTransactionStructure(blockchain_[1].transactions[1]) &&
    isCoinbaseTransaction(blockchain_[0].transactions[0]) &&
    isCoinbaseTransaction(blockchain_[1].transactions[0])
  );
}

export default transactionTest;
