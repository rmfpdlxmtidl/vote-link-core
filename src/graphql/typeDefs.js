import { gql } from 'apollo-server';

// 쿼리 매개변수의 유효성(자료형 등)은 여기서 검사
const typeDefs = gql`
  scalar GraphQLLong
  scalar Hash64
  scalar Hash65

  type Block {
    id: GraphQLLong!
    version: Int!
    previousBlockHash: String!
    merkleRoot: String!
    timestamp: GraphQLLong!
    bits: Int!
    nonce: GraphQLLong!
    transactions: [Transaction!]!
  }

  type Transaction {
    version: Int!
    timestamp: GraphQLLong!
    inputs: [Input!]!
    outputs: [Output!]!
    memo: String
  }

  type Input {
    previousTransactionHash: String!
    outputIndex: Int!
    signature: [Int!]!
    senderPublicKey: String!
  }

  type Output {
    recipientPublicKeyHash: String!
    value: GraphQLLong!
  }

  type Query {
    blockchain: [Block!]
    block(id: GraphQLLong!): Block
    transactionPool: [Transaction!]
    myBalance: GraphQLLong!
    balance(publicKeyHash: String!): GraphQLLong!
    users: [String!]!
    me: String!
  }

  type Mutation {
    generateBlock: Block
    createTransaction(
      recipientPublicKeyHash: [String!]!
      value: [GraphQLLong!]!
      fee: [GraphQLLong!]!
      memo: String
    ): Transaction
    receiveBlockchain(blockchain: String!): Boolean!
    receiveBlock(block: String!): Boolean!
    receiveTransaction(transaction: String!): Boolean!
  }
`;

export default typeDefs;
