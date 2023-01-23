import {
  getSpaceDelegationsIn,
  getSpaceDelegationsOut,
  getSpaceDelegations,
  getScores
} from '../src';
import addresses from './addresses.json';

const space = 'cvx.eth';
const network = '1';
const snapshot = 14780000;
const strategies = [
  {
    name: 'erc20-balance-of',
    params: {
      symbol: 'CVX',
      address: '0x72a19342e8F1838460eBFCCEf09F6585e32db86E',
      decimals: 18
    }
  },
  {
    name: 'eth-balance',
    params: {}
  }
];

describe('', () => {
  it('getSpaceDelegationsIn()', async () => {
    const delegationsIn = await getSpaceDelegationsIn(space, addresses, network, snapshot);
    expect(delegationsIn).toMatchSnapshot();
  }, 30e3);

  it('getSpaceDelegationsOut()', async () => {
    const delegationsOut = await getSpaceDelegationsOut(space, addresses, network, snapshot);
    expect(delegationsOut).toMatchSnapshot();
  }, 30e3);

  it('getSpaceDelegations()', async () => {
    const delegations = await getSpaceDelegations(space, addresses, network, snapshot);
    expect(delegations).toMatchSnapshot();
  }, 30e3);

  it('getScores() with delegation', async () => {
    const scores = await getScores(space, strategies, network, addresses, snapshot, true);
    expect(scores).toMatchSnapshot();
  }, 30e3);

  it('getScores() without delegation', async () => {
    const scores = await getScores(space, strategies, network, addresses, snapshot, false);
    expect(scores).toMatchSnapshot();
  }, 30e3);
});
