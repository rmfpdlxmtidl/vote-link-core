import CryptoJS from 'crypto-js';
import { hexToBinary, hashRegExp, getDoubleHash } from '../utils';
import { getTransactionHash } from './transaction';
import blockchain from './blockchain';

// 블록 생성 주기. in seconds
const BLOCK_GENERATION_INTERVAL = 10;

// 블록 타임스탬프 최대 간격. in milliseconds
const MAX_BLOCK_TIMESTAMP_GAP = 60000;

// 난이도 조정 주기. in blocks
const BITS_ADJUSTMENT_INTERVAL = 2;

// 블록 헤더의 해시값을 반환한다. 순수함수
export function getBlockHash(blockHeader) {
  return getDoubleHash(
    blockHeader.version +
      blockHeader.previousBlockHash +
      blockHeader.merkleRoot +
      blockHeader.timestamp +
      blockHeader.bits +
      blockHeader.nonce
  );
}

// transaction의 merkle tree의 root hash를 반환한다. 순수함수
export function getMerkleRoot(transactions) {
  if (transactions.length === 0) return null;

  let transactionHashes = transactions.map(transaction =>
    getTransactionHash(transaction)
  );

  while (true) {
    if (transactionHashes.length === 1) break;
    if (transactionHashes.length % 2 !== 0)
      transactionHashes.push(transactionHashes[transactionHashes.length - 1]);

    const transactionHashes2 = [];
    for (let i = 0; i < transactionHashes.length; i += 2)
      transactionHashes2.push(
        CryptoJS.SHA256(
          transactionHashes[i] + transactionHashes[i + 1]
        ).toString()
      );

    transactionHashes = transactionHashes2;
  }

  return transactionHashes[0];
}

// 해당 블록의 bits값을 반환한다. 외부 변수(blockchain) 참조
export function getBits(id, timestamp) {
  if (id !== 0) {
    if (id % BITS_ADJUSTMENT_INTERVAL === 0) {
      const { previousTimestamp, bits } = blockchain[
        blockchain.length - BITS_ADJUSTMENT_INTERVAL
      ]; // previousIntervalBlock
      const timeExpected = BLOCK_GENERATION_INTERVAL * BITS_ADJUSTMENT_INTERVAL;
      const timeTaken = timestamp - previousTimestamp; // 현재 블록과 이전 주기 블록의 timestamp 차이

      if (timeTaken < timeExpected / 2) {
        return bits + 1;
      } else if (timeTaken > timeExpected * 2) {
        return bits - 1;
      } else {
        return bits;
      }
    } else {
      return blockchain[id - 1].bits;
    }
  } else {
    return blockchain[0].bits;
  }
}

// 해당 블록의 nonce값을 계산해서 반환한다. 부수 효과 있음.
export function getNonce(blockHeader) {
  blockHeader.nonce = 0;
  while (true) {
    if (isValidBlockHash(getBlockHash(blockHeader), blockHeader.bits))
      return blockHeader.nonce;
    blockHeader.nonce++;
  }
}

// 블록체인의 누적 난이도를 확인한다. 순수함수
export function getBlockchainDifficulty(blockchain) {
  return blockchain
    .map(block => block.bits)
    .map(bits => Math.pow(2, bits))
    .reduce((a, b) => a + b);
}

// 블록이 유효한지 검증한다. 순수함수
export function isValidBlockHeader(block, previousBlock) {
  // 블록 헤더의 구조가 유효한지
  if (!isValidBlockHeaderStructure(block)) {
    console.warn('isValidBlockHeader(): Invalid block structure');
    return false;
  }
  // 블록 해시 앞에 0이 몇 개 있는지 = 블록 해시 제대로 채굴했는지
  if (!isValidBlockHash(getBlockHash(block), block.bits)) {
    console.warn('isValidBlockHeader(): Invalid block hash');
    console.warn('Expected: ' + block.bits + ', Got: ' + getBlockHash(block));
    return false;
  }
  // 버전이 1인지
  if (block.version !== 1) {
    console.warn('isValidBlockHeader(): Version is not 1');
  }
  //  블록의 previousBLockHash와 이전 블록의 해시가 일치하는지
  if (getBlockHash(previousBlock) !== block.previousBlockHash) {
    console.warn('isValidBlockHeader(): Invalid previous block hash');
    return false;
  }
  // 머클 루트 해시의 유효성 검사
  if (getMerkleRoot(block.transactions) !== block.merkleRoot) {
    console.warn('isValidBlockHeader(): Invalid merkle root');
    return false;
  }
  // timestamp값이 유효한지
  if (!isValidTimestamp(block, previousBlock)) {
    console.warn('isValidBlockHeader(): Invalid timestamp');
    return false;
  }
  // bits값이 제대로 산출됐는지
  if (getBits(block.id) !== block.bits) {
    console.warn('isValidBlockHeader(): Invalid bits');
    return false;
  }

  return true;
}

// 블록 헤더의 형태를 검사한다. 순수함수
function isValidBlockHeaderStructure(block) {
  return (
    Number.isInteger(block.id) &&
    Number.isInteger(block.version) &&
    hashRegExp.test(block.previousBlockHash) &&
    hashRegExp.test(block.merkleRoot) &&
    Number.isInteger(block.timestamp) &&
    Number.isInteger(block.bits) &&
    Number.isInteger(block.nonce)
  );
}

// 순수함수
function isValidBlockHash(hexBlockHash, bits) {
  //16진수 Hash 문자열을 2진수 문자열로 교체한다.
  //난이도 수만큼 0을 반복해 문자열을 생성한다.
  //2진수 Hash 문자열 맨 앞에 0이 'bits'번 이상 나오는 지 확인한다.
  return hexToBinary(hexBlockHash).startsWith('0'.repeat(bits));
}

// 순수함수
function isValidTimestamp(block, previousBlock) {
  return (
    previousBlock.timestamp - MAX_BLOCK_TIMESTAMP_GAP < block.timestamp &&
    block.timestamp - MAX_BLOCK_TIMESTAMP_GAP < new Date().getTime()
  );
}
