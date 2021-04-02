import { Event } from '../Event';
import { World, addAction } from '../World';
import { BAI, BAIScenario } from '../Contract/BAI';
import { Invokation } from '../Invokation';
import { getAddressV } from '../CoreValue';
import { StringV, AddressV } from '../Value';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import { storeAndSaveContract } from '../Networks';
import { getContract } from '../Contract';

const BAIContract = getContract('BAI');
const BAIScenarioContract = getContract('BAIScenario');

export interface TokenData {
  invokation: Invokation<BAI>;
  contract: string;
  address?: string;
  symbol: string;
  name: string;
  decimals?: number;
}

export async function buildBAI(
  world: World,
  from: string,
  params: Event
): Promise<{ world: World; vai: BAI; tokenData: TokenData }> {
  const fetchers = [
    new Fetcher<{ account: AddressV }, TokenData>(
      `
      #### Scenario

      * "BAI Deploy Scenario account:<Address>" - Deploys Scenario BAI Token
        * E.g. "BAI Deploy Scenario Geoff"
    `,
      'Scenario',
      [
        new Arg("account", getAddressV),
      ],
      async (world, { account }) => {
        return {
          invokation: await BAIScenarioContract.deploy<BAIScenario>(world, from, [account.val]),
          contract: 'BAIScenario',
          symbol: 'BAI',
          name: 'BAI Stablecoin',
          decimals: 18
        };
      }
    ),

    new Fetcher<{ account: AddressV }, TokenData>(
      `
      #### BAI

      * "BAI Deploy account:<Address>" - Deploys BAI Token
        * E.g. "BAI Deploy Geoff"
    `,
      'BAI',
      [
        new Arg("account", getAddressV),
      ],
      async (world, { account }) => {
        if (world.isLocalNetwork()) {
          return {
            invokation: await BAIScenarioContract.deploy<BAIScenario>(world, from, [account.val]),
            contract: 'BAIScenario',
            symbol: 'BAI',
            name: 'BAI Stablecoin',
            decimals: 18
          };
        } else {
          return {
            invokation: await BAIContract.deploy<BAI>(world, from, [account.val]),
            contract: 'BAI',
            symbol: 'BAI',
            name: 'BAI Stablecoin',
            decimals: 18
          };
        }
      },
      { catchall: true }
    )
  ];

  let tokenData = await getFetcherValue<any, TokenData>("DeployBAI", fetchers, world, params);
  let invokation = tokenData.invokation;
  delete tokenData.invokation;

  if (invokation.error) {
    throw invokation.error;
  }

  const vai = invokation.value!;
  tokenData.address = vai._address;

  world = await storeAndSaveContract(
    world,
    vai,
    'BAI',
    invokation,
    [
      { index: ['BAI'], data: tokenData },
      { index: ['Tokens', tokenData.symbol], data: tokenData }
    ]
  );

  tokenData.invokation = invokation;

  return { world, vai, tokenData };
}
