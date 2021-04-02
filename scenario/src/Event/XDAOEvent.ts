import { Event } from '../Event';
import { addAction, World, describeUser } from '../World';
import { XDAO, XDAOScenario } from '../Contract/XDAO';
import { buildXDAO } from '../Builder/XDAOBuilder';
import { invoke } from '../Invokation';
import {
  getAddressV,
  getEventV,
  getNumberV,
  getStringV,
} from '../CoreValue';
import {
  AddressV,
  EventV,
  NumberV,
  StringV
} from '../Value';
import { Arg, Command, processCommandEvent, View } from '../Command';
import { getXDAO } from '../ContractLookup';
import { NoErrorReporter } from '../ErrorReporter';
import { verify } from '../Verify';
import { encodedNumber } from '../Encoding';

async function genXDAO(world: World, from: string, params: Event): Promise<World> {
  let { world: nextWorld, sxp, tokenData } = await buildXDAO(world, from, params);
  world = nextWorld;

  world = addAction(
    world,
    `Deployed XDAO (${sxp.name}) to address ${sxp._address}`,
    tokenData.invokation
  );

  return world;
}

async function verifyXDAO(world: World, sxp: XDAO, apiKey: string, modelName: string, contractName: string): Promise<World> {
  if (world.isLocalNetwork()) {
    world.printer.printLine(`Politely declining to verify on local network: ${world.network}.`);
  } else {
    await verify(world, apiKey, modelName, contractName, sxp._address);
  }

  return world;
}

async function approve(world: World, from: string, sxp: XDAO, address: string, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, sxp.methods.approve(address, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `Approved XDAO token for ${from} of ${amount.show()}`,
    invokation
  );

  return world;
}

async function transfer(world: World, from: string, sxp: XDAO, address: string, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, sxp.methods.transfer(address, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `Transferred ${amount.show()} XDAO tokens from ${from} to ${address}`,
    invokation
  );

  return world;
}

async function transferFrom(world: World, from: string, sxp: XDAO, owner: string, spender: string, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, sxp.methods.transferFrom(owner, spender, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `"Transferred from" ${amount.show()} XDAO tokens from ${owner} to ${spender}`,
    invokation
  );

  return world;
}

async function transferScenario(world: World, from: string, sxp: XDAOScenario, addresses: string[], amount: NumberV): Promise<World> {
  let invokation = await invoke(world, sxp.methods.transferScenario(addresses, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `Transferred ${amount.show()} XDAO tokens from ${from} to ${addresses}`,
    invokation
  );

  return world;
}

async function transferFromScenario(world: World, from: string, sxp: XDAOScenario, addresses: string[], amount: NumberV): Promise<World> {
  let invokation = await invoke(world, sxp.methods.transferFromScenario(addresses, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `Transferred ${amount.show()} XDAO tokens from ${addresses} to ${from}`,
    invokation
  );

  return world;
}

async function delegate(world: World, from: string, sxp: XDAO, account: string): Promise<World> {
  let invokation = await invoke(world, sxp.methods.delegate(account), from, NoErrorReporter);

  world = addAction(
    world,
    `"Delegated from" ${from} to ${account}`,
    invokation
  );

  return world;
}

async function setBlockNumber(
  world: World,
  from: string,
  sxp: XDAO,
  blockNumber: NumberV
): Promise<World> {
  return addAction(
    world,
    `Set XDAO blockNumber to ${blockNumber.show()}`,
    await invoke(world, sxp.methods.setBlockNumber(blockNumber.encode()), from)
  );
}

export function sxpCommands() {
  return [
    new Command<{ params: EventV }>(`
        #### Deploy

        * "Deploy ...params" - Generates a new XDAO token
          * E.g. "XDAO Deploy"
      `,
      "Deploy",
      [
        new Arg("params", getEventV, { variadic: true })
      ],
      (world, from, { params }) => genXDAO(world, from, params.val)
    ),

    new View<{ sxp: XDAO, apiKey: StringV, contractName: StringV }>(`
        #### Verify

        * "<XDAO> Verify apiKey:<String> contractName:<String>=XDAO" - Verifies XDAO token in BscScan
          * E.g. "XDAO Verify "myApiKey"
      `,
      "Verify",
      [
        new Arg("sxp", getXDAO, { implicit: true }),
        new Arg("apiKey", getStringV),
        new Arg("contractName", getStringV, { default: new StringV("XDAO") })
      ],
      async (world, { sxp, apiKey, contractName }) => {
        return await verifyXDAO(world, sxp, apiKey.val, sxp.name, contractName.val)
      }
    ),

    new Command<{ sxp: XDAO, spender: AddressV, amount: NumberV }>(`
        #### Approve

        * "XDAO Approve spender:<Address> <Amount>" - Adds an allowance between user and address
          * E.g. "XDAO Approve Geoff 1.0e18"
      `,
      "Approve",
      [
        new Arg("sxp", getXDAO, { implicit: true }),
        new Arg("spender", getAddressV),
        new Arg("amount", getNumberV)
      ],
      (world, from, { sxp, spender, amount }) => {
        return approve(world, from, sxp, spender.val, amount)
      }
    ),

    new Command<{ sxp: XDAO, recipient: AddressV, amount: NumberV }>(`
        #### Transfer

        * "XDAO Transfer recipient:<User> <Amount>" - Transfers a number of tokens via "transfer" as given user to recipient (this does not depend on allowance)
          * E.g. "XDAO Transfer Torrey 1.0e18"
      `,
      "Transfer",
      [
        new Arg("sxp", getXDAO, { implicit: true }),
        new Arg("recipient", getAddressV),
        new Arg("amount", getNumberV)
      ],
      (world, from, { sxp, recipient, amount }) => transfer(world, from, sxp, recipient.val, amount)
    ),

    new Command<{ sxp: XDAO, owner: AddressV, spender: AddressV, amount: NumberV }>(`
        #### TransferFrom

        * "XDAO TransferFrom owner:<User> spender:<User> <Amount>" - Transfers a number of tokens via "transfeFrom" to recipient (this depends on allowances)
          * E.g. "XDAO TransferFrom Geoff Torrey 1.0e18"
      `,
      "TransferFrom",
      [
        new Arg("sxp", getXDAO, { implicit: true }),
        new Arg("owner", getAddressV),
        new Arg("spender", getAddressV),
        new Arg("amount", getNumberV)
      ],
      (world, from, { sxp, owner, spender, amount }) => transferFrom(world, from, sxp, owner.val, spender.val, amount)
    ),

    new Command<{ sxp: XDAOScenario, recipients: AddressV[], amount: NumberV }>(`
        #### TransferScenario

        * "XDAO TransferScenario recipients:<User[]> <Amount>" - Transfers a number of tokens via "transfer" to the given recipients (this does not depend on allowance)
          * E.g. "XDAO TransferScenario (Jared Torrey) 10"
      `,
      "TransferScenario",
      [
        new Arg("sxp", getXDAO, { implicit: true }),
        new Arg("recipients", getAddressV, { mapped: true }),
        new Arg("amount", getNumberV)
      ],
      (world, from, { sxp, recipients, amount }) => transferScenario(world, from, sxp, recipients.map(recipient => recipient.val), amount)
    ),

    new Command<{ sxp: XDAOScenario, froms: AddressV[], amount: NumberV }>(`
        #### TransferFromScenario

        * "XDAO TransferFromScenario froms:<User[]> <Amount>" - Transfers a number of tokens via "transferFrom" from the given users to msg.sender (this depends on allowance)
          * E.g. "XDAO TransferFromScenario (Jared Torrey) 10"
      `,
      "TransferFromScenario",
      [
        new Arg("sxp", getXDAO, { implicit: true }),
        new Arg("froms", getAddressV, { mapped: true }),
        new Arg("amount", getNumberV)
      ],
      (world, from, { sxp, froms, amount }) => transferFromScenario(world, from, sxp, froms.map(_from => _from.val), amount)
    ),

    new Command<{ sxp: XDAO, account: AddressV }>(`
        #### Delegate

        * "XDAO Delegate account:<Address>" - Delegates votes to a given account
          * E.g. "XDAO Delegate Torrey"
      `,
      "Delegate",
      [
        new Arg("sxp", getXDAO, { implicit: true }),
        new Arg("account", getAddressV),
      ],
      (world, from, { sxp, account }) => delegate(world, from, sxp, account.val)
    ),
    new Command<{ sxp: XDAO, blockNumber: NumberV }>(`
      #### SetBlockNumber

      * "SetBlockNumber <Seconds>" - Sets the blockTimestamp of the XDAO Harness
      * E.g. "XDAO SetBlockNumber 500"
      `,
        'SetBlockNumber',
        [new Arg('sxp', getXDAO, { implicit: true }), new Arg('blockNumber', getNumberV)],
        (world, from, { sxp, blockNumber }) => setBlockNumber(world, from, sxp, blockNumber)
      )
  ];
}

export async function processXDAOEvent(world: World, event: Event, from: string | null): Promise<World> {
  return await processCommandEvent<any>("XDAO", sxpCommands(), world, event, from);
}
