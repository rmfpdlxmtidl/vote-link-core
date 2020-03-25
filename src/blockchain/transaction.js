import {
  hashRegExp,
  publicPointRegExp,
  getStringSize,
  getDoubleHash
} from '../utils';

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
export function getCoinbaseBasicValue(blockID) {
  return 50 / Math.pow(2, Math.floor(blockID / 210000));
}

// Transaction의 해시값을 구한다. 순수함수
export function getTransactionHash({ version, inputs, outputs, timestamp }) {
  const inputsData = inputs.map(
    input => input.previousTransactionHash + input.outputIndex + input.signature
  );

  const outputsData = outputs.map(
    output => output.recipientPublicKeyHash + output.value
  );

  return getDoubleHash(
    version + inputsData.join('') + outputsData.join('') + timestamp
  );
}

// Transaction의 서명에 필요한 해시값을 구한다. 순수함수
export function getTransactionMessage(
  { version, inputs, outputs, timestamp },
  previousTransactionOutputRecipientPublicKeyHash
) {
  const inputsData = inputs.map(
    input =>
      input.previousTransactionHash +
      input.outputIndex +
      previousTransactionOutputRecipientPublicKeyHash
  );

  const outputsData = outputs.map(
    output => output.recipientPublicKeyHash + output.value
  );

  return getDoubleHash(
    version + inputsData.join('') + outputsData.join('') + timestamp
  );
}

export function getTransactionSize(transaction) {
  const inputSize = transaction.inputs.reduce(
    (acc, input) => acc + 32 + 4 + input.signature.length + 65
  );
  return (
    4 + // version
    8 + // timestamp
    transaction.inputs.reduce(
      (acc, input) => acc + 32 + 4 + input.signature.length + 65,
      0
    ) +
    transaction.outputs.length * 40 +
    getStringSize(transaction.memo)
  );
}

// 해당 tx가 coinbase tx인지 확인한다. 순수함수
export function isCoinbaseTransaction(transaction) {
  if (transaction.inputs.length !== 1) return false;
  if (transaction.outputs.length !== 1) return false;
  if (transaction.inputs[0].previousTransactionHash !== '0'.repeat(64))
    return false;
  if (transaction.inputs[0].outputIndex !== -1) return false;
  if (transaction.inputs[0].senderPublicKey !== '0'.repeat(130)) return false; // 비트코인에선 검사하지 않는다.
  return true;
}

// Transaction의 형태를 검사한다. 순수함수
export function isValidTransactionStructure(transaction) {
  return (
    transaction.version === 1 &&
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
    ) &&
    transaction.outputs.every(
      output =>
        hashRegExp.test(output.recipientPublicKeyHash) &&
        Number.isInteger(output.value)
    )
  );
}
