import { Event } from '../Event';
import { World, addAction } from '../World';
import { XDAO, XDAOScenario } from '../Contract/XDAO';
import { Invokation } from '../Invokation';
import { getAddressV } from '../CoreValue';
import { StringV, AddressV } from '../Value';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import { storeAndSaveContract } from '../Networks';
import { getContract } from '../Contract';

const XDAOContract = getContract('XDAO');
const XDAOScenarioContract = getContract('XDAOScenario');

export interface TokenData {
  invokation: Invokation<XDAO>;
  contract: string;
  address?: string;
  symbol: string;
  name: string;
  decimals?: number;
}

export async function buildXDAO(
  world: World,
  from: string,
  params: Event
): Promise<{ world: World; sxp: XDAO; tokenData: TokenData }> {
  const fetchers = [
    new Fetcher<{ account: AddressV }, TokenData>(
      `
      #### Scenario

      * "XDAO Deploy Scenario account:<Address>" - Deploys Scenario XDAO Token
        * E.g. "XDAO Deploy Scenario Geoff"
    `,
      'Scenario',
      [
        new Arg("account", getAddressV),
      ],
      async (world, { account }) => {
        return {
          invokation: await XDAOScenarioContract.deploy<XDAOScenario>(world, from, [account.val]),
          contract: 'XDAOScenario',
          symbol: 'XDAO',
          name: 'Bai Governance Token',
          decimals: 18
        };
      }
    ),

    new Fetcher<{ account: AddressV }, TokenData>(
      `
      #### XDAO

      * "XDAO Deploy account:<Address>" - Deploys XDAO Token
        * E.g. "XDAO Deploy Geoff"
    `,
      'XDAO',
      [
        new Arg("account", getAddressV),
      ],
      async (world, { account }) => {
        if (world.isLocalNetwork()) {
          return {
            invokation: await XDAOScenarioContract.deploy<XDAOScenario>(world, from, [account.val]),
            contract: 'XDAOScenario',
            symbol: 'XDAO',
            name: 'Bai Governance Token',
            decimals: 18
          };
        } else {
          return {
            invokation: await XDAOContract.deploy<XDAO>(world, from, [account.val]),
            contract: 'XDAO',
            symbol: 'XDAO',
            name: 'Bai Governance Token',
            decimals: 18
          };
        }
      },
      { catchall: true }
    )
  ];

  let tokenData = await getFetcherValue<any, TokenData>("DeployXDAO", fetchers, world, params);
  let invokation = tokenData.invokation;
  delete tokenData.invokation;

  if (invokation.error) {
    throw invokation.error;
  }

  const sxp = invokation.value!;
  tokenData.address = sxp._address;

  world = await storeAndSaveContract(
    world,
    sxp,
    'XDAO',
    invokation,
    [
      { index: ['XDAO'], data: tokenData },
      { index: ['Tokens', tokenData.symbol], data: tokenData }
    ]
  );

  tokenData.invokation = invokation;

  return { world, sxp, tokenData };
}
