import { isValidTransactionStructure } from '../src/blockchain/transaction';

const transaction = {
  version: 1,
  timestamp: 1583749558626,
  inputs: [
    {
      previousTransactionHash:
        'c35e356e7b4af72f3125a6c31987748a499cc38dec8d2b212da401fc2bbbdc22',
      outputIndex: 0,
      signature: [
        48,
        69,
        2,
        32,
        47,
        205,
        78,
        129,
        53,
        4,
        97,
        115,
        220,
        204,
        38,
        72,
        160,
        32,
        141,
        159,
        148,
        206,
        92,
        191,
        127,
        223,
        99,
        90,
        109,
        159,
        30,
        136,
        212,
        29,
        176,
        126,
        2,
        33,
        0,
        218,
        123,
        252,
        83,
        184,
        52,
        54,
        20,
        92,
        58,
        236,
        8,
        98,
        7,
        134,
        119,
        131,
        81,
        45,
        167,
        238,
        234,
        158,
        97,
        48,
        48,
        199,
        206,
        176,
        180,
        208,
        236
      ],
      senderPublicKey:
        '04cc8c876d19712f915223517c7dd7cf92a6abaf5e422637718f1565d21522e8dc8f8130e84a16dd1e27483f7c5d8157fb5dd14583567c205e193d17804619ef7a'
    }
  ],
  outputs: [
    {
      recipientPublicKeyHash:
        '11bbb9e6471493f33b9da4afb5bf0f4722dfcb7a53b6e999e33edfa61074b60f',
      value: 10
    },
    {
      recipientPublicKeyHash:
        'c9181b83aa75aa3054d2fb58929fbdc7fc84f4f37c33c8c2c7965ec25a12c217',
      value: 39
    }
  ],
  memo: 'first transaction'
};

const result = isValidTransactionStructure(transaction);

console.log(result);
