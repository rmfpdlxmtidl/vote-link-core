import CryptoJS from 'crypto-js';
import {
  getBlockHash,
  getMerkleRoot,
  getBits,
  getNonce,
  getTransactionHash,
  getBlockchainDifficulty,
  isValidBlockHeader
} from './block';
import {
  getCoinbaseTransaction,
  isValidTransaction,
  isCoinbaseTransaction,
  isValidCoinbaseTransaction
} from './transaction';
import wallet from './wallet';

const genesisBlock = {
  id: 0,
  version: 1,
  previousBlockHash: '0'.repeat(64),
  merkleRoot: '',
  timestamp: new Date().getTime(),
  bits: 10,
  nonce: 0,
  transactions: [
    {
      version: 1,
      timestamp: new Date().getTime(),
      inputs: [
        {
          previousTransactionHash: '0'.repeat(64),
          outputIndex: -1,
          signature: [],
          senderPublicKey: '0'.repeat(130)
        }
      ],
      outputs: [
        {
          recipientPublicKeyHash: CryptoJS.SHA256(
            wallet.privateKey.getPublic().encode('hex')
          ).toString(),
          value: 50
        }
      ], // recipientPublicKeyHash 수정 필요
      memo: "Genesis Block's Coinbase Transaction"
    }
  ]
};

export const blockchain = [generateGenesisBlock()];
export const transactionPool = [];
export const UTXO = [];

// 제네시스 블록을 생성. 비순수함수
function generateGenesisBlock() {
  genesisBlock.merkleRoot = getMerkleRoot(genesisBlock.transactions);
  genesisBlock.nonce = getNonce(genesisBlock);
  return genesisBlock;
}

// 새로운 블록을 생성. 비순수함수
export function generateBlock(transactions, minerPublicKeyHash) {
  if (
    !transactions.every(transaction => isValidTransaction(transaction, isUTXO))
  ) {
    console.warn('generateBlock(): Invalid transaction');
    return null;
  }

  transactions.unshift(
    getCoinbaseTransaction(
      minerPublicKeyHash,
      blockchain.length,
      getTotalTransactionFee(transactions)
    )
  );

  const newBlockHeader = {
    version: 1,
    previousBlockHash: getBlockHash(blockchain[blockchain.length - 1]),
    merkleRoot: getMerkleRoot(transactions),
    timestamp: new Date().getTime(),
    bits: getBits(blockchain),
    nonce: 0
  };

  const newBlock = {
    id: blockchain.length,
    ...newBlockHeader,
    transactions
  };

  newBlock.nonce = getNonce(newBlockHeader);
  blockchain.push(newBlock);
  broadcastLatest();
  return newBlock;
}

export function createTransaction(
  senderPrivateKey,
  recipientPublicKeyHash,
  value,
  fee,
  memo
) {
  // 보유 금액 게산
  if (
    getBalance(
      CryptoJS.SHA256(senderPrivateKey.getPublic().encode('hex')).toString()
    ) <
    value + fee
  ) {
    console.warn('createTransaction() : not enough balance');
    return null;
  }

  const inputs = [];
  const outputs = [];

  let inputSum = 0;
  UTXO.every(utxo => {
    if (value + fee > inputSum) {
      inputs.push({
        previousTransactionHash: utxo.previousTransactionHash,
        outputIndex: utxo.outputIndex,
        signature: [utxo.recipientPublicKeyHash],
        senderPublicKey: senderPrivateKey.getPublic().encode('hex')
      });
      inputSum += utxo.value;
    } else return false; // every함수 break
  });

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
    console.warn('createTransaction() : fail to create new transaction');
    return null;
  }

  // 거스름돈 계산
  if (value + fee != inputSum) {
    outputs.push({
      recipientPublicKeyHash: CryptoJS.SHA256(
        senderPrivateKey.getPublic().encode('hex')
      ).toString(),
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
    input.signature = senderPrivateKey.sign(transactionHash).toDER();
  });

  return transaction;
}

// 블록체인이 유효한지 검증한다. 외부 변수(genesisBlock) 참조
export function isValidBlockchain(blockchain) {
  // 새로운 블록체인의 제네시스 블록이 기존 제네시스 블록과 일치하는지 확인
  if (JSON.stringify(blockchain[0]) !== JSON.stringify(genesisBlock)) {
    console.warn('isValidBlockchain() : Invalid genesis block');
    return false;
  }

  if (!blockchain.every(block => isValidBlock(block))) {
    console.warn('isValidBlockchain() : Invalid block');
    return false;
  }

  return true;
}

// 외부변수(blockchain) 참조
export function isValidBlock(block) {
  if (!isValidBlockHeader(block, blockchain[block.id - 1])) {
    console.warn('isValidBlock() : Invalid block header');
    return false;
  }
  if (
    !block.transactions.every(transaction => {
      if (isCoinbaseTransaction(transaction, block.id))
        return isValidCoinbaseTransaction(transaction, block);
      else return isValidTransaction(transaction, isSTXO);
    })
  ) {
    console.warn('isValidBlock() : Invalid transaction');
    return false;
  }
}

// 해당 output이 한번도 참조되지 않았으면 true를 반환하고, 그 외 false 반환한다. 외부 변수(blockchain) 참조
function isUTXO(transactionHash, outputIndex) {
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

// output이 참조됐는지 확인한다. 외부 변수(blockchain) 참조
function isSTXO(transactionHash, outputIndex) {
  let referenceCount = 0;
  const blockchainLength = blockchain.length;
  for (let i = 0; i < blockchainLength; i++) {
    const transactions = blockchain[i].transactions;
    const transactionsLength = transactions.length;
    for (let j = 0; j < transactionsLength; j++) {
      const inputs = transactions[j].inputs;
      const inputsLength = inputs.length;
      for (let k = 0; k < inputsLength; k++) {
        if (
          inputs[k].previousTransactionHash === transactionHash &&
          inputs[k].outputIndex === outputIndex
        ) {
          referenceCount++;
          if (referenceCount > 1) return false;
        }
      }
    }
  }
  return referenceCount === 1;
}

// 매개변수 transaction은 유효해야 함
function getTransactionFee(transaction) {
  const inputSum = transaction.inputs.reduce((acc, input) => {
    const blockchainLength = blockchain.length;
    for (let i = 0; i < blockchainLength; i++) {
      const transactions = blockchain[i].transactions;
      const transactionsLength = transactions.length;
      for (let j = 0; j < transactionsLength; j++) {
        if (
          getTransactionHash(transactions[j]) === input.previousTransactionHash
        )
          return acc + transactions[j].outputs[input.outputIndex].value;
      }
    }

    console.warn('getTransactionFee() : There is no previous output');
    return acc;
  });

  const outputSum = transaction.outputs.reduce((acc, output) => {
    return acc + output.value;
  });

  return inputSum - outputSum;
}

// 매개변수 transactions은 유효해야 함
function getTotalTransactionFee(transactions) {
  return transactions.reduce((acc, transaction) => {
    return acc + getTransactionFee(transaction);
  });
}

function getBalance(recipientPublicKeyHash) {
  // UTXO를 갱신한다.
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
            ...output[k]
          });
      }
    }
  }
  // value 기준 내림차순 정렬
  UTXO.sort((a, b) => b[value] - a[value]);
  // 잔액을 계산한다.
  return UTXO.reduce((acc, utxo) => {
    return acc + utxo.value;
  });
}

// 비순수함수
export const replaceBlockchain = receivedBlockchain => {
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
};

export default blockchain;
