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
    id: GraphQLLong!
    version: Int!
    timestamp: GraphQLLong!
    inputs: [Input!]!
    outputs: [Output!]!
    memo: String
  }

  type Input {
    id: Int!
    previousTransactionHash: String!
    outputIndex: Int!
    signature: String!
  }

  type Output {
    id: Int!
    recipientPublicKeyHash: String!
    value: GraphQLLong!
  }

  type Query {
    blockchain: [Block!]
    block(id: GraphQLLong!): Block
    transactions: [Transaction!]
    transaction(id: GraphQLLong!): Transaction
  }

  type Mutation {
    generateBlock(): Block
  }
`;

export default typeDefs;
