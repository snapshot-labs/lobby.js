import { getSpaceDelegations, getSpaceDelegationsIn, getSpaceDelegationsOut } from '../src';
import addresses from './addresses.json';

const space = 'cvx.eth';
const network = '1';
const snapshot = 14780000;

describe('', () => {
  it('getSpaceDelegations()', async () => {
    const delegations = await getSpaceDelegations(space, addresses, network, snapshot);
    expect(delegations).toMatchSnapshot();
  }, 30e3);

  it('getSpaceDelegationsIn()', async () => {
    const delegationsIn = await getSpaceDelegationsIn(space, addresses, network, snapshot);
    expect(delegationsIn).toMatchSnapshot();
  }, 30e3);

  it('getSpaceDelegationsOut()', async () => {
    const delegationsOut = await getSpaceDelegationsOut(space, addresses, network, snapshot);
    expect(delegationsOut).toMatchSnapshot();
  }, 30e3);
});
