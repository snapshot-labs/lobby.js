import fetch from 'cross-fetch';
import { getAddress } from '@ethersproject/address';
import { formatBytes32String } from '@ethersproject/strings';
import shot from '@snapshot-labs/snapshot.js';

const CONTRACT = '0x469788fE6E9E9681C6ebF3bF78e7Fd26Fc015446';
const EMPTY_ADDRESS = '0x0000000000000000000000000000000000000000';
const EMPTY_SPACE = formatBytes32String('');
const abi = ['function delegation(address, bytes32) view returns (address)'];
const SCORE_API = 'https://score.snapshot.org/api/scores';

export async function getSpaceDelegationsOut(
  space: string,
  addresses: string[],
  network: string,
  snapshot: number | 'latest'
) {
  addresses = addresses.map((address) => getAddress(address));
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
  addresses = addresses.map((address) => getAddress(address));
  const delegations: any = Object.fromEntries(addresses.map((address) => [address, []]));
  const baseDelegations = {};

  const PAGE_SIZE = 1000;
  let result = [];
  let page = 0;

  const query = {
    delegations: {
      __args: {
        first: PAGE_SIZE,
        skip: 0,
        block: { number: snapshot },
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
  // @ts-ignore
  if (snapshot === 'latest') delete query.delegations.__args.block;

  while (true) {
    query.delegations.__args.skip = page * PAGE_SIZE;
    const pageResult = await shot.utils.subgraphRequest(
      shot.utils.SNAPSHOT_SUBGRAPH_URL[network],
      query
    );
    const pageDelegations = pageResult.delegations || [];
    result = result.concat(pageDelegations);
    page++;
    if (pageDelegations.length < PAGE_SIZE) break;
  }

  result.forEach((delegation: any) => {
    const delegate = getAddress(delegation.delegate);
    const delegator = getAddress(delegation.delegator);
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
    Object.entries(delegationsOut).map(([delegator, out]: any) => {
      if (out === baseDelegations[delegator]) {
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
  addresses = addresses.map((address) => getAddress(address));
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

export async function getScores(
  space: string,
  strategies: any[],
  network: string,
  addresses: string[],
  snapshot: number | 'latest',
  delegation: boolean
) {
  let delegations = {};
  let _addresses = addresses;
  if (delegation) {
    delegations = await getSpaceDelegations(space, addresses, network, snapshot);
    _addresses = [];
    Object.entries(delegations).forEach((d: any[]) => {
      if (!d[1].out) _addresses.push(d[0]);
      d[1].in.forEach((delegationIn) => _addresses.push(delegationIn));
    });
    _addresses = Object.keys(Object.fromEntries(_addresses.map((address) => [address, true])));
  }

  let result: any = {};
  try {
    const params = {
      space,
      network,
      snapshot,
      strategies,
      addresses: _addresses
    };
    const res = await fetch(SCORE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ params })
    });
    result = (await res.json()).result;
  } catch (e) {
    return Promise.reject(e);
  }

  if (delegation) {
    result.scores = strategies.map((strategy, i) => {
      const scoresByStrategy: any = {};
      addresses.forEach((address) => {
        scoresByStrategy[address] = 0;
        if (!delegations[address].out) scoresByStrategy[address] += result.scores[i][address] || 0;
        delegations[address].in.forEach(
          (delegationIn) => (scoresByStrategy[address] += result.scores[i][delegationIn] || 0)
        );
      });
      return Object.fromEntries(
        Object.entries(scoresByStrategy).filter(([, score]: any[]) => score > 0)
      );
    });
  }
  return result;
}
