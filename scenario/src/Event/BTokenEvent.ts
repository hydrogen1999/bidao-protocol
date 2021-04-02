import { Event } from '../Event';
import { addAction, describeUser, World } from '../World';
import { decodeCall, getPastEvents } from '../Contract';
import { BToken, BTokenScenario } from '../Contract/BToken';
import { BBep20Delegate } from '../Contract/BBep20Delegate'
import { BBep20Delegator } from '../Contract/BBep20Delegator'
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
import { getContract } from '../Contract';
import { Arg, Command, View, processCommandEvent } from '../Command';
import { BTokenErrorReporter } from '../ErrorReporter';
import { getComptroller, getBTokenData } from '../ContractLookup';
import { getExpMantissa } from '../Encoding';
import { buildBToken } from '../Builder/BTokenBuilder';
import { verify } from '../Verify';
import { getLiquidity } from '../Value/ComptrollerValue';
import { encodedNumber } from '../Encoding';
import { getBTokenV, getBBep20DelegatorV } from '../Value/BTokenValue';

function showTrxValue(world: World): string {
  return new NumberV(world.trxInvokationOpts.get('value')).show();
}

async function genBToken(world: World, from: string, event: Event): Promise<World> {
  let { world: nextWorld, bToken, tokenData } = await buildBToken(world, from, event);
  world = nextWorld;

  world = addAction(
    world,
    `Added bToken ${tokenData.name} (${tokenData.contract}<decimals=${tokenData.decimals}>) at address ${bToken._address}`,
    tokenData.invokation
  );

  return world;
}

async function accrueInterest(world: World, from: string, bToken: BToken): Promise<World> {
  let invokation = await invoke(world, bToken.methods.accrueInterest(), from, BTokenErrorReporter);

  world = addAction(
    world,
    `BToken ${bToken.name}: Interest accrued`,
    invokation
  );

  return world;
}

async function mint(world: World, from: string, bToken: BToken, amount: NumberV | NothingV): Promise<World> {
  let invokation;
  let showAmount;

  if (amount instanceof NumberV) {
    showAmount = amount.show();
    invokation = await invoke(world, bToken.methods.mint(amount.encode()), from, BTokenErrorReporter);
  } else {
    showAmount = showTrxValue(world);
    invokation = await invoke(world, bToken.methods.mint(), from, BTokenErrorReporter);
  }

  world = addAction(
    world,
    `BToken ${bToken.name}: ${describeUser(world, from)} mints ${showAmount}`,
    invokation
  );

  return world;
}

async function redeem(world: World, from: string, bToken: BToken, tokens: NumberV): Promise<World> {
  let invokation = await invoke(world, bToken.methods.redeem(tokens.encode()), from, BTokenErrorReporter);

  world = addAction(
    world,
    `BToken ${bToken.name}: ${describeUser(world, from)} redeems ${tokens.show()} tokens`,
    invokation
  );

  return world;
}

async function redeemUnderlying(world: World, from: string, bToken: BToken, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, bToken.methods.redeemUnderlying(amount.encode()), from, BTokenErrorReporter);

  world = addAction(
    world,
    `BToken ${bToken.name}: ${describeUser(world, from)} redeems ${amount.show()} underlying`,
    invokation
  );

  return world;
}

async function borrow(world: World, from: string, bToken: BToken, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, bToken.methods.borrow(amount.encode()), from, BTokenErrorReporter);

  world = addAction(
    world,
    `BToken ${bToken.name}: ${describeUser(world, from)} borrows ${amount.show()}`,
    invokation
  );

  return world;
}

async function repayBorrow(world: World, from: string, bToken: BToken, amount: NumberV | NothingV): Promise<World> {
  let invokation;
  let showAmount;

  if (amount instanceof NumberV) {
    showAmount = amount.show();
    invokation = await invoke(world, bToken.methods.repayBorrow(amount.encode()), from, BTokenErrorReporter);
  } else {
    showAmount = showTrxValue(world);
    invokation = await invoke(world, bToken.methods.repayBorrow(), from, BTokenErrorReporter);
  }

  world = addAction(
    world,
    `BToken ${bToken.name}: ${describeUser(world, from)} repays ${showAmount} of borrow`,
    invokation
  );

  return world;
}

async function repayBorrowBehalf(world: World, from: string, behalf: string, bToken: BToken, amount: NumberV | NothingV): Promise<World> {
  let invokation;
  let showAmount;

  if (amount instanceof NumberV) {
    showAmount = amount.show();
    invokation = await invoke(world, bToken.methods.repayBorrowBehalf(behalf, amount.encode()), from, BTokenErrorReporter);
  } else {
    showAmount = showTrxValue(world);
    invokation = await invoke(world, bToken.methods.repayBorrowBehalf(behalf), from, BTokenErrorReporter);
  }

  world = addAction(
    world,
    `BToken ${bToken.name}: ${describeUser(world, from)} repays ${showAmount} of borrow on behalf of ${describeUser(world, behalf)}`,
    invokation
  );

  return world;
}

async function liquidateBorrow(world: World, from: string, bToken: BToken, borrower: string, collateral: BToken, repayAmount: NumberV | NothingV): Promise<World> {
  let invokation;
  let showAmount;

  if (repayAmount instanceof NumberV) {
    showAmount = repayAmount.show();
    invokation = await invoke(world, bToken.methods.liquidateBorrow(borrower, repayAmount.encode(), collateral._address), from, BTokenErrorReporter);
  } else {
    showAmount = showTrxValue(world);
    invokation = await invoke(world, bToken.methods.liquidateBorrow(borrower, collateral._address), from, BTokenErrorReporter);
  }

  world = addAction(
    world,
    `BToken ${bToken.name}: ${describeUser(world, from)} liquidates ${showAmount} from of ${describeUser(world, borrower)}, seizing ${collateral.name}.`,
    invokation
  );

  return world;
}

async function seize(world: World, from: string, bToken: BToken, liquidator: string, borrower: string, seizeTokens: NumberV): Promise<World> {
  let invokation = await invoke(world, bToken.methods.seize(liquidator, borrower, seizeTokens.encode()), from, BTokenErrorReporter);

  world = addAction(
    world,
    `BToken ${bToken.name}: ${describeUser(world, from)} initiates seizing ${seizeTokens.show()} to ${describeUser(world, liquidator)} from ${describeUser(world, borrower)}.`,
    invokation
  );

  return world;
}

async function evilSeize(world: World, from: string, bToken: BToken, treasure: BToken, liquidator: string, borrower: string, seizeTokens: NumberV): Promise<World> {
  let invokation = await invoke(world, bToken.methods.evilSeize(treasure._address, liquidator, borrower, seizeTokens.encode()), from, BTokenErrorReporter);

  world = addAction(
    world,
    `BToken ${bToken.name}: ${describeUser(world, from)} initiates illegal seizing ${seizeTokens.show()} to ${describeUser(world, liquidator)} from ${describeUser(world, borrower)}.`,
    invokation
  );

  return world;
}

async function setPendingAdmin(world: World, from: string, bToken: BToken, newPendingAdmin: string): Promise<World> {
  let invokation = await invoke(world, bToken.methods._setPendingAdmin(newPendingAdmin), from, BTokenErrorReporter);

  world = addAction(
    world,
    `BToken ${bToken.name}: ${describeUser(world, from)} sets pending admin to ${newPendingAdmin}`,
    invokation
  );

  return world;
}

async function acceptAdmin(world: World, from: string, bToken: BToken): Promise<World> {
  let invokation = await invoke(world, bToken.methods._acceptAdmin(), from, BTokenErrorReporter);

  world = addAction(
    world,
    `BToken ${bToken.name}: ${describeUser(world, from)} accepts admin`,
    invokation
  );

  return world;
}

async function addReserves(world: World, from: string, bToken: BToken, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, bToken.methods._addReserves(amount.encode()), from, BTokenErrorReporter);

  world = addAction(
    world,
    `BToken ${bToken.name}: ${describeUser(world, from)} adds to reserves by ${amount.show()}`,
    invokation
  );

  return world;
}

async function reduceReserves(world: World, from: string, bToken: BToken, amount: NumberV): Promise<World> {
  let invokation = await invoke(world, bToken.methods._reduceReserves(amount.encode()), from, BTokenErrorReporter);

  world = addAction(
    world,
    `BToken ${bToken.name}: ${describeUser(world, from)} reduces reserves by ${amount.show()}`,
    invokation
  );

  return world;
}

async function setReserveFactor(world: World, from: string, bToken: BToken, reserveFactor: NumberV): Promise<World> {
  let invokation = await invoke(world, bToken.methods._setReserveFactor(reserveFactor.encode()), from, BTokenErrorReporter);

  world = addAction(
    world,
    `BToken ${bToken.name}: ${describeUser(world, from)} sets reserve factor to ${reserveFactor.show()}`,
    invokation
  );

  return world;
}

async function setInterestRateModel(world: World, from: string, bToken: BToken, interestRateModel: string): Promise<World> {
  let invokation = await invoke(world, bToken.methods._setInterestRateModel(interestRateModel), from, BTokenErrorReporter);

  world = addAction(
    world,
    `Set interest rate for ${bToken.name} to ${interestRateModel} as ${describeUser(world, from)}`,
    invokation
  );

  return world;
}

async function setComptroller(world: World, from: string, bToken: BToken, comptroller: string): Promise<World> {
  let invokation = await invoke(world, bToken.methods._setComptroller(comptroller), from, BTokenErrorReporter);

  world = addAction(
    world,
    `Set comptroller for ${bToken.name} to ${comptroller} as ${describeUser(world, from)}`,
    invokation
  );

  return world;
}

async function becomeImplementation(
  world: World,
  from: string,
  bToken: BToken,
  becomeImplementationData: string
): Promise<World> {

  const vBep20Delegate = getContract('BBep20Delegate');
  const vBep20DelegateContract = await vBep20Delegate.at<BBep20Delegate>(world, bToken._address);

  let invokation = await invoke(
    world,
    vBep20DelegateContract.methods._becomeImplementation(becomeImplementationData),
    from,
    BTokenErrorReporter
  );

  world = addAction(
    world,
    `BToken ${bToken.name}: ${describeUser(
      world,
      from
    )} initiates _becomeImplementation with data:${becomeImplementationData}.`,
    invokation
  );

  return world;
}

async function resignImplementation(
  world: World,
  from: string,
  bToken: BToken,
): Promise<World> {

  const vBep20Delegate = getContract('BBep20Delegate');
  const vBep20DelegateContract = await vBep20Delegate.at<BBep20Delegate>(world, bToken._address);

  let invokation = await invoke(
    world,
    vBep20DelegateContract.methods._resignImplementation(),
    from,
    BTokenErrorReporter
  );

  world = addAction(
    world,
    `BToken ${bToken.name}: ${describeUser(
      world,
      from
    )} initiates _resignImplementation.`,
    invokation
  );

  return world;
}

async function setImplementation(
  world: World,
  from: string,
  bToken: BBep20Delegator,
  implementation: string,
  allowResign: boolean,
  becomeImplementationData: string
): Promise<World> {
  let invokation = await invoke(
    world,
    bToken.methods._setImplementation(
      implementation,
      allowResign,
      becomeImplementationData
    ),
    from,
    BTokenErrorReporter
  );

  world = addAction(
    world,
    `BToken ${bToken.name}: ${describeUser(
      world,
      from
    )} initiates setImplementation with implementation:${implementation} allowResign:${allowResign} data:${becomeImplementationData}.`,
    invokation
  );

  return world;
}

async function donate(world: World, from: string, bToken: BToken): Promise<World> {
  let invokation = await invoke(world, bToken.methods.donate(), from, BTokenErrorReporter);

  world = addAction(
    world,
    `Donate for ${bToken.name} as ${describeUser(world, from)} with value ${showTrxValue(world)}`,
    invokation
  );

  return world;
}

async function setBTokenMock(world: World, from: string, bToken: BTokenScenario, mock: string, value: NumberV): Promise<World> {
  let mockMethod: (number) => Sendable<void>;

  switch (mock.toLowerCase()) {
    case "totalborrows":
      mockMethod = bToken.methods.setTotalBorrows;
      break;
    case "totalreserves":
      mockMethod = bToken.methods.setTotalReserves;
      break;
    default:
      throw new Error(`Mock "${mock}" not defined for bToken`);
  }

  let invokation = await invoke(world, mockMethod(value.encode()), from);

  world = addAction(
    world,
    `Mocked ${mock}=${value.show()} for ${bToken.name}`,
    invokation
  );

  return world;
}

async function verifyBToken(world: World, bToken: BToken, name: string, contract: string, apiKey: string): Promise<World> {
  if (world.isLocalNetwork()) {
    world.printer.printLine(`Politely declining to verify on local network: ${world.network}.`);
  } else {
    await verify(world, apiKey, name, contract, bToken._address);
  }

  return world;
}

async function printMinters(world: World, bToken: BToken): Promise<World> {
  let events = await getPastEvents(world, bToken, bToken.name, 'Mint');
  let addresses = events.map((event) => event.returnValues['minter']);
  let uniq = [...new Set(addresses)];

  world.printer.printLine("Minters:")

  uniq.forEach((address) => {
    world.printer.printLine(`\t${address}`)
  });

  return world;
}

async function printBorrowers(world: World, bToken: BToken): Promise<World> {
  let events = await getPastEvents(world, bToken, bToken.name, 'Borrow');
  let addresses = events.map((event) => event.returnValues['borrower']);
  let uniq = [...new Set(addresses)];

  world.printer.printLine("Borrowers:")

  uniq.forEach((address) => {
    world.printer.printLine(`\t${address}`)
  });

  return world;
}

async function printLiquidity(world: World, bToken: BToken): Promise<World> {
  let mintEvents = await getPastEvents(world, bToken, bToken.name, 'Mint');
  let mintAddresses = mintEvents.map((event) => event.returnValues['minter']);
  let borrowEvents = await getPastEvents(world, bToken, bToken.name, 'Borrow');
  let borrowAddresses = borrowEvents.map((event) => event.returnValues['borrower']);
  let uniq = [...new Set(mintAddresses.concat(borrowAddresses))];
  let comptroller = await getComptroller(world);

  world.printer.printLine("Liquidity:")

  const liquidityMap = await Promise.all(uniq.map(async (address) => {
    let userLiquidity = await getLiquidity(world, comptroller, address);

    return [address, userLiquidity.val];
  }));

  liquidityMap.forEach(([address, liquidity]) => {
    world.printer.printLine(`\t${world.settings.lookupAlias(address)}: ${liquidity / 1e18}e18`)
  });

  return world;
}

export function bTokenCommands() {
  return [
    new Command<{ bTokenParams: EventV }>(`
        #### Deploy

        * "BToken Deploy ...bTokenParams" - Generates a new BToken
          * E.g. "BToken vZRX Deploy"
      `,
      "Deploy",
      [new Arg("bTokenParams", getEventV, { variadic: true })],
      (world, from, { bTokenParams }) => genBToken(world, from, bTokenParams.val)
    ),
    new View<{ bTokenArg: StringV, apiKey: StringV }>(`
        #### Verify

        * "BToken <bToken> Verify apiKey:<String>" - Verifies BToken in BscScan
          * E.g. "BToken vZRX Verify "myApiKey"
      `,
      "Verify",
      [
        new Arg("bTokenArg", getStringV),
        new Arg("apiKey", getStringV)
      ],
      async (world, { bTokenArg, apiKey }) => {
        let [bToken, name, data] = await getBTokenData(world, bTokenArg.val);

        return await verifyBToken(world, bToken, name, data.get('contract')!, apiKey.val);
      },
      { namePos: 1 }
    ),
    new Command<{ bToken: BToken }>(`
        #### AccrueInterest

        * "BToken <bToken> AccrueInterest" - Accrues interest for given token
          * E.g. "BToken vZRX AccrueInterest"
      `,
      "AccrueInterest",
      [
        new Arg("bToken", getBTokenV)
      ],
      (world, from, { bToken }) => accrueInterest(world, from, bToken),
      { namePos: 1 }
    ),
    new Command<{ bToken: BToken, amount: NumberV | NothingV }>(`
        #### Mint

        * "BToken <bToken> Mint amount:<Number>" - Mints the given amount of bToken as specified user
          * E.g. "BToken vZRX Mint 1.0e18"
      `,
      "Mint",
      [
        new Arg("bToken", getBTokenV),
        new Arg("amount", getNumberV, { nullable: true })
      ],
      (world, from, { bToken, amount }) => mint(world, from, bToken, amount),
      { namePos: 1 }
    ),
    new Command<{ bToken: BToken, tokens: NumberV }>(`
        #### Redeem

        * "BToken <bToken> Redeem tokens:<Number>" - Redeems the given amount of bTokens as specified user
          * E.g. "BToken vZRX Redeem 1.0e9"
      `,
      "Redeem",
      [
        new Arg("bToken", getBTokenV),
        new Arg("tokens", getNumberV)
      ],
      (world, from, { bToken, tokens }) => redeem(world, from, bToken, tokens),
      { namePos: 1 }
    ),
    new Command<{ bToken: BToken, amount: NumberV }>(`
        #### RedeemUnderlying

        * "BToken <bToken> RedeemUnderlying amount:<Number>" - Redeems the given amount of underlying as specified user
          * E.g. "BToken vZRX RedeemUnderlying 1.0e18"
      `,
      "RedeemUnderlying",
      [
        new Arg("bToken", getBTokenV),
        new Arg("amount", getNumberV)
      ],
      (world, from, { bToken, amount }) => redeemUnderlying(world, from, bToken, amount),
      { namePos: 1 }
    ),
    new Command<{ bToken: BToken, amount: NumberV }>(`
        #### Borrow

        * "BToken <bToken> Borrow amount:<Number>" - Borrows the given amount of this bToken as specified user
          * E.g. "BToken vZRX Borrow 1.0e18"
      `,
      "Borrow",
      [
        new Arg("bToken", getBTokenV),
        new Arg("amount", getNumberV)
      ],
      // Note: we override from
      (world, from, { bToken, amount }) => borrow(world, from, bToken, amount),
      { namePos: 1 }
    ),
    new Command<{ bToken: BToken, amount: NumberV | NothingV }>(`
        #### RepayBorrow

        * "BToken <bToken> RepayBorrow underlyingAmount:<Number>" - Repays borrow in the given underlying amount as specified user
          * E.g. "BToken vZRX RepayBorrow 1.0e18"
      `,
      "RepayBorrow",
      [
        new Arg("bToken", getBTokenV),
        new Arg("amount", getNumberV, { nullable: true })
      ],
      (world, from, { bToken, amount }) => repayBorrow(world, from, bToken, amount),
      { namePos: 1 }
    ),
    new Command<{ bToken: BToken, behalf: AddressV, amount: NumberV | NothingV }>(`
        #### RepayBorrowBehalf

        * "BToken <bToken> RepayBorrowBehalf behalf:<User> underlyingAmount:<Number>" - Repays borrow in the given underlying amount on behalf of another user
          * E.g. "BToken vZRX RepayBorrowBehalf Geoff 1.0e18"
      `,
      "RepayBorrowBehalf",
      [
        new Arg("bToken", getBTokenV),
        new Arg("behalf", getAddressV),
        new Arg("amount", getNumberV, { nullable: true })
      ],
      (world, from, { bToken, behalf, amount }) => repayBorrowBehalf(world, from, behalf.val, bToken, amount),
      { namePos: 1 }
    ),
    new Command<{ borrower: AddressV, bToken: BToken, collateral: BToken, repayAmount: NumberV | NothingV }>(`
        #### Liquidate

        * "BToken <bToken> Liquidate borrower:<User> bTokenCollateral:<Address> repayAmount:<Number>" - Liquidates repayAmount of given token seizing collateral token
          * E.g. "BToken vZRX Liquidate Geoff vBAT 1.0e18"
      `,
      "Liquidate",
      [
        new Arg("bToken", getBTokenV),
        new Arg("borrower", getAddressV),
        new Arg("collateral", getBTokenV),
        new Arg("repayAmount", getNumberV, { nullable: true })
      ],
      (world, from, { borrower, bToken, collateral, repayAmount }) => liquidateBorrow(world, from, bToken, borrower.val, collateral, repayAmount),
      { namePos: 1 }
    ),
    new Command<{ bToken: BToken, liquidator: AddressV, borrower: AddressV, seizeTokens: NumberV }>(`
        #### Seize

        * "BToken <bToken> Seize liquidator:<User> borrower:<User> seizeTokens:<Number>" - Seizes a given number of tokens from a user (to be called from other BToken)
          * E.g. "BToken vZRX Seize Geoff Torrey 1.0e18"
      `,
      "Seize",
      [
        new Arg("bToken", getBTokenV),
        new Arg("liquidator", getAddressV),
        new Arg("borrower", getAddressV),
        new Arg("seizeTokens", getNumberV)
      ],
      (world, from, { bToken, liquidator, borrower, seizeTokens }) => seize(world, from, bToken, liquidator.val, borrower.val, seizeTokens),
      { namePos: 1 }
    ),
    new Command<{ bToken: BToken, treasure: BToken, liquidator: AddressV, borrower: AddressV, seizeTokens: NumberV }>(`
        #### EvilSeize

        * "BToken <bToken> EvilSeize treasure:<Token> liquidator:<User> borrower:<User> seizeTokens:<Number>" - Improperly seizes a given number of tokens from a user
          * E.g. "BToken vEVL EvilSeize vZRX Geoff Torrey 1.0e18"
      `,
      "EvilSeize",
      [
        new Arg("bToken", getBTokenV),
        new Arg("treasure", getBTokenV),
        new Arg("liquidator", getAddressV),
        new Arg("borrower", getAddressV),
        new Arg("seizeTokens", getNumberV)
      ],
      (world, from, { bToken, treasure, liquidator, borrower, seizeTokens }) => evilSeize(world, from, bToken, treasure, liquidator.val, borrower.val, seizeTokens),
      { namePos: 1 }
    ),
    new Command<{ bToken: BToken, amount: NumberV }>(`
        #### ReduceReserves

        * "BToken <bToken> ReduceReserves amount:<Number>" - Reduces the reserves of the bToken
          * E.g. "BToken vZRX ReduceReserves 1.0e18"
      `,
      "ReduceReserves",
      [
        new Arg("bToken", getBTokenV),
        new Arg("amount", getNumberV)
      ],
      (world, from, { bToken, amount }) => reduceReserves(world, from, bToken, amount),
      { namePos: 1 }
    ),
    new Command<{ bToken: BToken, amount: NumberV }>(`
    #### AddReserves

    * "BToken <bToken> AddReserves amount:<Number>" - Adds reserves to the bToken
      * E.g. "BToken vZRX AddReserves 1.0e18"
  `,
      "AddReserves",
      [
        new Arg("bToken", getBTokenV),
        new Arg("amount", getNumberV)
      ],
      (world, from, { bToken, amount }) => addReserves(world, from, bToken, amount),
      { namePos: 1 }
    ),
    new Command<{ bToken: BToken, newPendingAdmin: AddressV }>(`
        #### SetPendingAdmin

        * "BToken <bToken> SetPendingAdmin newPendingAdmin:<Address>" - Sets the pending admin for the bToken
          * E.g. "BToken vZRX SetPendingAdmin Geoff"
      `,
      "SetPendingAdmin",
      [
        new Arg("bToken", getBTokenV),
        new Arg("newPendingAdmin", getAddressV)
      ],
      (world, from, { bToken, newPendingAdmin }) => setPendingAdmin(world, from, bToken, newPendingAdmin.val),
      { namePos: 1 }
    ),
    new Command<{ bToken: BToken }>(`
        #### AcceptAdmin

        * "BToken <bToken> AcceptAdmin" - Accepts admin for the bToken
          * E.g. "From Geoff (BToken vZRX AcceptAdmin)"
      `,
      "AcceptAdmin",
      [
        new Arg("bToken", getBTokenV)
      ],
      (world, from, { bToken }) => acceptAdmin(world, from, bToken),
      { namePos: 1 }
    ),
    new Command<{ bToken: BToken, reserveFactor: NumberV }>(`
        #### SetReserveFactor

        * "BToken <bToken> SetReserveFactor reserveFactor:<Number>" - Sets the reserve factor for the bToken
          * E.g. "BToken vZRX SetReserveFactor 0.1"
      `,
      "SetReserveFactor",
      [
        new Arg("bToken", getBTokenV),
        new Arg("reserveFactor", getExpNumberV)
      ],
      (world, from, { bToken, reserveFactor }) => setReserveFactor(world, from, bToken, reserveFactor),
      { namePos: 1 }
    ),
    new Command<{ bToken: BToken, interestRateModel: AddressV }>(`
        #### SetInterestRateModel

        * "BToken <bToken> SetInterestRateModel interestRateModel:<Contract>" - Sets the interest rate model for the given bToken
          * E.g. "BToken vZRX SetInterestRateModel (FixedRate 1.5)"
      `,
      "SetInterestRateModel",
      [
        new Arg("bToken", getBTokenV),
        new Arg("interestRateModel", getAddressV)
      ],
      (world, from, { bToken, interestRateModel }) => setInterestRateModel(world, from, bToken, interestRateModel.val),
      { namePos: 1 }
    ),
    new Command<{ bToken: BToken, comptroller: AddressV }>(`
        #### SetComptroller

        * "BToken <bToken> SetComptroller comptroller:<Contract>" - Sets the comptroller for the given bToken
          * E.g. "BToken vZRX SetComptroller Comptroller"
      `,
      "SetComptroller",
      [
        new Arg("bToken", getBTokenV),
        new Arg("comptroller", getAddressV)
      ],
      (world, from, { bToken, comptroller }) => setComptroller(world, from, bToken, comptroller.val),
      { namePos: 1 }
    ),
    new Command<{
      bToken: BToken;
      becomeImplementationData: StringV;
    }>(
      `
        #### BecomeImplementation

        * "BToken <bToken> BecomeImplementation becomeImplementationData:<String>"
          * E.g. "BToken vDAI BecomeImplementation "0x01234anyByTeS56789""
      `,
      'BecomeImplementation',
      [
        new Arg('bToken', getBTokenV),
        new Arg('becomeImplementationData', getStringV)
      ],
      (world, from, { bToken, becomeImplementationData }) =>
        becomeImplementation(
          world,
          from,
          bToken,
          becomeImplementationData.val
        ),
      { namePos: 1 }
    ),
    new Command<{bToken: BToken;}>(
      `
        #### ResignImplementation

        * "BToken <bToken> ResignImplementation"
          * E.g. "BToken vDAI ResignImplementation"
      `,
      'ResignImplementation',
      [new Arg('bToken', getBTokenV)],
      (world, from, { bToken }) =>
        resignImplementation(
          world,
          from,
          bToken
        ),
      { namePos: 1 }
    ),
    new Command<{
      bToken: BBep20Delegator;
      implementation: AddressV;
      allowResign: BoolV;
      becomeImplementationData: StringV;
    }>(
      `
        #### SetImplementation

        * "BToken <bToken> SetImplementation implementation:<Address> allowResign:<Bool> becomeImplementationData:<String>"
          * E.g. "BToken vDAI SetImplementation (BToken vDAIDelegate Address) True "0x01234anyByTeS56789"
      `,
      'SetImplementation',
      [
        new Arg('bToken', getBBep20DelegatorV),
        new Arg('implementation', getAddressV),
        new Arg('allowResign', getBoolV),
        new Arg('becomeImplementationData', getStringV)
      ],
      (world, from, { bToken, implementation, allowResign, becomeImplementationData }) =>
        setImplementation(
          world,
          from,
          bToken,
          implementation.val,
          allowResign.val,
          becomeImplementationData.val
        ),
      { namePos: 1 }
    ),
    new Command<{ bToken: BToken }>(`
        #### Donate

        * "BToken <bToken> Donate" - Calls the donate (payable no-op) function
          * E.g. "(Trx Value 5.0e18 (BToken vBNB Donate))"
      `,
      "Donate",
      [
        new Arg("bToken", getBTokenV)
      ],
      (world, from, { bToken }) => donate(world, from, bToken),
      { namePos: 1 }
    ),
    new Command<{ bToken: BToken, variable: StringV, value: NumberV }>(`
        #### Mock

        * "BToken <bToken> Mock variable:<String> value:<Number>" - Mocks a given value on bToken. Note: value must be a supported mock and this will only work on a "BTokenScenario" contract.
          * E.g. "BToken vZRX Mock totalBorrows 5.0e18"
          * E.g. "BToken vZRX Mock totalReserves 0.5e18"
      `,
      "Mock",
      [
        new Arg("bToken", getBTokenV),
        new Arg("variable", getStringV),
        new Arg("value", getNumberV),
      ],
      (world, from, { bToken, variable, value }) => setBTokenMock(world, from, <BTokenScenario>bToken, variable.val, value),
      { namePos: 1 }
    ),
    new View<{ bToken: BToken }>(`
        #### Minters

        * "BToken <bToken> Minters" - Print address of all minters
      `,
      "Minters",
      [
        new Arg("bToken", getBTokenV)
      ],
      (world, { bToken }) => printMinters(world, bToken),
      { namePos: 1 }
    ),
    new View<{ bToken: BToken }>(`
        #### Borrowers

        * "BToken <bToken> Borrowers" - Print address of all borrowers
      `,
      "Borrowers",
      [
        new Arg("bToken", getBTokenV)
      ],
      (world, { bToken }) => printBorrowers(world, bToken),
      { namePos: 1 }
    ),
    new View<{ bToken: BToken }>(`
        #### Liquidity

        * "BToken <bToken> Liquidity" - Prints liquidity of all minters or borrowers
      `,
      "Liquidity",
      [
        new Arg("bToken", getBTokenV)
      ],
      (world, { bToken }) => printLiquidity(world, bToken),
      { namePos: 1 }
    ),
    new View<{ bToken: BToken, input: StringV }>(`
        #### Decode

        * "Decode <bToken> input:<String>" - Prints information about a call to a bToken contract
      `,
      "Decode",
      [
        new Arg("bToken", getBTokenV),
        new Arg("input", getStringV)

      ],
      (world, { bToken, input }) => decodeCall(world, bToken, input.val),
      { namePos: 1 }
    )
  ];
}

export async function processBTokenEvent(world: World, event: Event, from: string | null): Promise<World> {
  return await processCommandEvent<any>("BToken", bTokenCommands(), world, event, from);
}
