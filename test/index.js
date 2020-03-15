import CryptoJS from 'crypto-js';
import blockTest from './blockTest';
import transactionTest from './transactionTest';
import blockchain, {
  generateBlock,
  createTransaction,
  extractValidTransactions,
  addTransactionToPool,
  isValidBlockchain,
  isValidTransaction,
  isUTXO,
  getUTXO,
  getBalance,
  isValidTransactionPool
} from '../src/blockchain/blockchain';
import wallet, { recipientWallet } from '../src/blockchain/wallet';
import resolver, { txPool } from '../src/graphql/resolvers';

const genesisBlock = {
  id: 0,
  version: 1,
  merkleRoot:
    'e44352cf8a9437b7b0d0b9e3af4c557db1765158708f8bb65d6d5309e4049300',
  previousBlockHash:
    '0000000000000000000000000000000000000000000000000000000000000000',
  timestamp: 1583842481997,
  bits: 10,
  nonce: 360,
  transactions: [
    {
      version: 1,
      timestamp: 1583842481997,
      inputs: [
        {
          previousTransactionHash:
            '0000000000000000000000000000000000000000000000000000000000000000',
          outputIndex: -1,
          signature: [0, 0],
          senderPublicKey:
            '0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'
        }
      ],
      outputs: [
        {
          recipientPublicKeyHash:
            '27086715199eed734b1bb43951e25ea337d71635fc312684f31e5126764d78f6',
          value: 50
        }
      ],
      memo: "Genesis Block's Coinbase Transaction"
    }
  ]
};

const firstBlock = {
  id: 1,
  version: 1,
  merkleRoot:
    '1ea0b61ea58053d83aac33396a879be94a8c60f5410f591cbb4294ecc9b089b0',
  previousBlockHash:
    '003ef22526c03cf7567cfe6586a8cc9e348144ffaf4107e0184eb4abdf2c2065',
  timestamp: 1583842481997,
  bits: 10,
  nonce: 1016,

  transactions: [
    {
      version: 1,
      timestamp: 1583842481997,
      inputs: [
        {
          previousTransactionHash:
            '0000000000000000000000000000000000000000000000000000000000000000',
          outputIndex: -1,
          signature: [1, 0],
          senderPublicKey:
            '0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'
        }
      ],
      outputs: [
        {
          recipientPublicKeyHash:
            '27086715199eed734b1bb43951e25ea337d71635fc312684f31e5126764d78f6',
          value: 51
        }
      ],
      memo: 'Coinbase Transaction'
    },
    {
      version: 1,
      timestamp: 1583842481997,
      inputs: [
        {
          previousTransactionHash:
            '6db085cbc288a063b2dabe012137403fe9fa4d2df1b520bcf83c1b7fc63d5141',
          outputIndex: 0,
          signature: [
            48,
            70,
            2,
            33,
            0,
            130,
            109,
            208,
            210,
            38,
            106,
            171,
            216,
            169,
            69,
            166,
            210,
            14,
            246,
            108,
            186,
            182,
            34,
            53,
            100,
            70,
            168,
            207,
            111,
            37,
            205,
            105,
            76,
            200,
            198,
            19,
            39,
            2,
            33,
            0,
            178,
            133,
            97,
            179,
            167,
            153,
            79,
            14,
            85,
            236,
            59,
            254,
            221,
            132,
            141,
            122,
            138,
            231,
            143,
            151,
            60,
            168,
            68,
            2,
            201,
            22,
            206,
            152,
            28,
            37,
            252,
            204
          ],
          senderPublicKey:
            '04815406f70938fafa894c83c5af37198748a7aa54394be161cef6dd9a82a3473a5b6f7a2738a90a70e9ee4a734bd819148ae3a77a5bbd0d85710c231b63218c3f'
        }
      ],
      outputs: [
        {
          recipientPublicKeyHash:
            'da95a8eb9f916dd7e2b2014785c31c19c2a0cccd6ee08d51f98ed5c140fbda27',
          value: 10
        },
        {
          recipientPublicKeyHash:
            '27086715199eed734b1bb43951e25ea337d71635fc312684f31e5126764d78f6',
          value: 39
        }
      ],
      memo: 'Normal Transaction'
    }
  ]
};

export const blockchain_ = [genesisBlock, firstBlock];

function pureFunctionTest() {
  return (
    blockTest() &&
    blockTest() &&
    blockTest() &&
    blockTest() &&
    transactionTest() &&
    transactionTest() &&
    transactionTest() &&
    transactionTest()
  );
}

function blockchainTest() {
  if (!resolver.Query.blockchain()) return false;

  const tx = resolver.Mutation.createTransaction(null, {
    recipientPublicKeyHash: [
      recipientWallet.publicKeyHash,
      recipientWallet.publicKeyHash
    ],
    value: [10, 20],
    fee: [1, 2],
    memo: 'First transaction'
  });
  if (!tx) return false;
  if (!resolver.Mutation.generateBlock()) return false;

  if (!resolver.Query.blockchain()) return false;
  if (resolver.Query.myBalance() !== 70) return false;
  if (
    resolver.Query.balance(null, {
      publicKeyHash: recipientWallet.publicKeyHash
    }) !== 30
  )
    return false;

  const tx2 = resolver.Mutation.createTransaction('', {
    recipientPublicKeyHash: recipientWallet.publicKeyHash,
    value: 10,
    fee: 1,
    memo: 'Second transaction'
  });
  if (!tx2) return false;

  const tx3 = createTransaction(
    recipientWallet.privateKey,
    wallet.publicKeyHash,
    5,
    5,
    'Third transaction'
  );
  if (!addTransactionToPool(tx3, txPool)) return false;

  const tx4 = createTransaction(
    recipientWallet.privateKey,
    wallet.publicKeyHash,
    40,
    5,
    'Fourth transaction'
  );
  if (tx4) return false; // 잔액 부족 테스트

  if (addTransactionToPool(tx, txPool)) return false; // STXO를 참조하는 tx가 txPool에 포함되는지 테스트
  if (addTransactionToPool(tx3, txPool)) return false; // UTXO를 참조하지만 이중 지불인 tx가 txPool에 포함되는지 테스트
  if (!resolver.Query.transactionPool()) return false;
  generateBlock(
    extractValidTransactions(txPool),
    recipientWallet.publicKeyHash
  );

  if (!resolver.Query.blockchain()) return false;
  if (resolver.Query.myBalance() !== 64) return false;
  if (
    resolver.Query.balance(null, {
      publicKeyHash: recipientWallet.publicKeyHash
    }) !== 86
  )
    return false;
  return true;
}

console.log('pureFunctionTest():');
console.log(pureFunctionTest());
console.log('blockchainTest():');
console.log(blockchainTest());
