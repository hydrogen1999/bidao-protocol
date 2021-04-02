import { Event } from '../Event';
import { addAction, World, describeUser } from '../World';
import { BAI, BAIScenario } from '../Contract/BAI';
import { buildBAI } from '../Builder/BAIBuilder';
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
import { getBAI } from '../ContractLookup';
import { NoErrorReporter } from '../ErrorReporter';
import { verify } from '../Verify';
import { encodedNumber } from '../Encoding';

async function genBAI(world: World, from: string, params: Event): Promise<World> {
  let { world: nextWorld, vai, tokenData } = await buildBAI(world, from, params);
  world = nextWorld;

  world = addAction(
    world,
    `Deployed BAI (${vai.name}) to address ${vai._address}`,
    tokenData.invokation
  );

  return world;
}

async function verifyBAI(world: World, vai: BAI, apiKey: string, modelName: string, contractName: string): Promise<World> {
  if (world.isLocalNetwork()) {
    world.printer.printLine(`Politely declining to verify on local network: ${world.network}.`);
  } else {
    await verify(world, apiKey, modelName, contractName, vai._address);
  }

  return world;
}

async function approve(world: World, from: string, vai: BAI, address: string, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, vai.methods.approve(address, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `Approved BAI token for ${from} of ${amount.show()}`,
    invokation
  );

  return world;
}

async function transfer(world: World, from: string, vai: BAI, address: string, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, vai.methods.transfer(address, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `Transferred ${amount.show()} BAI tokens from ${from} to ${address}`,
    invokation
  );

  return world;
}

async function transferFrom(world: World, from: string, vai: BAI, owner: string, spender: string, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, vai.methods.transferFrom(owner, spender, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `"Transferred from" ${amount.show()} BAI tokens from ${owner} to ${spender}`,
    invokation
  );

  return world;
}

async function transferScenario(world: World, from: string, vai: BAIScenario, addresses: string[], amount: NumberV): Promise<World> {
  let invokation = await invoke(world, vai.methods.transferScenario(addresses, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `Transferred ${amount.show()} BAI tokens from ${from} to ${addresses}`,
    invokation
  );

  return world;
}

async function transferFromScenario(world: World, from: string, vai: BAIScenario, addresses: string[], amount: NumberV): Promise<World> {
  let invokation = await invoke(world, vai.methods.transferFromScenario(addresses, amount.encode()), from, NoErrorReporter);

  world = addAction(
    world,
    `Transferred ${amount.show()} BAI tokens from ${addresses} to ${from}`,
    invokation
  );

  return world;
}

export function vaiCommands() {
  return [
    new Command<{ params: EventV }>(`
        #### Deploy

        * "Deploy ...params" - Generates a new BAI token
          * E.g. "BAI Deploy"
      `,
      "Deploy",
      [
        new Arg("params", getEventV, { variadic: true })
      ],
      (world, from, { params }) => genBAI(world, from, params.val)
    ),

    new View<{ vai: BAI, apiKey: StringV, contractName: StringV }>(`
        #### Verify

        * "<BAI> Verify apiKey:<String> contractName:<String>=BAI" - Verifies BAI token in BscScan
          * E.g. "BAI Verify "myApiKey"
      `,
      "Verify",
      [
        new Arg("vai", getBAI, { implicit: true }),
        new Arg("apiKey", getStringV),
        new Arg("contractName", getStringV, { default: new StringV("BAI") })
      ],
      async (world, { vai, apiKey, contractName }) => {
        return await verifyBAI(world, vai, apiKey.val, vai.name, contractName.val)
      }
    ),

    new Command<{ vai: BAI, spender: AddressV, amount: NumberV }>(`
        #### Approve

        * "BAI Approve spender:<Address> <Amount>" - Adds an allowance between user and address
          * E.g. "BAI Approve Geoff 1.0e18"
      `,
      "Approve",
      [
        new Arg("vai", getBAI, { implicit: true }),
        new Arg("spender", getAddressV),
        new Arg("amount", getNumberV)
      ],
      (world, from, { vai, spender, amount }) => {
        return approve(world, from, vai, spender.val, amount)
      }
    ),

    new Command<{ vai: BAI, recipient: AddressV, amount: NumberV }>(`
        #### Transfer

        * "BAI Transfer recipient:<User> <Amount>" - Transfers a number of tokens via "transfer" as given user to recipient (this does not depend on allowance)
          * E.g. "BAI Transfer Torrey 1.0e18"
      `,
      "Transfer",
      [
        new Arg("vai", getBAI, { implicit: true }),
        new Arg("recipient", getAddressV),
        new Arg("amount", getNumberV)
      ],
      (world, from, { vai, recipient, amount }) => transfer(world, from, vai, recipient.val, amount)
    ),

    new Command<{ vai: BAI, owner: AddressV, spender: AddressV, amount: NumberV }>(`
        #### TransferFrom

        * "BAI TransferFrom owner:<User> spender:<User> <Amount>" - Transfers a number of tokens via "transfeFrom" to recipient (this depends on allowances)
          * E.g. "BAI TransferFrom Geoff Torrey 1.0e18"
      `,
      "TransferFrom",
      [
        new Arg("vai", getBAI, { implicit: true }),
        new Arg("owner", getAddressV),
        new Arg("spender", getAddressV),
        new Arg("amount", getNumberV)
      ],
      (world, from, { vai, owner, spender, amount }) => transferFrom(world, from, vai, owner.val, spender.val, amount)
    ),

    new Command<{ vai: BAIScenario, recipients: AddressV[], amount: NumberV }>(`
        #### TransferScenario

        * "BAI TransferScenario recipients:<User[]> <Amount>" - Transfers a number of tokens via "transfer" to the given recipients (this does not depend on allowance)
          * E.g. "BAI TransferScenario (Jared Torrey) 10"
      `,
      "TransferScenario",
      [
        new Arg("vai", getBAI, { implicit: true }),
        new Arg("recipients", getAddressV, { mapped: true }),
        new Arg("amount", getNumberV)
      ],
      (world, from, { vai, recipients, amount }) => transferScenario(world, from, vai, recipients.map(recipient => recipient.val), amount)
    ),

    new Command<{ vai: BAIScenario, froms: AddressV[], amount: NumberV }>(`
        #### TransferFromScenario

        * "BAI TransferFromScenario froms:<User[]> <Amount>" - Transfers a number of tokens via "transferFrom" from the given users to msg.sender (this depends on allowance)
          * E.g. "BAI TransferFromScenario (Jared Torrey) 10"
      `,
      "TransferFromScenario",
      [
        new Arg("vai", getBAI, { implicit: true }),
        new Arg("froms", getAddressV, { mapped: true }),
        new Arg("amount", getNumberV)
      ],
      (world, from, { vai, froms, amount }) => transferFromScenario(world, from, vai, froms.map(_from => _from.val), amount)
    )
  ];
}

export async function processBAIEvent(world: World, event: Event, from: string | null): Promise<World> {
  return await processCommandEvent<any>("BAI", vaiCommands(), world, event, from);
}
