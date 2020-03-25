import Multimap from 'multimap';
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
import { broadcastBlock, broadcastTransaction } from './broadcast';
import { getPublicKey } from './wallet';
import { ec, hashRegExp, getDoubleHash } from '../utils';

// 블록에 포함되는 transactions 배열의 최대 크기. in bytes
const MAX_TRANSACTIONS_SIZE = 1024 * 1024; // 1MB

// 거래 타임스탬프의 최대 간격. in milliseconds
const MAX_TX_TIMESTAMP_GAP = 60000;

export let blockchain = [
  {
    id: 0,
    version: 1,
    previousBlockHash: '0'.repeat(64),
    merkleRoot:
      '2ccfdf8623ced5dbcaf13fad2a5d6c7722820eac1ff6c441f34084d5dee88584',
    timestamp: 1584543738629,
    bits: 10,
    nonce: 92,
    transactions: [
      {
        version: 1,
        timestamp: 1584543738629,
        inputs: [
          {
            previousTransactionHash: '0'.repeat(64),
            outputIndex: -1,
            signature: [0, 0],
            senderPublicKey: '0'.repeat(130)
          }
        ],
        outputs: [
          {
            recipientPublicKeyHash:
              '4649166ca08c1685a78d92671d4fda02c95ee04c03199a7a4bbb04351059456e',
            value: 50
          }
        ],
        memo: "Genesis Block's Coinbase Transaction"
      }
    ]
  }
]; // replaceBlockchain 때문에 let
const branchBlocks = new Multimap();
let orphanBlocks = [];

export let validTxPool = []; // 블록체인에 기록된 UTXO를 참조하는 거래
export let orphanTxPool = []; // 그 외. validTxPool에 있는 TXO를 참조하는 거래도 이쪽에 포함.

// 제네시스 블록을 생성한다. 이 함수는 처음 1번만 호출된다. 부수 효과 있음.
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
  const senderPublicKeyHash = getDoubleHash(senderPublicKey);
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

export function addBlockToBlockchain(block) {
  // 제네시스 블록은 추가될 수 없다.
  if (block.id === 0) {
    console.warn('addBlockToBlockchain() : Genesis block is not allowed');
    return false;
  }
  // 고아 블록 포함
  if (!blockchain[block.id - 1]) {
    console.log('addBlockToBlockchain() : Orphan block');
    orphanBlocks.push(block);
    return true;
  }
  if (!isValidBlockHeader(block, blockchain[block.id - 1])) {
    // 블록 헤더가 유효한지 확인
    console.warn('addBlockToBlockchain() : Invalid block header');
    return false;
  }
  // 블록의 모든 transaction이 유효한지 확인
  if (
    !block.transactions.every(tx =>
      isCoinbaseTransaction(tx)
        ? isValidCoinbaseTransaction(tx, block)
        : isValidTransaction(tx)
    )
  ) {
    console.warn('addBlockToBlockchain() : Invalid transaction');
    return false;
  }
  // 마지막 블록 다음 블록이면 블록체인에 추가하고, 아니면 블록 가지에 추가한다.
  if (block.id !== blockchain[blockchain.length - 1].id + 1) {
    console.log('addBlockToBlockchain() : Branch block');
    branchBlocks.set(block.id, block);
    return true;
  }
  // 블록체인에 블록을 연결한다.
  console.log('addBlockToBlockchain() : Valid block');
  blockchain.push(block);
  // 해당 블록을 다른 노드에 전파한다.
  broadcastBlock(block);
  // 고아 거래 풀에 있는 유효 거래를 유효 거래 풀로 이동시킨다.
  const _orphanTxPool = [];
  orphanTxPool.forEach(tx => {
    if (!doesPreviousTransactionOutputExist(tx)) {
      _orphanTxPool.push(tx);
      return true;
    }
    if (!isValidTransactionInput(tx, isUTXO)) return false;
    if (
      validTxPool.some(tx2 =>
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
    )
      return false;
    validTxPool.push(tx);
  });
  orphanTxPool = _orphanTxPool;
  console.log('addBlockToBlockchain(): Rearranged orphan transaction pool');
  // 유효 거래 풀에 있는 이중 지불 거래를 삭제한다.
  validTxPool = validTxPool.filter(tx => isValidTransaction(tx));
  console.log('addBlockToBlockchain(): Rearranged valid transaction pool');
  return true;
}

// 거래를 '고아 거래 풀' 또는 '유효 거래 풀'에 추가한다. 부수 효과 있음.
export function addTransactionToPool(tx) {
  // 거래가 있는지 확인
  if (!tx) {
    console.warn('addTransactionToPool(): Null transaction');
    return false;
  }
  // 원래는 수수료가 높아야 블록에 바로 포함될 확률이 높아진다. 하지만 거래 시각을 무작정 낮춰도 블록에 바로 포함될 확률이 높아진다.
  // 그래서 거래 시각이 엄청 오래된 거래는 노드에서 거부해야 한다.
  // 이렇게 하면 거래 시각을 낮출 수록 수수료를 낮게 설정해도 블록에 바로 포함될 수 있지만, 많은 노드에게 퍼지지 못한다.
  if (tx.timestamp < new Date().getTime() - MAX_TX_TIMESTAMP_GAP) {
    console.warn(
      'addTransactionToPool(): Invalid transaction timestamp. Timestamp of transaction is too old.'
    );
    return false;
  }
  // 거래 구조가 유효한지 확인
  if (!isValidTransactionStructure(tx)) {
    console.warn('addTransactionToPool(): Invalid transaction structure');
    return false;
  }
  // 코인베이스 거래는 풀에 넣을 수 없다.
  if (isCoinbaseTransaction(tx)) {
    console.warn('addTransactionToPool(): Coinbase transaction is not allowed');
    return false;
  }
  // 이전 거래 아웃풋이 있는지 확인하고 없으면 고아 거래 풀에 넣는다.
  if (!doesPreviousTransactionOutputExist(tx)) {
    console.log('addTransactionToPool(): Orphan transaction');
    orphanTxPool.push(tx);
    broadcastTransaction(tx);
    return true;
  }
  // 블록체인의 UTXO를 참조하는지 확인
  if (!isValidTransactionInput(tx, isUTXO)) {
    console.warn('addTransactionToPool(): Invalid transaction input');
    return false;
  }
  // 블록체인의 UTXO를 참조하지만 이중지불인 거래인지 확인
  if (
    validTxPool.some(tx2 =>
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
    console.warn(
      'addTransactionToPool() : Transaction refers to UTXO, but it is double spending'
    );
    return false;
  }
  // 거래가 유효하면 유효 거래 풀에 추가하고 다른 노드로 전파한다.
  console.log('addTransactionToPool(): Valid transaction');
  validTxPool.push(tx);
  broadcastTransaction(tx);
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
  // #### 바꿔야 할 부분 선택해서 버려진 블록 배열에 넣기
  blockchain = receivedBlockchain;
  return true;
}

// validTxPool 유효한 tx만 추출해서 반환한다. 부수 효과 없음.
export function filterValidTransactions() {
  const transactions = []; // validTxPool 안에 이중지불이 없다고 가정
  let accTxSize = 0; // 누적 tx 크기

  // '수수료/거래크기' 내림차순으로 정렬
  validTxPool.sort((a, b) =>
    getTransactionFee(a) / getTransactionSize(a) <
    getTransactionFee(b) / getTransactionSize(b)
      ? 1
      : -1
  );
  // 반절은 '수수료/거래크기' 높은 tx부터 포함하고 미래 거래는 포함하지 않는다.
  validTxPool.every(tx => {
    if (
      accTxSize < MAX_TRANSACTIONS_SIZE / 2 &&
      tx.timestamp <= new Date().getTime()
    ) {
      transactions.push(tx);
      accTxSize += getTransactionSize(tx);
      return true;
    } else return false;
  });
  // 거래 timestamp 오름차순으로 정렬
  validTxPool.sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));
  // 반절은 가장 오래된 tx부터 포함
  validTxPool.every(tx => {
    if (
      accTxSize < MAX_TRANSACTIONS_SIZE &&
      tx.timestamp <= new Date().getTime() &&
      !transactions.some(
        tx2 => getTransactionHash(tx) === getTransactionHash(tx2)
      )
    ) {
      transactions.push(tx);
      accTxSize += getTransactionSize(tx);
      return true;
    } else return false;
  });

  return transactions;
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
      isValidTransactionInBlockchain(transaction, block)
    )
  ) {
    console.warn('isValidBlock() : Invalid transaction');
    return false;
  }
  return true;
}

// block에 담기지 않은 tx : isValidTransaction(tx, isUTXO)
export function isValidTransaction(transaction) {
  // Transaction 데이터 구조 유효성
  if (!isValidTransactionStructure(transaction)) {
    console.warn('isValidTransaction(): Invalid transaction structure');
    return false;
  }
  // Coinbase인지 확인
  if (isCoinbaseTransaction(transaction)) {
    console.warn('isValidTransaction(): Coinbase transaction is not allowed');
    return false;
  }
  // Transaction이 모두 유효한지 확인
  if (!isValidTransactionInput(transaction, isUTXO)) {
    console.warn('isValidTransaction(): Invalid transaction input');
    return false;
  }

  return true;
}

// block에 담긴 tx(coinbase 포함) : isValidTransaction(tx, isSTXO, block)
export function isValidTransactionInBlockchain(transaction, block) {
  // Transaction 데이터 구조 유효성
  if (!isValidTransactionStructure(transaction)) {
    console.warn(
      'isValidTransactionInBlockchain(): Invalid transaction structure'
    );
    return false;
  }
  // Coinbase이면 유효한 coinbase인지 확인
  if (isCoinbaseTransaction(transaction)) {
    if (!isValidCoinbaseTransaction(transaction, block)) {
      console.warn(
        'isValidTransactionInBlockchain(): Invalid coinbase transaction'
      );
      return false;
    } else return true;
  }

  if (!isValidTransactionInput(transaction, isSTXO)) {
    console.warn('isValidTransactionInBlockchain(): Invalid transaction input');
    return false;
  }

  return true;
}

export function isValidTransactionInput(transaction, isTXO) {
  // Transaction의 input 검사
  let inputSum = 0;
  if (
    !transaction.inputs.every(input => {
      const previousTransaction = getTransaction(input.previousTransactionHash);
      // previous transaction output이 존재하는지
      if (!previousTransaction) {
        console.warn(
          'isValidTransactionInput(): There is no previous transaction'
        );
        return false;
      }
      // 이전 거래 타임스탬프와 현재 거래 타임스탬프 비교 #### 필요할까?
      if (previousTransaction.timestamp > transaction.timestamp) {
        console.warn(
          'isValidTransactionInput(): Invalid transaction timestamp'
        );
        return false;
      }
      const previousTransactionOutput = previousTransaction[input.outputIndex];
      // 각 input의 senderPublicKey의 유효성
      if (
        !getDoubleHash(input.senderPublicKey) ===
        previousTransactionOutput.recipientPublicKeyHash
      ) {
        console.warn(
          'isValidTransactionInput(): Invalid transaction input senderPublicKey'
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
          'isValidTransactionInput(): Invalid transaction input signature'
        );
        return false;
      }
      // 각 input의 previous transaction output의 유효성
      if (!isTXO(input.previousTransactionHash, input.outputIndex)) {
        console.warn(
          'isValidTransactionInput(): Invalid previous transaction output reference count'
        );
        return false;
      }
      inputSum += previousTransactionOutput.value;
      return true;
    })
  ) {
    console.warn('isValidTransactionInput(): Invalid transaction inputs');
    return false;
  }
  // Total input >= Total output인지 확인
  if (
    inputSum < transaction.outputs.reduce((acc, output) => acc + output.value)
  ) {
    console.warn('isValidTransactionInput(): Total input < Total output');
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
export function isValidTxPool(txPool) {
  if (!txPool.every(tx => isValidTransaction(tx))) return false;
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

function doesPreviousTransactionOutputExist(transaction) {
  if (
    !transaction.inputs.every(input =>
      getTransactionOutput(input.previousTransactionHash, input.outputIndex)
    )
  )
    return false;
  return true;
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

export function getBlock(blockHash) {
  return blockchain.find(
    block => getBlockHash(block) === blockHash && isValidBlock(block)
  );
}

export function getBlockByID(id) {
  if (id >= blockchain.length) {
    console.warn('getBlockByID(): Invalid block ID');
    return false;
  }
}

// 해당 Transaction을 찾으면 그 Transaction을 반환하고, 못 찾으면 null을 반환한다. blockchain 참조
export function getTransaction(transactionHash) {
  let tx;
  return blockchain.some(block =>
    block.transactions.some(transaction => {
      if (
        getTransactionHash(transaction) === transactionHash &&
        isValidTransactionInBlockchain(transaction, block)
      ) {
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
