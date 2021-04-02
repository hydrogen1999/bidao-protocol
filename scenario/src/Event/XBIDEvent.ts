import { Event } from '../Event';
import { addAction, World, describeUser } from '../World';
import { XBID, XBIDScenario } from '../Contract/XBID';
import { buildXBID } from '../Builder/XBIDBuilder';
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
import { getXBID } from '../ContractLookup';
import { NoErrorReporter } from '../ErrorReporter';
import { verify } from '../Verify';
import { encodedNumber } from '../Encoding';

async function genXBID(world: World, from: string, params: Event): Promise<World> {
  let { world: nextWorld, xvs, tokenData } = await buildXBID(world, from, params);
  world = nextWorld;

  world = addAction(
    world,
    `Deployed XBID (${xvs.name}) to address ${xvs._address}`,
    tokenData.invokation
  );

  return world;
}

async function verifyXBID(world: World, xvs: XBID, apiKey: string, modelName: string, contractName: string): Promise<World> {
  if (world.isLocalNetwork()) {
    world.printer.printLine(`Politely declining to verify on local network: ${world.network}.`);
  } else {
    await verify(world, apiKey, modelName, contractName, xvs._address);
  }

  return world;
}

async function approve(world: World, from: string, xvs: XBID, address: string, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, xvs.methods.approve(address, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `Approved XBID token for ${from} of ${amount.show()}`,
    invokation
  );

  return world;
}

async function transfer(world: World, from: string, xvs: XBID, address: string, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, xvs.methods.transfer(address, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `Transferred ${amount.show()} XBID tokens from ${from} to ${address}`,
    invokation
  );

  return world;
}

async function transferFrom(world: World, from: string, xvs: XBID, owner: string, spender: string, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, xvs.methods.transferFrom(owner, spender, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `"Transferred from" ${amount.show()} XBID tokens from ${owner} to ${spender}`,
    invokation
  );

  return world;
}

async function transferScenario(world: World, from: string, xvs: XBIDScenario, addresses: string[], amount: NumberV): Promise<World> {
  let invokation = await invoke(world, xvs.methods.transferScenario(addresses, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `Transferred ${amount.show()} XBID tokens from ${from} to ${addresses}`,
    invokation
  );

  return world;
}

async function transferFromScenario(world: World, from: string, xvs: XBIDScenario, addresses: string[], amount: NumberV): Promise<World> {
  let invokation = await invoke(world, xvs.methods.transferFromScenario(addresses, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `Transferred ${amount.show()} XBID tokens from ${addresses} to ${from}`,
    invokation
  );

  return world;
}

async function delegate(world: World, from: string, xvs: XBID, account: string): Promise<World> {
  let invokation = await invoke(world, xvs.methods.delegate(account), from, NoErrorReporter);

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
  xvs: XBID,
  blockNumber: NumberV
): Promise<World> {
  return addAction(
    world,
    `Set XBID blockNumber to ${blockNumber.show()}`,
    await invoke(world, xvs.methods.setBlockNumber(blockNumber.encode()), from)
  );
}

export function xvsCommands() {
  return [
    new Command<{ params: EventV }>(`
        #### Deploy

        * "Deploy ...params" - Generates a new XBID token
          * E.g. "XBID Deploy"
      `,
      "Deploy",
      [
        new Arg("params", getEventV, { variadic: true })
      ],
      (world, from, { params }) => genXBID(world, from, params.val)
    ),

    new View<{ xvs: XBID, apiKey: StringV, contractName: StringV }>(`
        #### Verify

        * "<XBID> Verify apiKey:<String> contractName:<String>=XBID" - Verifies XBID token in BscScan
          * E.g. "XBID Verify "myApiKey"
      `,
      "Verify",
      [
        new Arg("xvs", getXBID, { implicit: true }),
        new Arg("apiKey", getStringV),
        new Arg("contractName", getStringV, { default: new StringV("XBID") })
      ],
      async (world, { xvs, apiKey, contractName }) => {
        return await verifyXBID(world, xvs, apiKey.val, xvs.name, contractName.val)
      }
    ),

    new Command<{ xvs: XBID, spender: AddressV, amount: NumberV }>(`
        #### Approve

        * "XBID Approve spender:<Address> <Amount>" - Adds an allowance between user and address
          * E.g. "XBID Approve Geoff 1.0e18"
      `,
      "Approve",
      [
        new Arg("xvs", getXBID, { implicit: true }),
        new Arg("spender", getAddressV),
        new Arg("amount", getNumberV)
      ],
      (world, from, { xvs, spender, amount }) => {
        return approve(world, from, xvs, spender.val, amount)
      }
    ),

    new Command<{ xvs: XBID, recipient: AddressV, amount: NumberV }>(`
        #### Transfer

        * "XBID Transfer recipient:<User> <Amount>" - Transfers a number of tokens via "transfer" as given user to recipient (this does not depend on allowance)
          * E.g. "XBID Transfer Torrey 1.0e18"
      `,
      "Transfer",
      [
        new Arg("xvs", getXBID, { implicit: true }),
        new Arg("recipient", getAddressV),
        new Arg("amount", getNumberV)
      ],
      (world, from, { xvs, recipient, amount }) => transfer(world, from, xvs, recipient.val, amount)
    ),

    new Command<{ xvs: XBID, owner: AddressV, spender: AddressV, amount: NumberV }>(`
        #### TransferFrom

        * "XBID TransferFrom owner:<User> spender:<User> <Amount>" - Transfers a number of tokens via "transfeFrom" to recipient (this depends on allowances)
          * E.g. "XBID TransferFrom Geoff Torrey 1.0e18"
      `,
      "TransferFrom",
      [
        new Arg("xvs", getXBID, { implicit: true }),
        new Arg("owner", getAddressV),
        new Arg("spender", getAddressV),
        new Arg("amount", getNumberV)
      ],
      (world, from, { xvs, owner, spender, amount }) => transferFrom(world, from, xvs, owner.val, spender.val, amount)
    ),

    new Command<{ xvs: XBIDScenario, recipients: AddressV[], amount: NumberV }>(`
        #### TransferScenario

        * "XBID TransferScenario recipients:<User[]> <Amount>" - Transfers a number of tokens via "transfer" to the given recipients (this does not depend on allowance)
          * E.g. "XBID TransferScenario (Jared Torrey) 10"
      `,
      "TransferScenario",
      [
        new Arg("xvs", getXBID, { implicit: true }),
        new Arg("recipients", getAddressV, { mapped: true }),
        new Arg("amount", getNumberV)
      ],
      (world, from, { xvs, recipients, amount }) => transferScenario(world, from, xvs, recipients.map(recipient => recipient.val), amount)
    ),

    new Command<{ xvs: XBIDScenario, froms: AddressV[], amount: NumberV }>(`
        #### TransferFromScenario

        * "XBID TransferFromScenario froms:<User[]> <Amount>" - Transfers a number of tokens via "transferFrom" from the given users to msg.sender (this depends on allowance)
          * E.g. "XBID TransferFromScenario (Jared Torrey) 10"
      `,
      "TransferFromScenario",
      [
        new Arg("xvs", getXBID, { implicit: true }),
        new Arg("froms", getAddressV, { mapped: true }),
        new Arg("amount", getNumberV)
      ],
      (world, from, { xvs, froms, amount }) => transferFromScenario(world, from, xvs, froms.map(_from => _from.val), amount)
    ),

    new Command<{ xvs: XBID, account: AddressV }>(`
        #### Delegate

        * "XBID Delegate account:<Address>" - Delegates votes to a given account
          * E.g. "XBID Delegate Torrey"
      `,
      "Delegate",
      [
        new Arg("xvs", getXBID, { implicit: true }),
        new Arg("account", getAddressV),
      ],
      (world, from, { xvs, account }) => delegate(world, from, xvs, account.val)
    ),
    new Command<{ xvs: XBID, blockNumber: NumberV }>(`
      #### SetBlockNumber

      * "SetBlockNumber <Seconds>" - Sets the blockTimestamp of the XBID Harness
      * E.g. "XBID SetBlockNumber 500"
      `,
        'SetBlockNumber',
        [new Arg('xvs', getXBID, { implicit: true }), new Arg('blockNumber', getNumberV)],
        (world, from, { xvs, blockNumber }) => setBlockNumber(world, from, xvs, blockNumber)
      )
  ];
}

export async function processXBIDEvent(world: World, event: Event, from: string | null): Promise<World> {
  return await processCommandEvent<any>("XBID", xvsCommands(), world, event, from);
}
