import GraphQLLong from 'graphql-type-long';
import blockchain, {
  validTxPool,
  orphanTxPool,
  generateBlock,
  createTransaction,
  replaceBlockchain,
  addBlockToBlockchain,
  addTransactionToPool,
  filterValidTransactions,
  isValidBlockchain,
  isValidBlock,
  isValidTxPool,
  getUTXO,
  getBalance,
  getPublicKeyHashList,
  getTransaction,
  getBlock
} from '../blockchain/blockchain';
import wallet, { recipientWallet } from '../blockchain/wallet';
import { peers, addPeer } from '../blockchain/broadcast';

const resolvers = {
  GraphQLLong,
  Query: {
    blockchain: () => (isValidBlockchain(blockchain) ? blockchain : null),
    block: (_, { blockHash }) => getBlock(blockHash),
    blockByID: (_, { id }) =>
      id < blockchain.length && isValidBlock(blockchain[id])
        ? blockchain[id]
        : null,
    transactionPool: () =>
      isValidTxPool(validTxPool)
        ? { validTxPool, orphanTxPool }
        : { validTxPool: null, orphanTxPool },
    transaction: (_, { transactionHash }) => getTransaction(transactionHash),
    balance: (_, { publicKeyHash }) => getBalance(getUTXO(publicKeyHash)),
    myBalance: () => getBalance(getUTXO(wallet.publicKeyHash)),
    users: () => [recipientWallet.publicKeyHash, ...getPublicKeyHashList()], // recipientWallet.publicKeyHash는 테스트용
    me: () => wallet.publicKeyHash,
    peers: () => peers
  },
  Mutation: {
    generateBlock: () => {
      const block = generateBlock(
        filterValidTransactions(),
        wallet.publicKeyHash
      );
      return addBlockToBlockchain(block) ? block : null;
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
