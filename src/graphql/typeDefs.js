import { gql } from 'apollo-server';

const typeDefs = gql`
  scalar GraphQLLong

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
  }

  type Mutation {
    generateBlock: Block
    createTransaction(
      recipientPublicKeyHash: String!
      value: GraphQLLong!
      fee: GraphQLLong!
      memo: String
    ): Transaction
  }
`;

export default typeDefs;
