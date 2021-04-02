import {Event} from '../Event';
import {World} from '../World';
import {Comptroller} from '../Contract/Comptroller';
import {BToken} from '../Contract/BToken';
import {
  getAddressV,
  getCoreValue,
  getStringV,
  getNumberV
} from '../CoreValue';
import {
  AddressV,
  BoolV,
  ListV,
  NumberV,
  StringV,
  Value
} from '../Value';
import {Arg, Fetcher, getFetcherValue} from '../Command';
import {getComptroller} from '../ContractLookup';
import {encodedNumber} from '../Encoding';
import {getBTokenV} from '../Value/BTokenValue';
import { encodeParameters, encodeABI } from '../Utils';

export async function getComptrollerAddress(world: World, comptroller: Comptroller): Promise<AddressV> {
  return new AddressV(comptroller._address);
}

export async function getLiquidity(world: World, comptroller: Comptroller, user: string): Promise<NumberV> {
  let {0: error, 1: liquidity, 2: shortfall} = await comptroller.methods.getAccountLiquidity(user).call();
  if (Number(error) != 0) {
    throw new Error(`Failed to compute account liquidity: error code = ${error}`);
  }
  return new NumberV(Number(liquidity) - Number(shortfall));
}

export async function getHypotheticalLiquidity(world: World, comptroller: Comptroller, account: string, asset: string, redeemTokens: encodedNumber, borrowAmount: encodedNumber): Promise<NumberV> {
  let {0: error, 1: liquidity, 2: shortfall} = await comptroller.methods.getHypotheticalAccountLiquidity(account, asset, redeemTokens, borrowAmount).call();
  if (Number(error) != 0) {
    throw new Error(`Failed to compute account hypothetical liquidity: error code = ${error}`);
  }
  return new NumberV(Number(liquidity) - Number(shortfall));
}

async function getPriceOracle(world: World, comptroller: Comptroller): Promise<AddressV> {
  return new AddressV(await comptroller.methods.oracle().call());
}

async function getCloseFactor(world: World, comptroller: Comptroller): Promise<NumberV> {
  return new NumberV(await comptroller.methods.closeFactorMantissa().call(), 1e18);
}

async function getMaxAssets(world: World, comptroller: Comptroller): Promise<NumberV> {
  return new NumberV(await comptroller.methods.maxAssets().call());
}

async function getLiquidationIncentive(world: World, comptroller: Comptroller): Promise<NumberV> {
  return new NumberV(await comptroller.methods.liquidationIncentiveMantissa().call(), 1e18);
}

async function getImplementation(world: World, comptroller: Comptroller): Promise<AddressV> {
  return new AddressV(await comptroller.methods.comptrollerImplementation().call());
}

async function getBlockNumber(world: World, comptroller: Comptroller): Promise<NumberV> {
  return new NumberV(await comptroller.methods.getBlockNumber().call());
}

async function getAdmin(world: World, comptroller: Comptroller): Promise<AddressV> {
  return new AddressV(await comptroller.methods.admin().call());
}

async function getPendingAdmin(world: World, comptroller: Comptroller): Promise<AddressV> {
  return new AddressV(await comptroller.methods.pendingAdmin().call());
}

async function getCollateralFactor(world: World, comptroller: Comptroller, bToken: BToken): Promise<NumberV> {
  let {0: _isListed, 1: collateralFactorMantissa} = await comptroller.methods.markets(bToken._address).call();
  return new NumberV(collateralFactorMantissa, 1e18);
}

async function membershipLength(world: World, comptroller: Comptroller, user: string): Promise<NumberV> {
  return new NumberV(await comptroller.methods.membershipLength(user).call());
}

async function checkMembership(world: World, comptroller: Comptroller, user: string, bToken: BToken): Promise<BoolV> {
  return new BoolV(await comptroller.methods.checkMembership(user, bToken._address).call());
}

async function getAssetsIn(world: World, comptroller: Comptroller, user: string): Promise<ListV> {
  let assetsList = await comptroller.methods.getAssetsIn(user).call();

  return new ListV(assetsList.map((a) => new AddressV(a)));
}

async function getBaiMarkets(world: World, comptroller: Comptroller): Promise<ListV> {
  let mkts = await comptroller.methods.getBaiMarkets().call();

  return new ListV(mkts.map((a) => new AddressV(a)));
}

async function checkListed(world: World, comptroller: Comptroller, bToken: BToken): Promise<BoolV> {
  let {0: isListed, 1: _collateralFactorMantissa} = await comptroller.methods.markets(bToken._address).call();

  return new BoolV(isListed);
}

async function checkIsBai(world: World, comptroller: Comptroller, bToken: BToken): Promise<BoolV> {
  let {0: isListed, 1: _collateralFactorMantissa, 2: isBai} = await comptroller.methods.markets(bToken._address).call();
  return new BoolV(isBai);
}


export function comptrollerFetchers() {
  return [
    new Fetcher<{comptroller: Comptroller}, AddressV>(`
        #### Address

        * "Comptroller Address" - Returns address of comptroller
      `,
      "Address",
      [new Arg("comptroller", getComptroller, {implicit: true})],
      (world, {comptroller}) => getComptrollerAddress(world, comptroller)
    ),
    new Fetcher<{comptroller: Comptroller, account: AddressV}, NumberV>(`
        #### Liquidity

        * "Comptroller Liquidity <User>" - Returns a given user's trued up liquidity
          * E.g. "Comptroller Liquidity Geoff"
      `,
      "Liquidity",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("account", getAddressV)
      ],
      (world, {comptroller, account}) => getLiquidity(world, comptroller, account.val)
    ),
    new Fetcher<{comptroller: Comptroller, account: AddressV, action: StringV, amount: NumberV, bToken: BToken}, NumberV>(`
        #### Hypothetical

        * "Comptroller Hypothetical <User> <Action> <Asset> <Number>" - Returns a given user's trued up liquidity given a hypothetical change in asset with redeeming a certain number of tokens and/or borrowing a given amount.
          * E.g. "Comptroller Hypothetical Geoff Redeems 6.0 vZRX"
          * E.g. "Comptroller Hypothetical Geoff Borrows 5.0 vZRX"
      `,
      "Hypothetical",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("account", getAddressV),
        new Arg("action", getStringV),
        new Arg("amount", getNumberV),
        new Arg("bToken", getBTokenV)
      ],
      async (world, {comptroller, account, action, bToken, amount}) => {
        let redeemTokens: NumberV;
        let borrowAmount: NumberV;

        switch (action.val.toLowerCase()) {
          case "borrows":
            redeemTokens = new NumberV(0);
            borrowAmount = amount;
            break;
          case "redeems":
            redeemTokens = amount;
            borrowAmount = new NumberV(0);
            break;
          default:
            throw new Error(`Unknown hypothetical: ${action.val}`);
        }

        return await getHypotheticalLiquidity(world, comptroller, account.val, bToken._address, redeemTokens.encode(), borrowAmount.encode());
      }
    ),
    new Fetcher<{comptroller: Comptroller}, AddressV>(`
        #### Admin

        * "Comptroller Admin" - Returns the Comptrollers's admin
          * E.g. "Comptroller Admin"
      `,
      "Admin",
      [new Arg("comptroller", getComptroller, {implicit: true})],
      (world, {comptroller}) => getAdmin(world, comptroller)
    ),
    new Fetcher<{comptroller: Comptroller}, AddressV>(`
        #### PendingAdmin

        * "Comptroller PendingAdmin" - Returns the pending admin of the Comptroller
          * E.g. "Comptroller PendingAdmin" - Returns Comptroller's pending admin
      `,
      "PendingAdmin",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
      ],
      (world, {comptroller}) => getPendingAdmin(world, comptroller)
    ),
    new Fetcher<{comptroller: Comptroller}, AddressV>(`
        #### PriceOracle

        * "Comptroller PriceOracle" - Returns the Comptrollers's price oracle
          * E.g. "Comptroller PriceOracle"
      `,
      "PriceOracle",
      [new Arg("comptroller", getComptroller, {implicit: true})],
      (world, {comptroller}) => getPriceOracle(world, comptroller)
    ),
    new Fetcher<{comptroller: Comptroller}, NumberV>(`
        #### CloseFactor

        * "Comptroller CloseFactor" - Returns the Comptrollers's price oracle
          * E.g. "Comptroller CloseFactor"
      `,
      "CloseFactor",
      [new Arg("comptroller", getComptroller, {implicit: true})],
      (world, {comptroller}) => getCloseFactor(world, comptroller)
    ),
    new Fetcher<{comptroller: Comptroller}, NumberV>(`
        #### MaxAssets

        * "Comptroller MaxAssets" - Returns the Comptrollers's price oracle
          * E.g. "Comptroller MaxAssets"
      `,
      "MaxAssets",
      [new Arg("comptroller", getComptroller, {implicit: true})],
      (world, {comptroller}) => getMaxAssets(world, comptroller)
    ),
    new Fetcher<{comptroller: Comptroller}, NumberV>(`
        #### LiquidationIncentive

        * "Comptroller LiquidationIncentive" - Returns the Comptrollers's liquidation incentive
          * E.g. "Comptroller LiquidationIncentive"
      `,
      "LiquidationIncentive",
      [new Arg("comptroller", getComptroller, {implicit: true})],
      (world, {comptroller}) => getLiquidationIncentive(world, comptroller)
    ),
    new Fetcher<{comptroller: Comptroller}, AddressV>(`
        #### Implementation

        * "Comptroller Implementation" - Returns the Comptrollers's implementation
          * E.g. "Comptroller Implementation"
      `,
      "Implementation",
      [new Arg("comptroller", getComptroller, {implicit: true})],
      (world, {comptroller}) => getImplementation(world, comptroller)
    ),
    new Fetcher<{comptroller: Comptroller}, NumberV>(`
        #### BlockNumber

        * "Comptroller BlockNumber" - Returns the Comptrollers's mocked block number (for scenario runner)
          * E.g. "Comptroller BlockNumber"
      `,
      "BlockNumber",
      [new Arg("comptroller", getComptroller, {implicit: true})],
      (world, {comptroller}) => getBlockNumber(world, comptroller)
    ),
    new Fetcher<{comptroller: Comptroller, bToken: BToken}, NumberV>(`
        #### CollateralFactor

        * "Comptroller CollateralFactor <BToken>" - Returns the collateralFactor associated with a given asset
          * E.g. "Comptroller CollateralFactor vZRX"
      `,
      "CollateralFactor",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("bToken", getBTokenV)
      ],
      (world, {comptroller, bToken}) => getCollateralFactor(world, comptroller, bToken)
    ),
    new Fetcher<{comptroller: Comptroller, account: AddressV}, NumberV>(`
        #### MembershipLength

        * "Comptroller MembershipLength <User>" - Returns a given user's length of membership
          * E.g. "Comptroller MembershipLength Geoff"
      `,
      "MembershipLength",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("account", getAddressV)
      ],
      (world, {comptroller, account}) => membershipLength(world, comptroller, account.val)
    ),
    new Fetcher<{comptroller: Comptroller, account: AddressV, bToken: BToken}, BoolV>(`
        #### CheckMembership

        * "Comptroller CheckMembership <User> <BToken>" - Returns one if user is in asset, zero otherwise.
          * E.g. "Comptroller CheckMembership Geoff vZRX"
      `,
      "CheckMembership",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("account", getAddressV),
        new Arg("bToken", getBTokenV)
      ],
      (world, {comptroller, account, bToken}) => checkMembership(world, comptroller, account.val, bToken)
    ),
    new Fetcher<{comptroller: Comptroller, account: AddressV}, ListV>(`
        #### AssetsIn

        * "Comptroller AssetsIn <User>" - Returns the assets a user is in
          * E.g. "Comptroller AssetsIn Geoff"
      `,
      "AssetsIn",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("account", getAddressV)
      ],
      (world, {comptroller, account}) => getAssetsIn(world, comptroller, account.val)
    ),
    new Fetcher<{comptroller: Comptroller, bToken: BToken}, BoolV>(`
        #### CheckListed

        * "Comptroller CheckListed <BToken>" - Returns true if market is listed, false otherwise.
          * E.g. "Comptroller CheckListed vZRX"
      `,
      "CheckListed",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("bToken", getBTokenV)
      ],
      (world, {comptroller, bToken}) => checkListed(world, comptroller, bToken)
    ),
    new Fetcher<{comptroller: Comptroller, bToken: BToken}, BoolV>(`
        #### CheckIsBai

        * "Comptroller CheckIsBai <BToken>" - Returns true if market is listed, false otherwise.
          * E.g. "Comptroller CheckIsBai vZRX"
      `,
      "CheckIsBai",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("bToken", getBTokenV)
      ],
      (world, {comptroller, bToken}) => checkIsBai(world, comptroller, bToken)
    ),

    new Fetcher<{comptroller: Comptroller}, BoolV>(`
        #### _ProtocolPaused

        * "_ProtocolPaused" - Returns the Comptrollers's original protocol paused status
        * E.g. "Comptroller _ProtocolPaused"
        `,
        "_ProtocolPaused",
        [new Arg("comptroller", getComptroller, {implicit: true})],
        async (world, {comptroller}) => new BoolV(await comptroller.methods.protocolPaused().call())
    ),
    new Fetcher<{comptroller: Comptroller}, ListV>(`
      #### GetBaiMarkets

      * "GetBaiMarkets" - Returns an array of the currently enabled Bai markets. To use the auto-gen array getter venusMarkets(uint), use BaiMarkets
      * E.g. "Comptroller GetBaiMarkets"
      `,
      "GetBaiMarkets",
      [new Arg("comptroller", getComptroller, {implicit: true})],
      async(world, {comptroller}) => await getBaiMarkets(world, comptroller)
     ),

    new Fetcher<{comptroller: Comptroller}, NumberV>(`
      #### BaiRate

      * "BaiRate" - Returns the current xvs rate.
      * E.g. "Comptroller BaiRate"
      `,
      "BaiRate",
      [new Arg("comptroller", getComptroller, {implicit: true})],
      async(world, {comptroller}) => new NumberV(await comptroller.methods.venusRate().call())
    ),

    new Fetcher<{comptroller: Comptroller, signature: StringV, callArgs: StringV[]}, NumberV>(`
        #### CallNum

        * "CallNum signature:<String> ...callArgs<CoreValue>" - Simple direct call method
          * E.g. "Comptroller CallNum \"venusSpeeds(address)\" (Address Coburn)"
      `,
      "CallNum",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("signature", getStringV),
        new Arg("callArgs", getCoreValue, {variadic: true, mapped: true})
      ],
      async (world, {comptroller, signature, callArgs}) => {
        const fnData = encodeABI(world, signature.val, callArgs.map(a => a.val));
        const res = await world.web3.eth.call({
            to: comptroller._address,
            data: fnData
          })
        const resNum : any = world.web3.eth.abi.decodeParameter('uint256',res);
        return new NumberV(resNum);
      }
    ),
    new Fetcher<{comptroller: Comptroller, BToken: BToken, key: StringV}, NumberV>(`
        #### BaiSupplyState(address)

        * "Comptroller BaiBorrowState vZRX "index"
      `,
      "BaiSupplyState",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("BToken", getBTokenV),
        new Arg("key", getStringV),
      ],
      async (world, {comptroller, BToken, key}) => {
        const result = await comptroller.methods.venusSupplyState(BToken._address).call();
        return new NumberV(result[key.val]);
      }
    ),
    new Fetcher<{comptroller: Comptroller, BToken: BToken, key: StringV}, NumberV>(`
        #### BaiBorrowState(address)

        * "Comptroller BaiBorrowState vZRX "index"
      `,
      "BaiBorrowState",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("BToken", getBTokenV),
        new Arg("key", getStringV),
      ],
      async (world, {comptroller, BToken, key}) => {
        const result = await comptroller.methods.venusBorrowState(BToken._address).call();
        return new NumberV(result[key.val]);
      }
    ),
    new Fetcher<{comptroller: Comptroller, account: AddressV, key: StringV}, NumberV>(`
        #### BaiAccrued(address)

        * "Comptroller BaiAccrued Coburn
      `,
      "BaiAccrued",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("account", getAddressV),
      ],
      async (world, {comptroller,account}) => {
        const result = await comptroller.methods.venusAccrued(account.val).call();
        return new NumberV(result);
      }
    ),
    new Fetcher<{comptroller: Comptroller, BToken: BToken, account: AddressV}, NumberV>(`
        #### venusSupplierIndex

        * "Comptroller BaiSupplierIndex vZRX Coburn
      `,
      "BaiSupplierIndex",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("BToken", getBTokenV),
        new Arg("account", getAddressV),
      ],
      async (world, {comptroller, BToken, account}) => {
        return new NumberV(await comptroller.methods.venusSupplierIndex(BToken._address, account.val).call());
      }
    ),
    new Fetcher<{comptroller: Comptroller, BToken: BToken, account: AddressV}, NumberV>(`
        #### BaiBorrowerIndex

        * "Comptroller BaiBorrowerIndex vZRX Coburn
      `,
      "BaiBorrowerIndex",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("BToken", getBTokenV),
        new Arg("account", getAddressV),
      ],
      async (world, {comptroller, BToken, account}) => {
        return new NumberV(await comptroller.methods.venusBorrowerIndex(BToken._address, account.val).call());
      }
    ),
    new Fetcher<{comptroller: Comptroller, BToken: BToken}, NumberV>(`
        #### BaiSpeed

        * "Comptroller BaiSpeed vZRX
      `,
      "BaiSpeed",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("BToken", getBTokenV),
      ],
      async (world, {comptroller, BToken}) => {
        return new NumberV(await comptroller.methods.venusSpeeds(BToken._address).call());
      }
    ),
    new Fetcher<{comptroller: Comptroller}, AddressV>(`
        #### BorrowCapGuardian
        * "BorrowCapGuardian" - Returns the Comptrollers's BorrowCapGuardian
        * E.g. "Comptroller BorrowCapGuardian"
        `,
        "BorrowCapGuardian",
        [
          new Arg("comptroller", getComptroller, {implicit: true})
        ],
        async (world, {comptroller}) => new AddressV(await comptroller.methods.borrowCapGuardian().call())
    ),
    new Fetcher<{comptroller: Comptroller, BToken: BToken}, NumberV>(`
        #### BorrowCaps
        * "Comptroller BorrowCaps vZRX
      `,
      "BorrowCaps",
      [
        new Arg("comptroller", getComptroller, {implicit: true}),
        new Arg("BToken", getBTokenV),
      ],
      async (world, {comptroller, BToken}) => {
        return new NumberV(await comptroller.methods.borrowCaps(BToken._address).call());
      }
    )
  ];
}

export async function getComptrollerValue(world: World, event: Event): Promise<Value> {
  return await getFetcherValue<any, any>("Comptroller", comptrollerFetchers(), world, event);
}
