import GraphQLLong from 'graphql-type-long';
import blockchain, {
  validTxPool,
  generateBlock,
  addBlockToBlockchain,
  createTransaction,
  replaceBlockchain,
  addTransactionToPool,
  extractValidTransactions,
  rearrangeTransactionPool,
  isValidBlockchain,
  isValidBlock,
  isValidTransaction,
  isValidTransactionPool,
  getUTXO,
  getBalance,
  getPublicKeyHashList,
  getTransaction
} from '../blockchain/blockchain';
import { getBlockHash } from '../blockchain/block';
import wallet, { recipientWallet } from '../blockchain/wallet';
import { addPeer } from './broadcast';

const resolvers = {
  GraphQLLong,
  Query: {
    blockchain: () => (isValidBlockchain(blockchain) ? blockchain : null),
    block: (_, { blockHash }) => {
      const block = blockchain.find(block => getBlockHash(block) === blockHash);
      return isValidBlock(block) ? block : null;
    },
    blockByID: (_, { id }) =>
      isValidBlock(blockchain[id]) ? blockchain[id] : null,
    transactionPool: () =>
      isValidTransactionPool(validTxPool)
        ? { validTxPool, orphanTxPool }
        : null,
    transaction: (_, { transactionHash }) => {
      const tx = getTransaction(transactionHash);
      return isValidTransaction(tx) ? tx : null;
    },
    balance: (_, { publicKeyHash }) => getBalance(getUTXO(publicKeyHash)),
    myBalance: () => getBalance(getUTXO(wallet.publicKeyHash)),
    users: () => [recipientWallet.publicKeyHash, ...getPublicKeyHashList()], // recipientWallet.publicKeyHash는 테스트용
    me: () => wallet.publicKeyHash
  },
  Mutation: {
    generateBlock: () => {
      const block = generateBlock(
        extractValidTransactions(),
        wallet.publicKeyHash
      );
      if (!addBlockToBlockchain(block)) return null;
      rearrangeTransactionPool();
      return block;
    },
    createTransaction: (_, { recipientPublicKeyHash, value, fee, memo }) => {
      const tx = createTransaction(
        wallet.privateKey,
        recipientPublicKeyHash,
        value,
        fee,
        memo
      );
      return addTransactionToPool(tx) ? tx : null;
    },

    receiveBlockchain: (_, { blockchain }) =>
      replaceBlockchain(JSON.parse(blockchain)),

    receiveBlock: (_, { block }) => addBlockToBlockchain(JSON.parse(block)),
    receiveTransaction: (_, { transaction }) =>
      addTransactionToPool(JSON.parse(transaction)),
    addPeer: (_, { url }) => addPeer(url)
  }
};

export default resolvers;
