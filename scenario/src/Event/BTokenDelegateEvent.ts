import { Event } from '../Event';
import { addAction, describeUser, World } from '../World';
import { decodeCall, getPastEvents } from '../Contract';
import { BToken, BTokenScenario } from '../Contract/BToken';
import { BBep20Delegate } from '../Contract/BBep20Delegate'
import { invoke, Sendable } from '../Invokation';
import {
  getAddressV,
  getEventV,
  getExpNumberV,
  getNumberV,
  getStringV,
  getBoolV
} from '../CoreValue';
import {
  AddressV,
  BoolV,
  EventV,
  NothingV,
  NumberV,
  StringV
} from '../Value';
import { Arg, Command, View, processCommandEvent } from '../Command';
import { getBTokenDelegateData } from '../ContractLookup';
import { buildBTokenDelegate } from '../Builder/BTokenDelegateBuilder';
import { verify } from '../Verify';

async function genBTokenDelegate(world: World, from: string, event: Event): Promise<World> {
  let { world: nextWorld, bTokenDelegate, delegateData } = await buildBTokenDelegate(world, from, event);
  world = nextWorld;

  world = addAction(
    world,
    `Added bToken ${delegateData.name} (${delegateData.contract}) at address ${bTokenDelegate._address}`,
    delegateData.invokation
  );

  return world;
}

async function verifyBTokenDelegate(world: World, bTokenDelegate: BBep20Delegate, name: string, contract: string, apiKey: string): Promise<World> {
  if (world.isLocalNetwork()) {
    world.printer.printLine(`Politely declining to verify on local network: ${world.network}.`);
  } else {
    await verify(world, apiKey, name, contract, bTokenDelegate._address);
  }

  return world;
}

export function bTokenDelegateCommands() {
  return [
    new Command<{ bTokenDelegateParams: EventV }>(`
        #### Deploy

        * "BTokenDelegate Deploy ...bTokenDelegateParams" - Generates a new BTokenDelegate
          * E.g. "BTokenDelegate Deploy BDaiDelegate vDAIDelegate"
      `,
      "Deploy",
      [new Arg("bTokenDelegateParams", getEventV, { variadic: true })],
      (world, from, { bTokenDelegateParams }) => genBTokenDelegate(world, from, bTokenDelegateParams.val)
    ),
    new View<{ bTokenDelegateArg: StringV, apiKey: StringV }>(`
        #### Verify

        * "BTokenDelegate <bTokenDelegate> Verify apiKey:<String>" - Verifies BTokenDelegate in BscScan
          * E.g. "BTokenDelegate vDaiDelegate Verify "myApiKey"
      `,
      "Verify",
      [
        new Arg("bTokenDelegateArg", getStringV),
        new Arg("apiKey", getStringV)
      ],
      async (world, { bTokenDelegateArg, apiKey }) => {
        let [bToken, name, data] = await getBTokenDelegateData(world, bTokenDelegateArg.val);

        return await verifyBTokenDelegate(world, bToken, name, data.get('contract')!, apiKey.val);
      },
      { namePos: 1 }
    ),
  ];
}

export async function processBTokenDelegateEvent(world: World, event: Event, from: string | null): Promise<World> {
  return await processCommandEvent<any>("BTokenDelegate", bTokenDelegateCommands(), world, event, from);
}
