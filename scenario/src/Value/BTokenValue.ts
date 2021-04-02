import { Event } from '../Event';
import { World } from '../World';
import { BToken } from '../Contract/BToken';
import { BBep20Delegator } from '../Contract/BBep20Delegator';
import { Bep20 } from '../Contract/Bep20';
import {
  getAddressV,
  getCoreValue,
  getStringV,
  mapValue
} from '../CoreValue';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import {
  AddressV,
  NumberV,
  Value,
  StringV
} from '../Value';
import { getWorldContractByAddress, getBTokenAddress } from '../ContractLookup';

export async function getBTokenV(world: World, event: Event): Promise<BToken> {
  const address = await mapValue<AddressV>(
    world,
    event,
    (str) => new AddressV(getBTokenAddress(world, str)),
    getCoreValue,
    AddressV
  );

  return getWorldContractByAddress<BToken>(world, address.val);
}

export async function getBBep20DelegatorV(world: World, event: Event): Promise<BBep20Delegator> {
  const address = await mapValue<AddressV>(
    world,
    event,
    (str) => new AddressV(getBTokenAddress(world, str)),
    getCoreValue,
    AddressV
  );

  return getWorldContractByAddress<BBep20Delegator>(world, address.val);
}

async function getInterestRateModel(world: World, bToken: BToken): Promise<AddressV> {
  return new AddressV(await bToken.methods.interestRateModel().call());
}

async function bTokenAddress(world: World, bToken: BToken): Promise<AddressV> {
  return new AddressV(bToken._address);
}

async function getBTokenAdmin(world: World, bToken: BToken): Promise<AddressV> {
  return new AddressV(await bToken.methods.admin().call());
}

async function getBTokenPendingAdmin(world: World, bToken: BToken): Promise<AddressV> {
  return new AddressV(await bToken.methods.pendingAdmin().call());
}

async function balanceOfUnderlying(world: World, bToken: BToken, user: string): Promise<NumberV> {
  return new NumberV(await bToken.methods.balanceOfUnderlying(user).call());
}

async function getBorrowBalance(world: World, bToken: BToken, user): Promise<NumberV> {
  return new NumberV(await bToken.methods.borrowBalanceCurrent(user).call());
}

async function getBorrowBalanceStored(world: World, bToken: BToken, user): Promise<NumberV> {
  return new NumberV(await bToken.methods.borrowBalanceStored(user).call());
}

async function getTotalBorrows(world: World, bToken: BToken): Promise<NumberV> {
  return new NumberV(await bToken.methods.totalBorrows().call());
}

async function getTotalBorrowsCurrent(world: World, bToken: BToken): Promise<NumberV> {
  return new NumberV(await bToken.methods.totalBorrowsCurrent().call());
}

async function getReserveFactor(world: World, bToken: BToken): Promise<NumberV> {
  return new NumberV(await bToken.methods.reserveFactorMantissa().call(), 1.0e18);
}

async function getTotalReserves(world: World, bToken: BToken): Promise<NumberV> {
  return new NumberV(await bToken.methods.totalReserves().call());
}

async function getComptroller(world: World, bToken: BToken): Promise<AddressV> {
  return new AddressV(await bToken.methods.comptroller().call());
}

async function getExchangeRateStored(world: World, bToken: BToken): Promise<NumberV> {
  return new NumberV(await bToken.methods.exchangeRateStored().call());
}

async function getExchangeRate(world: World, bToken: BToken): Promise<NumberV> {
  return new NumberV(await bToken.methods.exchangeRateCurrent().call(), 1e18);
}

async function getCash(world: World, bToken: BToken): Promise<NumberV> {
  return new NumberV(await bToken.methods.getCash().call());
}

async function getInterestRate(world: World, bToken: BToken): Promise<NumberV> {
  return new NumberV(await bToken.methods.borrowRatePerBlock().call(), 1.0e18 / 2102400);
}

async function getImplementation(world: World, bToken: BToken): Promise<AddressV> {
  return new AddressV(await (bToken as BBep20Delegator).methods.implementation().call());
}

export function bTokenFetchers() {
  return [
    new Fetcher<{ bToken: BToken }, AddressV>(`
        #### Address

        * "BToken <BToken> Address" - Returns address of BToken contract
          * E.g. "BToken vZRX Address" - Returns vZRX's address
      `,
      "Address",
      [
        new Arg("bToken", getBTokenV)
      ],
      (world, { bToken }) => bTokenAddress(world, bToken),
      { namePos: 1 }
    ),

    new Fetcher<{ bToken: BToken }, AddressV>(`
        #### InterestRateModel

        * "BToken <BToken> InterestRateModel" - Returns the interest rate model of BToken contract
          * E.g. "BToken vZRX InterestRateModel" - Returns vZRX's interest rate model
      `,
      "InterestRateModel",
      [
        new Arg("bToken", getBTokenV)
      ],
      (world, { bToken }) => getInterestRateModel(world, bToken),
      { namePos: 1 }
    ),

    new Fetcher<{ bToken: BToken }, AddressV>(`
        #### Admin

        * "BToken <BToken> Admin" - Returns the admin of BToken contract
          * E.g. "BToken vZRX Admin" - Returns vZRX's admin
      `,
      "Admin",
      [
        new Arg("bToken", getBTokenV)
      ],
      (world, { bToken }) => getBTokenAdmin(world, bToken),
      { namePos: 1 }
    ),

    new Fetcher<{ bToken: BToken }, AddressV>(`
        #### PendingAdmin

        * "BToken <BToken> PendingAdmin" - Returns the pending admin of BToken contract
          * E.g. "BToken vZRX PendingAdmin" - Returns vZRX's pending admin
      `,
      "PendingAdmin",
      [
        new Arg("bToken", getBTokenV)
      ],
      (world, { bToken }) => getBTokenPendingAdmin(world, bToken),
      { namePos: 1 }
    ),

    new Fetcher<{ bToken: BToken }, AddressV>(`
        #### Underlying

        * "BToken <BToken> Underlying" - Returns the underlying asset (if applicable)
          * E.g. "BToken vZRX Underlying"
      `,
      "Underlying",
      [
        new Arg("bToken", getBTokenV)
      ],
      async (world, { bToken }) => new AddressV(await bToken.methods.underlying().call()),
      { namePos: 1 }
    ),

    new Fetcher<{ bToken: BToken, address: AddressV }, NumberV>(`
        #### UnderlyingBalance

        * "BToken <BToken> UnderlyingBalance <User>" - Returns a user's underlying balance (based on given exchange rate)
          * E.g. "BToken vZRX UnderlyingBalance Geoff"
      `,
      "UnderlyingBalance",
      [
        new Arg("bToken", getBTokenV),
        new Arg<AddressV>("address", getAddressV)
      ],
      (world, { bToken, address }) => balanceOfUnderlying(world, bToken, address.val),
      { namePos: 1 }
    ),

    new Fetcher<{ bToken: BToken, address: AddressV }, NumberV>(`
        #### BorrowBalance

        * "BToken <BToken> BorrowBalance <User>" - Returns a user's borrow balance (including interest)
          * E.g. "BToken vZRX BorrowBalance Geoff"
      `,
      "BorrowBalance",
      [
        new Arg("bToken", getBTokenV),
        new Arg("address", getAddressV)
      ],
      (world, { bToken, address }) => getBorrowBalance(world, bToken, address.val),
      { namePos: 1 }
    ),

    new Fetcher<{ bToken: BToken, address: AddressV }, NumberV>(`
        #### BorrowBalanceStored

        * "BToken <BToken> BorrowBalanceStored <User>" - Returns a user's borrow balance (without specifically re-accruing interest)
          * E.g. "BToken vZRX BorrowBalanceStored Geoff"
      `,
      "BorrowBalanceStored",
      [
        new Arg("bToken", getBTokenV),
        new Arg("address", getAddressV)
      ],
      (world, { bToken, address }) => getBorrowBalanceStored(world, bToken, address.val),
      { namePos: 1 }
    ),

    new Fetcher<{ bToken: BToken }, NumberV>(`
        #### TotalBorrows

        * "BToken <BToken> TotalBorrows" - Returns the bToken's total borrow balance
          * E.g. "BToken vZRX TotalBorrows"
      `,
      "TotalBorrows",
      [
        new Arg("bToken", getBTokenV)
      ],
      (world, { bToken }) => getTotalBorrows(world, bToken),
      { namePos: 1 }
    ),

    new Fetcher<{ bToken: BToken }, NumberV>(`
        #### TotalBorrowsCurrent

        * "BToken <BToken> TotalBorrowsCurrent" - Returns the bToken's total borrow balance with interest
          * E.g. "BToken vZRX TotalBorrowsCurrent"
      `,
      "TotalBorrowsCurrent",
      [
        new Arg("bToken", getBTokenV)
      ],
      (world, { bToken }) => getTotalBorrowsCurrent(world, bToken),
      { namePos: 1 }
    ),

    new Fetcher<{ bToken: BToken }, NumberV>(`
        #### Reserves

        * "BToken <BToken> Reserves" - Returns the bToken's total reserves
          * E.g. "BToken vZRX Reserves"
      `,
      "Reserves",
      [
        new Arg("bToken", getBTokenV)
      ],
      (world, { bToken }) => getTotalReserves(world, bToken),
      { namePos: 1 }
    ),

    new Fetcher<{ bToken: BToken }, NumberV>(`
        #### ReserveFactor

        * "BToken <BToken> ReserveFactor" - Returns reserve factor of BToken contract
          * E.g. "BToken vZRX ReserveFactor" - Returns vZRX's reserve factor
      `,
      "ReserveFactor",
      [
        new Arg("bToken", getBTokenV)
      ],
      (world, { bToken }) => getReserveFactor(world, bToken),
      { namePos: 1 }
    ),

    new Fetcher<{ bToken: BToken }, AddressV>(`
        #### Comptroller

        * "BToken <BToken> Comptroller" - Returns the bToken's comptroller
          * E.g. "BToken vZRX Comptroller"
      `,
      "Comptroller",
      [
        new Arg("bToken", getBTokenV)
      ],
      (world, { bToken }) => getComptroller(world, bToken),
      { namePos: 1 }
    ),

    new Fetcher<{ bToken: BToken }, NumberV>(`
        #### ExchangeRateStored

        * "BToken <BToken> ExchangeRateStored" - Returns the bToken's exchange rate (based on balances stored)
          * E.g. "BToken vZRX ExchangeRateStored"
      `,
      "ExchangeRateStored",
      [
        new Arg("bToken", getBTokenV)
      ],
      (world, { bToken }) => getExchangeRateStored(world, bToken),
      { namePos: 1 }
    ),

    new Fetcher<{ bToken: BToken }, NumberV>(`
        #### ExchangeRate

        * "BToken <BToken> ExchangeRate" - Returns the bToken's current exchange rate
          * E.g. "BToken vZRX ExchangeRate"
      `,
      "ExchangeRate",
      [
        new Arg("bToken", getBTokenV)
      ],
      (world, { bToken }) => getExchangeRate(world, bToken),
      { namePos: 1 }
    ),

    new Fetcher<{ bToken: BToken }, NumberV>(`
        #### Cash

        * "BToken <BToken> Cash" - Returns the bToken's current cash
          * E.g. "BToken vZRX Cash"
      `,
      "Cash",
      [
        new Arg("bToken", getBTokenV)
      ],
      (world, { bToken }) => getCash(world, bToken),
      { namePos: 1 }
    ),

    new Fetcher<{ bToken: BToken }, NumberV>(`
        #### InterestRate

        * "BToken <BToken> InterestRate" - Returns the bToken's current interest rate
          * E.g. "BToken vZRX InterestRate"
      `,
      "InterestRate",
      [
        new Arg("bToken", getBTokenV)
      ],
      (world, {bToken}) => getInterestRate(world, bToken),
      {namePos: 1}
    ),
    new Fetcher<{bToken: BToken, signature: StringV}, NumberV>(`
        #### CallNum

        * "BToken <BToken> Call <signature>" - Simple direct call method, for now with no parameters
          * E.g. "BToken vZRX Call \"borrowIndex()\""
      `,
      "CallNum",
      [
        new Arg("bToken", getBTokenV),
        new Arg("signature", getStringV),
      ],
      async (world, {bToken, signature}) => {
        const res = await world.web3.eth.call({
            to: bToken._address,
            data: world.web3.eth.abi.encodeFunctionSignature(signature.val)
          })
        const resNum : any = world.web3.eth.abi.decodeParameter('uint256',res);
        return new NumberV(resNum);
      }
      ,
      {namePos: 1}
    ),
    new Fetcher<{ bToken: BToken }, AddressV>(`
        #### Implementation

        * "BToken <BToken> Implementation" - Returns the bToken's current implementation
          * E.g. "BToken vDAI Implementation"
      `,
      "Implementation",
      [
        new Arg("bToken", getBTokenV)
      ],
      (world, { bToken }) => getImplementation(world, bToken),
      { namePos: 1 }
    )
  ];
}

export async function getBTokenValue(world: World, event: Event): Promise<Value> {
  return await getFetcherValue<any, any>("bToken", bTokenFetchers(), world, event);
}
