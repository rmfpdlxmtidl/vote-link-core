import GraphQLLong from 'graphql-type-long';
import blockchain, {
  generateBlock,
  createTransaction,
  isValidBlockchain,
  isValidBlock,
  isValidTransaction,
  isUTXO,
  getUTXO,
  getBalance
} from '../blockchain/blockchain';
import wallet, { recipientWallet } from '../blockchain/wallet';

const transactionPool = [];

const resolvers = {
  GraphQLLong,
  Query: {
    blockchain: () => (isValidBlockchain(blockchain) ? blockchain : null),
    block: (_, { id }) =>
      isValidBlock(blockchain[id]) ? blockchain[id] : null,
    transactionPool: () =>
      transactionPool.every(tx => isValidTransaction(tx, isUTXO))
        ? transactionPool
        : null,
    myBalance: () => {
      return getBalance(getUTXO(wallet.publicKeyHash));
    },
    balance: (_, { publicKeyHash }) => {
      return getBalance(getUTXO(recipientWallet.publicKeyHash)); // publicKeyHash로 수정 필요
    }
  },
  Mutation: {
    generateBlock: () =>
      transactionPool.every(tx => isValidTransaction(tx, isUTXO))
        ? generateBlock(transactionPool, wallet.publicKeyHash)
        : null,
    createTransaction: (_, { recipientPublicKeyHash, value, fee, memo }) => {
      const tx = createTransaction(
        wallet.privateKey,
        recipientWallet.publicKeyHash, // recipientPublicKeyHash로 수정 필요
        value,
        fee,
        memo
      );
      if (!tx || !isValidTransaction(tx, isUTXO)) return null;
      transactionPool.push(tx);
      return tx;
    }
  }
};

export default resolvers;
