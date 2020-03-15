import GraphQLLong from 'graphql-type-long';
import blockchain, {
  generateBlock,
  createTransaction,
  isValidBlockchain,
  isValidBlock,
  isValidTransactionPool,
  getUTXO,
  getBalance,
  getPublicKeyHashList,
  extractValidTransactions,
  addTransactionToPool,
  replaceBlockchain
} from '../blockchain/blockchain';
import wallet, { recipientWallet } from '../blockchain/wallet';

export const txPool = [];

const resolvers = {
  GraphQLLong,
  Query: {
    blockchain: () => (isValidBlockchain(blockchain) ? blockchain : null),
    block: (_, { id }) =>
      isValidBlock(blockchain[id]) ? blockchain[id] : null,
    transactionPool: () => (isValidTransactionPool(txPool) ? txPool : null),
    myBalance: () => getBalance(getUTXO(wallet.publicKeyHash)),
    balance: (_, { publicKeyHash }) => getBalance(getUTXO(publicKeyHash)),
    users: () => [recipientWallet.publicKeyHash, ...getPublicKeyHashList()],
    me: () => wallet.publicKeyHash
  },
  Mutation: {
    generateBlock: () => {
      const block = generateBlock(
        extractValidTransactions(txPool),
        wallet.publicKeyHash
      );
      return isValidBlock(block) ? block : null;
    },
    createTransaction: (_, { recipientPublicKeyHash, value, fee, memo }) => {
      const tx = createTransaction(
        wallet.privateKey,
        recipientPublicKeyHash,
        value,
        fee,
        memo
      );
      return addTransactionToPool(tx, txPool) ? tx : null;
    },
    receiveBlockchain: (_, { blockchain }) =>
      replaceBlockchain(JSON.parse(blockchain)),
    receiveBlock: (_, { block }) => {
      const b = JSON.parse(block);
      if (!isValidBlock(b)) return false;
      blockchain.push(b);
      return true;
    },
    receiveTransaction: (_, { transaction }) =>
      addTransactionToPool(JSON.parse(transaction), txPool)
  }
};

export default resolvers;
