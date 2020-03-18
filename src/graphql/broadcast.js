import fetch from 'node-fetch';
import { execute, makePromise } from 'apollo-link';
import { createHttpLink } from 'apollo-link-http';
import { gql } from 'apollo-server';
import { URL } from 'url';
import { urlRegExp } from '../utils';
import { myURL } from '../index';

const peers = [];
const MAX_PEER_COUNT = 5;

// 피어 리스트에 url을 추가한다.
export function addPeer(url) {
  if (peers.length >= MAX_PEER_COUNT) return false;
  if (!urlRegExp.test(url)) return false;
  if (isSameURL(url)) return false;
  peers.push(url);
  return true;
}

// 서버 URL과 동일한지 확인. 정확하지 않음.
function isSameURL(url) {
  const u = new URL(url);
  return u.host === myURL.host && u.protocol === myURL.protocol;
}

// 피어 리스트에 있는 모든 URL로 block을 전파한다.
export async function broadcastBlock(block) {
  const b = JSON.stringify(block);
  const peersLength = peers.length;
  for (let i = 0; i < peersLength; i++) {
    const link = new createHttpLink({ uri: peers[i], fetch });
    const operation = {
      query: gql`
        mutation broadcastBlock($b: String!) {
          receiveBlock(block: $b)
        }
      `,
      variables: { b }
    };
    try {
      const {
        data: { receiveBlock }
      } = await makePromise(execute(link, operation));
      const message = receiveBlock
        ? 'Broadcasted block'
        : 'Fail to broadcast block';
      console.log(message);
    } catch (err) {
      console.warn(`Received error. ${error}`);
    }
  }
}

// 피어 리스트에 있는 모든 URL로 transaction을 전파한다.
export async function broadcastTransaction(transaction) {
  const tx = JSON.stringify(transaction);
  const peersLength = peers.length;
  for (let i = 0; i < peersLength; i++) {
    const link = new createHttpLink({ uri: peers[i], fetch });
    const operation = {
      query: gql`
        mutation broadcastTransaction($tx: String!) {
          receiveTransaction(transaction: $tx)
        }
      `,
      variables: { tx }
    };
    try {
      const {
        data: { receiveTransaction }
      } = await makePromise(execute(link, operation));
      const message = receiveTransaction
        ? 'Broadcasted transaction'
        : 'Fail to broadcast transaction';
      console.log(message);
    } catch (err) {
      console.warn(`Received error. ${error}`);
    }
  }
}
