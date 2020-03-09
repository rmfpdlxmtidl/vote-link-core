import CryptoJS from 'crypto-js';
import { hashRegExp, publicPointRegExp, ec } from '../utils';
import { getTransactionMessage, getTransactionOutput } from './blockchain';

// coinbase transaction을 반환한다. 순수함수
export function getCoinbaseTransaction(
  minerPublicKeyHash,
  blockID,
  transactionFee,
  memo
) {
  return {
    version: 1,
    timestamp: new Date().getTime(),
    inputs: [
      {
        previousTransactionHash: '0'.repeat(64),
        outputIndex: -1,
        signature: [blockID, 0],
        senderPublicKey: '0'.repeat(130)
      }
    ],
    outputs: [
      {
        recipientPublicKeyHash: minerPublicKeyHash,
        value: getCoinbaseBasicValue(blockID) + transactionFee
      }
    ],
    memo
  };
}

// 반감기에 따른 coinbase 보상을 반환한다. 순수함수
function getCoinbaseBasicValue(blockID) {
  return 50 / Math.pow(2, Math.floor(blockID / 210000));
}

// 순수함수
export function isCoinbaseTransaction(transaction, blockID) {
  if (transaction.inputs.length !== 1) return false;
  if (transaction.outputs.length !== 1) return false;
  if (transaction.inputs[0].previousTransactionHash !== '0'.repeat(64))
    return false;
  if (transaction.inputs[0].outputIndex !== -1) return false;
  if (transaction.inputs[0].signature[0] !== blockID) return false;
  return true;
}

// getTotalTransactionFee()거 외부 변수 참조
export function isValidCoinbaseTransaction(transaction, block) {
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
  // 수수료 보상 유효성
  if (
    transaction.ouputs[0].value !==
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
export function isValidTransaction(transaction, isTXO) {
  console.log(transaction);

  // Coinbase인지 확인. 필요함
  if (isCoinbaseTransaction(transaction)) {
    console.warn('isValidTransaction(): Coinbase transaction');
    return false;
  }
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

  return true;
}

// Transaction의 형태를 검사한다. 순수함수
export function isValidTransactionStructure(transaction) {
  return (
    Number.isInteger(transaction.version) &&
    Number.isInteger(transaction.timestamp) &&
    typeof transaction.memo === 'string' &&
    typeof transaction.inputs === 'object' &&
    typeof transaction.outputs === 'object' &&
    transaction.inputs.every(
      input =>
        hashRegExp.test(input.previousTransactionHash) &&
        Number.isInteger(input.outputIndex) &&
        typeof input.signature === 'object' &&
        input.signature.length === input.signature[1] + 2 &&
        publicPointRegExp.test(input.senderPublicKey)
    )

    /*
    &&
    transaction.outputs.every(
      output =>
        hashRegExp.test(output.recipientPublicKeyHash) &&
        Number.isInteger(output.value)
    )
*/
  );
}
