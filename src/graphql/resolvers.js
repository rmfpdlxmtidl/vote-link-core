import GraphQLLong from 'graphql-type-long';
import blockchain, {
  isValidBlockchain,
  isValidBlock,
  isValidTransaction,
  generateBlock,
  createTransaction,
  isUTXO
} from '../blockchain/blockchain';
import wallet, { recipientWallet } from '../blockchain/wallet';

const testTxPool = [];

const resolvers = {
  GraphQLLong,
  Query: {
    blockchain: () => {
      if (isValidBlockchain(blockchain)) return blockchain;
      else return null;
    },
    block: (_, { id }) => {
      if (isValidBlock(blockchain[id])) return blockchain[id];
      else return null;
    },
    transactions: () => {},
    transaction: (_, { id }) => {}
  },
  Mutation: {
    generateBlock: () => {
      return generateBlock(testTxPool, wallet.publicKeyHash);
    },
    createTransaction: (_, { value, fee, memo }) => {
      const tx = createTransaction(
        wallet.privateKey,
        recipientWallet.publicKeyHash,
        value,
        fee,
        memo
      );
      if (!tx) return null;
      testTxPool.push(tx);
      console.log('isValidTransaction(): ' + isValidTransaction(tx, isUTXO));
      return tx;
    }
  }
};

export default resolvers;
