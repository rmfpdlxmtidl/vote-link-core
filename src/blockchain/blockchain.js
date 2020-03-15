import CryptoJS from 'crypto-js';
import {
  getBlockHash,
  getMerkleRoot,
  getBits,
  getNonce,
  getBlockchainDifficulty,
  isValidBlockHeader
} from './block';
import {
  getCoinbaseTransaction,
  getCoinbaseBasicValue,
  getTransactionHash,
  getTransactionMessage,
  getTransactionSize,
  isValidTransactionStructure,
  isCoinbaseTransaction
} from './transaction';
import wallet, { getPublicKey } from './wallet';
import { ec, hashRegExp } from '../utils';

// 블록에 포함되는 transactions 배열의 최대 바이트 크기(1MB)
const MAX_TRANSACTIONS_SIZE = 1024 * 1024;

export let blockchain = [generateGenesisBlock()];

// 제네시스 블록을 생성. 부수 효과 있음.
function generateGenesisBlock() {
  const genesisBlock = {
    id: 0,
    version: 1,
    previousBlockHash: '0'.repeat(64),
    merkleRoot: '',
    timestamp: new Date().getTime(),
    bits: 10,
    nonce: 0,
    transactions: []
  };

  genesisBlock.transactions.push(
    getCoinbaseTransaction(
      wallet.publicKeyHash,
      0,
      0,
      "Genesis Block's Coinbase Transaction"
    )
  );
  genesisBlock.merkleRoot = getMerkleRoot(genesisBlock.transactions);
  genesisBlock.nonce = getNonce(genesisBlock);
  return genesisBlock;
}

// 새로운 블록을 생성. 부수 효과 있음.
// transaction은 유효해야 한다. transactions 총 크기도 1MB 이하여야 한다.
export function generateBlock(transactions, minerPublicKeyHash) {
  if (transactions.length === 0)
    console.log('generateBlock(): There is no transaction');

  const id = blockchain.length;
  transactions.unshift(
    getCoinbaseTransaction(
      minerPublicKeyHash,
      id,
      getTotalTransactionFee(transactions),
      'Coinbase Transaction'
    )
  );

  const newBlockHeader = {
    version: 1,
    previousBlockHash: getBlockHash(blockchain[blockchain.length - 1]),
    merkleRoot: getMerkleRoot(transactions),
    timestamp: new Date().getTime(),
    bits: 0,
    nonce: 0
  };
  newBlockHeader.bits = getBits(id, newBlockHeader.timestamp);
  newBlockHeader.nonce = getNonce(newBlockHeader);

  const newBlock = {
    id,
    ...newBlockHeader,
    transactions
  };
  blockchain.push(newBlock);
  return newBlock;
}

// recipientPublicKeyHash와 value는 배열이 될 수 있다. 외부 변수 참조
export function createTransaction(
  senderPrivateKey,
  recipientPublicKeyHash,
  value,
  fee,
  memo
) {
  // 보유 금액 게산
  let value_;
  let fee_;
  if (
    typeof recipientPublicKeyHash === 'object' &&
    typeof value === 'object' &&
    typeof fee === 'object' &&
    recipientPublicKeyHash.length === value.length &&
    value.length === fee.length
  ) {
    value_ = value.reduce((acc, v) => acc + v);
    fee_ = fee.reduce((acc, f) => acc + f);
  } else if (
    hashRegExp.test(recipientPublicKeyHash) &&
    Number.isInteger(value) &&
    Number.isInteger(fee)
  ) {
    value_ = value;
    fee_ = fee;
  } else {
    console.warn(
      'createTransaction(): Invalid recipient public key hash, value or fee'
    );
    return null;
  }

  // 자신의 잔액 조회
  const senderPublicKey = getPublicKey(senderPrivateKey);
  const senderPublicKeyHash = CryptoJS.SHA256(senderPublicKey).toString();
  const UTXO = getUTXO(senderPublicKeyHash);
  if (getBalance(UTXO) < value_ + fee_) {
    console.warn('createTransaction(): Not enough balance');
    return null;
  }

  // 자신의 UTXO로부터 Input을 생성
  const inputs = [];
  let inputSum = 0;
  for (let i = UTXO.length - 1; i > -1; i--) {
    if (value_ + fee_ > inputSum) {
      inputs.push({
        previousTransactionHash: UTXO[i].transactionHash,
        outputIndex: UTXO[i].outputIndex,
        signature: [UTXO[i].recipientPublicKeyHash],
        senderPublicKey
      });
      inputSum += UTXO[i].value;
      UTXO.pop();
    } else break;
  }

  // Output 생성
  const outputs = [];
  if (
    typeof recipientPublicKeyHash === 'object' &&
    typeof value === 'object' &&
    typeof fee === 'object' &&
    recipientPublicKeyHash.length === value.length &&
    value.length === fee.length
  ) {
    for (let i = 0; i < value.length; i++)
      outputs.push({
        recipientPublicKeyHash: recipientPublicKeyHash[i],
        value: value[i]
      });
  } else {
    outputs.push({ recipientPublicKeyHash, value });
  }

  // 거스름돈 계산
  if (inputSum != value_ + fee_) {
    outputs.push({
      recipientPublicKeyHash: senderPublicKeyHash,
      value: inputSum - value_ - fee_
    });
  }

  // 서명 전 Transaction
  const transaction = {
    version: 1,
    timestamp: new Date().getTime(),
    inputs,
    outputs,
    memo
  };

  // Transaction의 모든 input에 서명한다.
  const transactionHash = getTransactionHash(transaction);
  transaction.inputs.forEach(input => {
    input.signature = ec
      .keyFromPrivate(senderPrivateKey, 'hex')
      .sign(transactionHash)
      .toDER();
  });

  return transaction;
}

// txPool에서 유효한 tx만 추출해서 반환한다. 기존 txPool을 수정한다.(부수 효과 있음.)
export function extractValidTransactions(txPool) {
  // txPool 안에 이중지불이 없다고 가정
  const transactions = [];

  let accTxSize = 0; // 누적 tx 크기
  // 반절은 '수수료/거래크기' 높은 tx부터 포함
  while (accTxSize < MAX_TRANSACTIONS_SIZE / 2 && txPool.length > 0) {
    txPool.sort((a, b) =>
      getTransactionFee(a) / getTransactionSize(a) <
      getTransactionFee(b) / getTransactionSize(b)
        ? -1
        : 1
    );
    const tx = txPool.pop();
    transactions.push(tx);
    accTxSize += getTransactionSize(tx);
  }
  // 반절은 가장 오래된 tx부터 포함
  while (accTxSize < MAX_TRANSACTIONS_SIZE && txPool.length > 0) {
    txPool.sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));
    const tx = txPool.pop();
    transactions.push(tx);
    accTxSize += getTransactionSize(tx);
  }

  return transactions;
}

// 부수 효과 있음.
export function addTransactionToPool(tx, txPool) {
  if (!tx || !isValidTransaction(tx, isUTXO)) return false;

  // 이중지불 검사
  if (
    txPool.some(tx2 =>
      tx2.inputs.some(({ previousTransactionHash, outputIndex }) => {
        if (
          tx.inputs.find(
            input =>
              input.previousTransactionHash === previousTransactionHash &&
              input.outputIndex === outputIndex
          )
        )
          return true;
      })
    )
  ) {
    console.warn('addTransactionToPool() : Double spending transaction');
    return false;
  }
  txPool.push(tx);
  return true;
}

// 부수 효과 있음.
export function replaceBlockchain(receivedBlockchain) {
  // 수신된 블록체인 유효성 검사.
  if (!isValidBlockchain(receivedBlockchain)) {
    console.warn('Received blockchain invalid');
    return false;
  }
  // 수신된 블록체인 난이도 검사
  if (
    getBlockchainDifficulty(receivedBlockchain) <=
    getBlockchainDifficulty(blockchain)
  ) {
    console.log('Received blockchain is easier than current blockchain');
    return false;
  }
  console.log('Received blockchain is valid.');
  console.log('Replacing current blockchain with received blockchain');
  blockchain = receivedBlockchain;
  return true;
}

// 블록체인이 유효한지 검증한다. 외부 변수(genesisBlock) 참조
export function isValidBlockchain(blockchain) {
  if (!blockchain.every(block => isValidBlock(block))) {
    console.warn('isValidBlockchain() : Invalid block');
    return false;
  }
  return true;
}

// 외부변수(blockchain) 참조
export function isValidBlock(block) {
  // 제네시스 블록이면 하드코딩된 제네시스 블록과 일치하는지 확인
  if (block.id === 0) {
    if (JSON.stringify(block) !== JSON.stringify(blockchain[0])) {
      console.warn('isValidBlock() : Invalid genesis block');
      return false;
    }
    return true;
  }
  // 블록 헤더가 유효한지 확인
  if (!isValidBlockHeader(block, blockchain[block.id - 1])) {
    console.warn('isValidBlock() : Invalid block header');
    return false;
  }
  // 블록의 모든 transaction이 유효한지 확인
  if (
    !block.transactions.every(transaction =>
      isValidTransaction(transaction, isSTXO, block)
    )
  ) {
    console.warn('isValidBlock() : Invalid transaction');
    return false;
  }
  return true;
}

// 일반 transaction만 검사할 수 있다. 비순수함수
// block에 담긴 tx(coinbase 포함) : isValidTransaction(tx, isSTXO, block)
// tx 단독 : isValidTransaction(tx, isUTXO)
export function isValidTransaction(transaction, isTXO, block) {
  // Transaction 데이터 구조 유효성
  if (!isValidTransactionStructure(transaction)) {
    console.warn('isValidTransaction(): Invalid transaction structure');
    return false;
  }
  // Transactoin 버전은 항상 1
  if (transaction.version !== 1) {
    console.warn('isValidTransaction(): Invalid transaction version');
    return false;
  }
  // Coinbase인지 확인
  if (isCoinbaseTransaction(transaction)) {
    if (!isValidCoinbaseTransaction(transaction, block)) {
      console.warn('isValidTransaction(): Invalid coinbase transaction');
      return false;
    } else return true;
  }

  // Transaction의 input 검사
  let inputSum = 0;
  if (
    !transaction.inputs.every(input => {
      const previousTransactionOutput = getTransactionOutput(
        input.previousTransactionHash,
        input.outputIndex
      );
      // previous transaction output이 존재하는지
      if (!previousTransactionOutput) {
        console.warn(
          'isValidTransaction(): There is no previous transaction output'
        );
        return false;
      }
      // 각 input의 senderPublicKey의 유효성
      if (
        !CryptoJS.SHA256(input.senderPublicKey).toString() ===
        previousTransactionOutput.recipientPublicKeyHash
      ) {
        console.warn(
          'isValidTransaction(): Invalid transaction input senderPublicKey'
        );
        return false;
      }
      // 각 input의 signature의 유효성
      if (
        !ec
          .keyFromPublic(input.senderPublicKey, 'hex')
          .verify(
            getTransactionMessage(
              transaction,
              previousTransactionOutput.recipientPublicKeyHash
            ),
            input.signature
          )
      ) {
        console.warn(
          'isValidTransaction(): Invalid transaction input signature'
        );
        return false;
      }
      // 각 input의 previous transaction output의 유효성
      if (!isTXO(input.previousTransactionHash, input.outputIndex)) {
        console.warn(
          'isValidTransaction(): Invalid previous transaction output reference count'
        );
        return false;
      }
      inputSum += previousTransactionOutput.value;
      return true;
    })
  ) {
    console.warn('isValidTransaction(): Invalid transaction inputs');
    return false;
  }
  // Total input >= Total output인지 확인
  if (
    inputSum < transaction.outputs.reduce((acc, output) => acc + output.value)
  ) {
    console.warn('isValidTransaction(): Total input < Total output');
    return false;
  }

  return true;
}

// getTotalTransactionFee()가 외부 변수 참조
function isValidCoinbaseTransaction(coinbaseTransaction, block) {
  // 서명에 블록 높이가 써져있는지
  if (coinbaseTransaction.inputs[0].signature[0] !== block.id) return false;
  // 수수료 보상 유효성
  if (
    coinbaseTransaction.outputs[0].value !==
    getCoinbaseBasicValue(block.id) + getTotalTransactionFee(block.transactions)
  ) {
    console.warn(
      'isValidCoinbaseTransaction(): Invalid coinbase transaction output value'
    );
    return false;
  }

  return true;
}

// 넣어야 하나???
export function isValidTransactionPool(txPool) {
  if (!txPool.every(tx => isValidTransaction(tx, isUTXO))) return false;
  // 이중 지불 검사
  return true;
}

// 해당 output이 한번도 참조되지 않았으면 true를 반환하고, 그 외 false 반환한다.
// 외부 변수(blockchain) 참조
export function isUTXO(transactionHash, outputIndex) {
  return !blockchain.some(block =>
    block.transactions.some(transaction =>
      transaction.inputs.some(
        input =>
          input.previousTransactionHash === transactionHash &&
          input.outputIndex === outputIndex
      )
    )
  );
}

// output이 1번만 참조됐으면 true를, 이외의 경우엔 false를 반환한다.
// 외부 변수(blockchain) 참조
function isSTXO(transactionHash, outputIndex) {
  let referenceCount = 0;
  return (
    blockchain.every(block =>
      block.transactions.every(transaction =>
        transaction.inputs.every(input => {
          if (
            input.previousTransactionHash === transactionHash &&
            input.outputIndex === outputIndex
          ) {
            referenceCount++;
            if (referenceCount > 1) return false;
          }
          return true;
        })
      )
    ) && referenceCount === 1
  );
}

// 해당 publicKeyHash에 따른 UTXO를 반환한다.
export function getUTXO(recipientPublicKeyHash) {
  const UTXO = [];
  blockchain.forEach(block => {
    block.transactions.forEach(transaction => {
      transaction.outputs.forEach((output, i) => {
        if (
          output.recipientPublicKeyHash === recipientPublicKeyHash &&
          isUTXO(getTransactionHash(transaction), i)
        )
          UTXO.push({
            transactionHash: getTransactionHash(transaction),
            outputIndex: i,
            ...output
          });
      });
    });
  });
  // value 기준 오름차순 정렬
  return UTXO.sort((a, b) => (a.value < b.value ? -1 : 1)); // a.value < b.value ? -1 : a.value > b.value ? 1 : 0
}

export function getBalance(UTXO) {
  return UTXO.reduce((acc, utxo) => acc + utxo.value, 0);
}

export function getPublicKeyHashList() {
  const publicKeyHashes = [];
  blockchain.forEach(block => {
    block.transactions.forEach(transaction => {
      transaction.outputs.forEach(output => {
        if (!publicKeyHashes.includes(output.recipientPublicKeyHash))
          publicKeyHashes.push(output.recipientPublicKeyHash);
      });
    });
  });
  return publicKeyHashes;
}

// 매개변수 transaction은 유효해야 함
function getTransactionFee(transaction) {
  if (isCoinbaseTransaction(transaction)) return 0; // transaction이 coinbase일 수도 있어서 필요함.

  const inputSum = transaction.inputs.reduce(
    (acc, input) =>
      acc +
      getTransactionOutput(input.previousTransactionHash, input.outputIndex)
        .value,
    0
  );
  const outputSum = transaction.outputs.reduce((acc, output) => {
    return acc + output.value;
  }, 0);
  return inputSum - outputSum;
}

// 매개변수 transactions은 유효해야 함
function getTotalTransactionFee(transactions) {
  return transactions.reduce(
    (acc, transaction) => acc + getTransactionFee(transaction),
    0
  );
}

// 해당 Transaction을 찾으면 그 Transaction을 반환하고, 못 찾으면 null을 반환한다. blockchain 참조
function getTransaction(transactionHash) {
  let tx;
  return blockchain.some(block =>
    block.transactions.some(transaction => {
      if (getTransactionHash(transaction) === transactionHash) {
        tx = transaction;
        return true;
      }
    })
  )
    ? tx
    : null;
}

// 해당 Transaction output을 찾으면 그 output을 반환하고, 못 찾으면 null을 반환한다. blockchain 참조
export function getTransactionOutput(transactionHash, outputIndex) {
  const transaction = getTransaction(transactionHash);
  return transaction ? transaction.outputs[outputIndex] : null;
}

export default blockchain;
