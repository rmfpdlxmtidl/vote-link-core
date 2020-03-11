import {
  getCoinbaseTransaction,
  getCoinbaseBasicValue,
  isValidTransactionStructure,
  isCoinbaseTransaction
} from '../src/blockchain/transaction';
import { blockchain } from './index';

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
    getCoinbaseBasicValue(blockchain[0].id) ===
      blockchain[0].transactions[0].outputs[0].value &&
    getCoinbaseBasicValue(blockchain[1].id) + 1 ===
      blockchain[1].transactions[0].outputs[0].value &&
    JSON.stringify(coinbaseTransaction) ===
      JSON.stringify(blockchain[0].transactions[0]) &&
    JSON.stringify(coinbaseTransaction2) ===
      JSON.stringify(blockchain[1].transactions[0]) &&
    isValidTransactionStructure(blockchain[0].transactions[0]) &&
    isValidTransactionStructure(blockchain[1].transactions[0]) &&
    isValidTransactionStructure(blockchain[1].transactions[1]) &&
    isCoinbaseTransaction(blockchain[0].transactions[0]) &&
    isCoinbaseTransaction(blockchain[1].transactions[0])
  );
}

export default transactionTest;
