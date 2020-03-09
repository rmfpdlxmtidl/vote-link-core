import { ApolloServer } from 'apollo-server';
import resolvers from './graphql/resolvers';
import typeDefs from './graphql/typeDefs';
//import context from './graphql/context';

// ApolloServer는 스키마와 리졸버가 반드시 필요함
const server = new ApolloServer({
  typeDefs,
  resolvers
  //context
});

// listen 함수로 웹 서버 실행
server.listen().then(({ url }) => {
  console.log(`🚀 Server ready at ${url}`);
});
