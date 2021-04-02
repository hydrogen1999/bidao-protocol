import { Event } from '../Event';
import { World } from '../World';
import { BBep20Delegate, BBep20DelegateScenario } from '../Contract/BBep20Delegate';
import { BToken } from '../Contract/BToken';
import { Invokation } from '../Invokation';
import { getStringV } from '../CoreValue';
import { AddressV, NumberV, StringV } from '../Value';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import { storeAndSaveContract } from '../Networks';
import { getContract, getTestContract } from '../Contract';

const BDaiDelegateContract = getContract('BDaiDelegate');
const BDaiDelegateScenarioContract = getTestContract('BDaiDelegateScenario');
const BBep20DelegateContract = getContract('BBep20Delegate');
const BBep20DelegateScenarioContract = getTestContract('BBep20DelegateScenario');


export interface BTokenDelegateData {
  invokation: Invokation<BBep20Delegate>;
  name: string;
  contract: string;
  description?: string;
}

export async function buildBTokenDelegate(
  world: World,
  from: string,
  params: Event
): Promise<{ world: World; bTokenDelegate: BBep20Delegate; delegateData: BTokenDelegateData }> {
  const fetchers = [
    new Fetcher<{ name: StringV; }, BTokenDelegateData>(
      `
        #### BDaiDelegate

        * "BDaiDelegate name:<String>"
          * E.g. "BTokenDelegate Deploy BDaiDelegate vDAIDelegate"
      `,
      'BDaiDelegate',
      [
        new Arg('name', getStringV)
      ],
      async (
        world,
        { name }
      ) => {
        return {
          invokation: await BDaiDelegateContract.deploy<BBep20Delegate>(world, from, []),
          name: name.val,
          contract: 'BDaiDelegate',
          description: 'Standard VDai Delegate'
        };
      }
    ),

    new Fetcher<{ name: StringV; }, BTokenDelegateData>(
      `
        #### BDaiDelegateScenario

        * "BDaiDelegateScenario name:<String>" - A BDaiDelegate Scenario for local testing
          * E.g. "BTokenDelegate Deploy BDaiDelegateScenario vDAIDelegate"
      `,
      'BDaiDelegateScenario',
      [
        new Arg('name', getStringV)
      ],
      async (
        world,
        { name }
      ) => {
        return {
          invokation: await BDaiDelegateScenarioContract.deploy<BBep20DelegateScenario>(world, from, []),
          name: name.val,
          contract: 'BDaiDelegateScenario',
          description: 'Scenario VDai Delegate'
        };
      }
    ),

    new Fetcher<{ name: StringV; }, BTokenDelegateData>(
      `
        #### BBep20Delegate

        * "BBep20Delegate name:<String>"
          * E.g. "BTokenDelegate Deploy BBep20Delegate vDAIDelegate"
      `,
      'BBep20Delegate',
      [
        new Arg('name', getStringV)
      ],
      async (
        world,
        { name }
      ) => {
        return {
          invokation: await BBep20DelegateContract.deploy<BBep20Delegate>(world, from, []),
          name: name.val,
          contract: 'BBep20Delegate',
          description: 'Standard BBep20 Delegate'
        };
      }
    ),

    new Fetcher<{ name: StringV; }, BTokenDelegateData>(
      `
        #### BBep20DelegateScenario

        * "BBep20DelegateScenario name:<String>" - A BBep20Delegate Scenario for local testing
          * E.g. "BTokenDelegate Deploy BBep20DelegateScenario vDAIDelegate"
      `,
      'BBep20DelegateScenario',
      [
        new Arg('name', getStringV),
      ],
      async (
        world,
        { name }
      ) => {
        return {
          invokation: await BBep20DelegateScenarioContract.deploy<BBep20DelegateScenario>(world, from, []),
          name: name.val,
          contract: 'BBep20DelegateScenario',
          description: 'Scenario BBep20 Delegate'
        };
      }
    )
  ];

  let delegateData = await getFetcherValue<any, BTokenDelegateData>("DeployBToken", fetchers, world, params);
  let invokation = delegateData.invokation;
  delete delegateData.invokation;

  if (invokation.error) {
    throw invokation.error;
  }

  const bTokenDelegate = invokation.value!;

  world = await storeAndSaveContract(
    world,
    bTokenDelegate,
    delegateData.name,
    invokation,
    [
      {
        index: ['BTokenDelegate', delegateData.name],
        data: {
          address: bTokenDelegate._address,
          contract: delegateData.contract,
          description: delegateData.description
        }
      }
    ]
  );

  return { world, bTokenDelegate, delegateData };
}
