import { Event } from '../Event';
import { World, addAction } from '../World';
import { XBID, XBIDScenario } from '../Contract/XBID';
import { Invokation } from '../Invokation';
import { getAddressV } from '../CoreValue';
import { StringV, AddressV } from '../Value';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import { storeAndSaveContract } from '../Networks';
import { getContract } from '../Contract';

const XBIDContract = getContract('XBID');
const XBIDScenarioContract = getContract('XBIDScenario');

export interface TokenData {
  invokation: Invokation<XBID>;
  contract: string;
  address?: string;
  symbol: string;
  name: string;
  decimals?: number;
}

export async function buildXBID(
  world: World,
  from: string,
  params: Event
): Promise<{ world: World; xvs: XBID; tokenData: TokenData }> {
  const fetchers = [
    new Fetcher<{ account: AddressV }, TokenData>(
      `
      #### Scenario

      * "XBID Deploy Scenario account:<Address>" - Deploys Scenario XBID Token
        * E.g. "XBID Deploy Scenario Geoff"
    `,
      'Scenario',
      [
        new Arg("account", getAddressV),
      ],
      async (world, { account }) => {
        return {
          invokation: await XBIDScenarioContract.deploy<XBIDScenario>(world, from, [account.val]),
          contract: 'XBIDScenario',
          symbol: 'XBID',
          name: 'Bai Governance Token',
          decimals: 18
        };
      }
    ),

    new Fetcher<{ account: AddressV }, TokenData>(
      `
      #### XBID

      * "XBID Deploy account:<Address>" - Deploys XBID Token
        * E.g. "XBID Deploy Geoff"
    `,
      'XBID',
      [
        new Arg("account", getAddressV),
      ],
      async (world, { account }) => {
        if (world.isLocalNetwork()) {
          return {
            invokation: await XBIDScenarioContract.deploy<XBIDScenario>(world, from, [account.val]),
            contract: 'XBIDScenario',
            symbol: 'XBID',
            name: 'Bai Governance Token',
            decimals: 18
          };
        } else {
          return {
            invokation: await XBIDContract.deploy<XBID>(world, from, [account.val]),
            contract: 'XBID',
            symbol: 'XBID',
            name: 'Bai Governance Token',
            decimals: 18
          };
        }
      },
      { catchall: true }
    )
  ];

  let tokenData = await getFetcherValue<any, TokenData>("DeployXBID", fetchers, world, params);
  let invokation = tokenData.invokation;
  delete tokenData.invokation;

  if (invokation.error) {
    throw invokation.error;
  }

  const xvs = invokation.value!;
  tokenData.address = xvs._address;

  world = await storeAndSaveContract(
    world,
    xvs,
    'XBID',
    invokation,
    [
      { index: ['XBID'], data: tokenData },
      { index: ['Tokens', tokenData.symbol], data: tokenData }
    ]
  );

  tokenData.invokation = invokation;

  return { world, xvs, tokenData };
}
