import CryptoJS from 'crypto-js';
import {
  getBlockHash,
  getMerkleRoot,
  getBits,
  getNonce,
  getTransactionHash,
  getTransactionMessage,
  getBlockchainDifficulty,
  isValidBlockHeader
} from './block';
import {
  getCoinbaseTransaction,
  getCoinbaseBasicValue,
  isValidTransactionStructure,
  isCoinbaseTransaction
} from './transaction';
import wallet, { getPublicKey } from './wallet';
import { ec } from '../utils';

function broadcastLatest() {
  console.log('broadcasting last block...');
}

export const blockchain = [generateGenesisBlock()];
const transactionPool = [];
export const UTXO = [];

// 제네시스 블록을 생성. 비순수함수
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

// 새로운 블록을 생성. 비순수함수
export function generateBlock(transactions, minerPublicKeyHash) {
  // @@ 블록에 넣은 transactions은 pop 필요
  if (
    !transactions.every(transaction => isValidTransaction(transaction, isUTXO))
  ) {
    console.warn('generateBlock(): Invalid transaction');
    return null;
  }

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
  broadcastLatest();

  console.log(newBlock.transactions[0].outputs);
  return newBlock;
}

export function createTransaction(
  senderPrivateKey,
  recipientPublicKeyHash,
  value,
  fee,
  memo
) {
  const senderPublicKey = getPublicKey(senderPrivateKey);
  const senderPublicKeyHash = CryptoJS.SHA256(senderPublicKey).toString();

  // 보유 금액 게산
  updateUTXO(senderPublicKeyHash);
  if (getBalance() < value + fee) {
    console.warn('createTransaction(): Not enough balance');
    return null;
  }

  const inputs = [];
  const outputs = [];
  let inputSum = 0;
  for (let i = UTXO.length - 1; i > -1; i--) {
    if (value + fee > inputSum) {
      inputs.push({
        previousTransactionHash: UTXO[i].previousTransactionHash,
        outputIndex: UTXO[i].outputIndex,
        signature: [UTXO[i].recipientPublicKeyHash],
        senderPublicKey
      });
      inputSum += UTXO[i].value;
      UTXO.pop();
    } else break; // every함수 break
  }

  // 여러 명의 수신인에게 금액 전송
  if (
    typeof recipientPublicKeyHash === 'object' &&
    typeof value === 'object' &&
    recipientPublicKeyHash.length === value.length
  ) {
    for (let i = 0; i < value.length; i++)
      outputs.push({
        recipientPublicKeyHash: recipientPublicKeyHash[i],
        value: value[i]
      });
  }
  // 1명의 수신인에게 금액 전송
  else if (
    typeof recipientPublicKeyHash === 'string' &&
    typeof value === 'number'
  ) {
    outputs.push({ recipientPublicKeyHash, value });
  }
  // 그 외
  else {
    console.warn(
      'createTransaction(): Invalid recipient public key hash or value'
    );
    return null;
  }

  // 거스름돈 계산
  if (value + fee != inputSum) {
    outputs.push({
      recipientPublicKeyHash: senderPublicKeyHash,
      value: inputSum - value - fee
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

// getTotalTransactionFee()거 외부 변수 참조
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

// 일반 transaction만 검사할 수 있다. 비순수함수
// isValidOutput은 isUTXO(), isSTXO() 둘 중 하나 넣어준다.
// block은 해당 transaction이 담긴 블록을 넣어준다. 담긴 블록이 없으면 genesis block을 넣는다.
// @@@@block에 담긴 tx, 담기지 않은 tx, coinbase tx 3가지를 구분해서 검증해야 한다.
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
  /*
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
          'isValidTransaction(): Invalid previous transaction output'
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
  */

  return true;
}

// 해당 output이 한번도 참조되지 않았으면 true를 반환하고, 그 외 false 반환한다.
// 외부 변수(blockchain) 참조
export function isUTXO(transactionHash, outputIndex) {
  return blockchain.every(block =>
    block.transactions.every(transaction =>
      transaction.inputs.every(
        input =>
          input.previousTransactionHash !== transactionHash &&
          input.outputIndex !== outputIndex
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

// UTXO를 갱신한다.
function updateUTXO(recipientPublicKeyHash) {
  UTXO.length = 0;
  const blockchainLength = blockchain.length;
  for (let i = 0; i < blockchainLength; i++) {
    const transactions = blockchain[i].transactions;
    const transactionsLength = transactions.length;
    for (let j = 0; j < transactionsLength; j++) {
      const outputs = transactions[j].outputs;
      const outputsLength = outputs.length;
      for (let k = 0; k < outputsLength; k++) {
        if (
          outputs[k].recipientPublicKeyHash === recipientPublicKeyHash &&
          isUTXO(getTransactionHash(transactions[j]), k)
        )
          UTXO.push({
            previousTransactionHash: getTransactionHash(transactions[j]),
            outputIndex: k,
            ...outputs[k]
          });
      }
    }
  }
  // value 기준 오름차순 정렬
  UTXO.sort((a, b) => a[value] - b[value]);
}

function getBalance() {
  return UTXO.reduce((acc, utxo) => acc + utxo.value);
}

// 매개변수 transaction은 유효해야 함
function getTransactionFee(transaction) {
  if (isCoinbaseTransaction(transaction)) return 0;

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
export function getTotalTransactionFee(transactions) {
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

// 비순수함수
export function replaceBlockchain(receivedBlockchain) {
  // 수신된 블록체인이 유효하고, 자신의 블록체인보다 더 어려우면 교체된다.
  if (
    isValidBlockChain(receivedBlockchain) &&
    getBlockchainDifficulty(receivedBlockchain) >
      getBlockchainDifficulty(blockchain)
  ) {
    console.log(
      'Received blockchain is valid. Replacing current blockchain with received blockchain'
    );
    blockchain = receivedBlockchain;
    broadcastLatest();
  } else console.log('Received blockchain invalid');
}

export default blockchain;

/* 예비 블록에 포함된 tx까지 고려해서 tx 유효성을 검사해야 한다. */
