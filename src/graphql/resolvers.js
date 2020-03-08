import GraphQLLong from 'graphql-type-long';
import blockchain, {
  isValidBlockchain,
  isValidBlock,
  generateBlock,
  createTransaction
} from '../blockchain/blockchain';
import wallet from '../blockchain/wallet';

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
      return generateBlock();
    },
    createTransaction: (_, { recipientPublicKeyHash, value, fee, memo }) => {
      return createTransaction(
        wallet.privateKey,
        recipientPublicKeyHash,
        value,
        fee,
        memo
      );
    }
  }
};

export default resolvers;
