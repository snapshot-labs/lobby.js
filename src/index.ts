import fetch from 'cross-fetch';
import { getAddress } from '@ethersproject/address';
import { formatBytes32String } from '@ethersproject/strings';
import { jsonToGraphQLQuery } from 'json-to-graphql-query';
import shot from '@snapshot-labs/snapshot.js';
import subgraphs from './subgraphs.json';

const CONTRACT = '0x469788fE6E9E9681C6ebF3bF78e7Fd26Fc015446';
const EMPTY_ADDRESS = '0x0000000000000000000000000000000000000000';
const EMPTY_SPACE = formatBytes32String('');
const abi = ['function delegation(address, bytes32) view returns (address)'];

export async function gqlQuery(url: string, query) {
  const init = {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: jsonToGraphQLQuery({ query }) })
  };
  const res = await fetch(url, init);
  return await res.json();
}

export async function getSpaceDelegationsOut(
  space: string,
  addresses: string[],
  network: string,
  snapshot: number | 'latest'
) {
  const id = formatBytes32String(space);
  const options = { blockTag: snapshot };
  const multi = new shot.utils.Multicaller(network, shot.utils.getProvider(network), abi, options);
  addresses.forEach((account) => {
    multi.call(`${account}.base`, CONTRACT, 'delegation', [account, EMPTY_SPACE]);
    multi.call(`${account}.space`, CONTRACT, 'delegation', [account, id]);
  });
  const delegations = await multi.execute();
  return Object.fromEntries(
    Object.entries(delegations).map(([address, delegation]: any) => {
      if (delegation.space !== EMPTY_ADDRESS) return [address, delegation.space];
      if (delegation.base !== EMPTY_ADDRESS) return [address, delegation.base];
      return [address, null];
    })
  );
}

export async function getSpaceDelegationsIn(
  space: string,
  addresses: string[],
  network: string,
  snapshot: number | 'latest'
) {
  const query = {
    delegations: {
      __args: {
        first: 1000,
        block: snapshot !== 'latest' ? { number: snapshot } : undefined,
        where: {
          space_in: ['', space],
          delegate_in: addresses
        }
      },
      delegator: true,
      delegate: true,
      space: true
    }
  };
  const { data } = await gqlQuery(subgraphs[network], query);
  const delegations = Object.fromEntries(addresses.map((address) => [address, []]));
  const baseDelegations = {};
  data.delegations.forEach((delegation) => {
    const delegate = getAddress(delegation.delegate);
    const delegator = getAddress(delegation.delegator);
    // @ts-ignore
    if (delegation.space === space) delegations[delegate].push(delegator);
    if ([null, ''].includes(delegation.space)) baseDelegations[delegator] = delegate;
  });
  if (Object.keys(baseDelegations).length > 0) {
    const delegationsOut = await getSpaceDelegationsOut(
      space,
      Object.keys(baseDelegations),
      network,
      snapshot
    );
    // @ts-ignore
    Object.entries(delegationsOut).map(([delegator, out]: any) => {
      if (out === baseDelegations[delegator]) {
        // @ts-ignore
        delegations[baseDelegations[delegator]].push(delegator);
      }
    });
  }
  return delegations;
}

export async function getSpaceDelegations(
  space: string,
  addresses: string[],
  network: string,
  snapshot: number | 'latest'
) {
  const [delegationsIn, delegationsOut] = await Promise.all([
    getSpaceDelegationsIn(space, addresses, network, snapshot),
    getSpaceDelegationsOut(space, addresses, network, snapshot)
  ]);
  return Object.fromEntries(
    addresses.map((address) => [
      address,
      {
        in: delegationsIn[address],
        out: delegationsOut[address]
      }
    ])
  );
}
