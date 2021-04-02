"use strict";

const { dfn } = require('./JS');
const {
  encodeParameters,
  bnbBalance,
  bnbMantissa,
  bnbUnsigned,
  mergeInterface
} = require('./BSC');

async function makeComptroller(opts = {}) {
  const {
    root = saddle.account,
    kind = 'unitroller'
  } = opts || {};

  if (kind == 'bool') {
    return await deploy('BoolComptroller');
  }

  if (kind == 'false-marker') {
    return await deploy('FalseMarkerMethodComptroller');
  }

  if (kind == 'v1-no-proxy') {
    const comptroller = await deploy('ComptrollerHarness');
    const priceOracle = opts.priceOracle || await makePriceOracle(opts.priceOracleOpts);
    const closeFactor = bnbMantissa(dfn(opts.closeFactor, .051));
    const maxAssets = bnbUnsigned(dfn(opts.maxAssets, 10));

    await send(comptroller, '_setCloseFactor', [closeFactor]);
    await send(comptroller, '_setMaxAssets', [maxAssets]);
    await send(comptroller, '_setPriceOracle', [priceOracle._address]);

    return Object.assign(comptroller, { priceOracle });
  }

  if (kind == 'unitroller-g2') {
    const unitroller = opts.unitroller || await deploy('Unitroller');
    const comptroller = await deploy('ComptrollerScenarioG2');
    const priceOracle = opts.priceOracle || await makePriceOracle(opts.priceOracleOpts);
    const closeFactor = bnbMantissa(dfn(opts.closeFactor, .051));
    const liquidationIncentive = bnbMantissa(1);
    const xvs = opts.xvs || await deploy('XBID', [opts.compOwner || root]);
    const venusRate = bnbUnsigned(dfn(opts.venusRate, 1e18));

    await send(unitroller, '_setPendingImplementation', [comptroller._address]);
    await send(comptroller, '_become', [unitroller._address]);
    mergeInterface(unitroller, comptroller);
    await send(unitroller, '_setLiquidationIncentive', [liquidationIncentive]);
    await send(unitroller, '_setCloseFactor', [closeFactor]);
    await send(unitroller, '_setPriceOracle', [priceOracle._address]);
    await send(unitroller, 'harnessSetBaiRate', [venusRate]);
    await send(unitroller, 'setXBIDAddress', [xvs._address]); // harness only

    return Object.assign(unitroller, { priceOracle, xvs });
  }

  if (kind == 'unitroller') {
    const unitroller = opts.unitroller || await deploy('Unitroller');
    const comptroller = await deploy('ComptrollerHarness');
    const priceOracle = opts.priceOracle || await makePriceOracle(opts.priceOracleOpts);
    const closeFactor = bnbMantissa(dfn(opts.closeFactor, .051));
    const maxAssets = bnbUnsigned(dfn(opts.maxAssets, 10));
    const liquidationIncentive = bnbMantissa(1);
    const xvs = opts.xvs || await deploy('XBID', [opts.venusOwner || root]);
    const vai = opts.vai || await makeBAI();
    const venusRate = bnbUnsigned(dfn(opts.venusRate, 1e18));
    const venusBAIRate = bnbUnsigned(dfn(opts.venusBAIRate, 5e17));
    const venusMarkets = opts.venusMarkets || [];

    await send(unitroller, '_setPendingImplementation', [comptroller._address]);
    await send(comptroller, '_become', [unitroller._address]);
    mergeInterface(unitroller, comptroller);

    const vaiunitroller = await deploy('BAIUnitroller');
    const vaicontroller = await deploy('BAIControllerHarness');
    
    await send(vaiunitroller, '_setPendingImplementation', [vaicontroller._address]);
    await send(vaicontroller, '_become', [vaiunitroller._address]);
    mergeInterface(vaiunitroller, vaicontroller);

    await send(unitroller, '_setBAIController', [vaiunitroller._address]);
    await send(vaiunitroller, '_setComptroller', [unitroller._address]);
    await send(unitroller, '_setLiquidationIncentive', [liquidationIncentive]);
    await send(unitroller, '_setCloseFactor', [closeFactor]);
    await send(unitroller, '_setMaxAssets', [maxAssets]);
    await send(unitroller, '_setPriceOracle', [priceOracle._address]);
    await send(unitroller, 'setXBIDAddress', [xvs._address]); // harness only
    await send(vaiunitroller, 'setBAIAddress', [vai._address]); // harness only
    await send(unitroller, 'harnessSetBaiRate', [venusRate]);
    await send(unitroller, '_setBaiBAIRate', [venusBAIRate]);
    await send(vaiunitroller, '_initializeBaiBAIState', [0]);
    await send(vai, 'rely', [unitroller._address]);

    return Object.assign(unitroller, { priceOracle, xvs, vai, vaiunitroller });
  }
}

async function makeBToken(opts = {}) {
  const {
    root = saddle.account,
    kind = 'vbep20'
  } = opts || {};

  const comptroller = opts.comptroller || await makeComptroller(opts.comptrollerOpts);
  const interestRateModel = opts.interestRateModel || await makeInterestRateModel(opts.interestRateModelOpts);
  const exchangeRate = bnbMantissa(dfn(opts.exchangeRate, 1));
  const decimals = bnbUnsigned(dfn(opts.decimals, 8));
  const symbol = opts.symbol || (kind === 'vbnb' ? 'vBNB' : 'vOMG');
  const name = opts.name || `BToken ${symbol}`;
  const admin = opts.admin || root;

  let bToken, underlying;
  let vDelegator, vDelegatee, vDaiMaker;

  switch (kind) {
    case 'vbnb':
      bToken = await deploy('BBNBHarness',
        [
          comptroller._address,
          interestRateModel._address,
          exchangeRate,
          name,
          symbol,
          decimals,
          admin
        ])
      break;

    case 'vdai':
      vDaiMaker  = await deploy('BDaiDelegateMakerHarness');
      underlying = vDaiMaker;
      vDelegatee = await deploy('BDaiDelegateHarness');
      vDelegator = await deploy('BBep20Delegator',
        [
          underlying._address,
          comptroller._address,
          interestRateModel._address,
          exchangeRate,
          name,
          symbol,
          decimals,
          admin,
          vDelegatee._address,
          encodeParameters(['address', 'address'], [vDaiMaker._address, vDaiMaker._address])
        ]
      );
      bToken = await saddle.getContractAt('BDaiDelegateHarness', vDelegator._address); // XXXS at
      break;

    case 'vbep20':
    default:
      underlying = opts.underlying || await makeToken(opts.underlyingOpts);
      vDelegatee = await deploy('BBep20DelegateHarness');
      vDelegator = await deploy('BBep20Delegator',
        [
          underlying._address,
          comptroller._address,
          interestRateModel._address,
          exchangeRate,
          name,
          symbol,
          decimals,
          admin,
          vDelegatee._address,
          "0x0"
        ]
      );
      bToken = await saddle.getContractAt('BBep20DelegateHarness', vDelegator._address); // XXXS at
      break;
  }

  if (opts.supportMarket) {
    await send(comptroller, '_supportMarket', [bToken._address]);
  }

  if (opts.addBaiMarket) {
    await send(comptroller, '_addBaiMarket', [bToken._address]);
  }

  if (opts.underlyingPrice) {
    const price = bnbMantissa(opts.underlyingPrice);
    await send(comptroller.priceOracle, 'setUnderlyingPrice', [bToken._address, price]);
  }

  if (opts.collateralFactor) {
    const factor = bnbMantissa(opts.collateralFactor);
    expect(await send(comptroller, '_setCollateralFactor', [bToken._address, factor])).toSucceed();
  }

  return Object.assign(bToken, { name, symbol, underlying, comptroller, interestRateModel });
}

async function makeBAI(opts = {}) {
  const {
    chainId = 97
  } = opts || {};

  let vai;

  vai = await deploy('BAIHarness',
    [
      chainId
    ]
  );

  return Object.assign(vai);
}

async function makeInterestRateModel(opts = {}) {
  const {
    root = saddle.account,
    kind = 'harnessed'
  } = opts || {};

  if (kind == 'harnessed') {
    const borrowRate = bnbMantissa(dfn(opts.borrowRate, 0));
    return await deploy('InterestRateModelHarness', [borrowRate]);
  }

  if (kind == 'false-marker') {
    const borrowRate = bnbMantissa(dfn(opts.borrowRate, 0));
    return await deploy('FalseMarkerMethodInterestRateModel', [borrowRate]);
  }

  if (kind == 'white-paper') {
    const baseRate = bnbMantissa(dfn(opts.baseRate, 0));
    const multiplier = bnbMantissa(dfn(opts.multiplier, 1e-18));
    return await deploy('WhitePaperInterestRateModel', [baseRate, multiplier]);
  }

  if (kind == 'jump-rate') {
    const baseRate = bnbMantissa(dfn(opts.baseRate, 0));
    const multiplier = bnbMantissa(dfn(opts.multiplier, 1e-18));
    const jump = bnbMantissa(dfn(opts.jump, 0));
    const kink = bnbMantissa(dfn(opts.kink, 0));
    return await deploy('JumpRateModel', [baseRate, multiplier, jump, kink]);
  }
}

async function makePriceOracle(opts = {}) {
  const {
    root = saddle.account,
    kind = 'simple'
  } = opts || {};

  if (kind == 'simple') {
    return await deploy('SimplePriceOracle');
  }
}

async function makeToken(opts = {}) {
  const {
    root = saddle.account,
    kind = 'bep20'
  } = opts || {};

  if (kind == 'bep20') {
    const quantity = bnbUnsigned(dfn(opts.quantity, 1e25));
    const decimals = bnbUnsigned(dfn(opts.decimals, 18));
    const symbol = opts.symbol || 'OMG';
    const name = opts.name || `Bep20 ${symbol}`;
    return await deploy('BEP20Harness', [quantity, name, decimals, symbol]);
  }
}

async function balanceOf(token, account) {
  return bnbUnsigned(await call(token, 'balanceOf', [account]));
}

async function totalSupply(token) {
  return bnbUnsigned(await call(token, 'totalSupply'));
}

async function borrowSnapshot(bToken, account) {
  const { principal, interestIndex } = await call(bToken, 'harnessAccountBorrows', [account]);
  return { principal: bnbUnsigned(principal), interestIndex: bnbUnsigned(interestIndex) };
}

async function totalBorrows(bToken) {
  return bnbUnsigned(await call(bToken, 'totalBorrows'));
}

async function totalReserves(bToken) {
  return bnbUnsigned(await call(bToken, 'totalReserves'));
}

async function enterMarkets(bTokens, from) {
  return await send(bTokens[0].comptroller, 'enterMarkets', [bTokens.map(c => c._address)], { from });
}

async function fastForward(bToken, blocks = 5) {
  return await send(bToken, 'harnessFastForward', [blocks]);
}

async function setBalance(bToken, account, balance) {
  return await send(bToken, 'harnessSetBalance', [account, balance]);
}

async function setBNBBalance(vBnb, balance) {
  const current = await bnbBalance(vBnb._address);
  const root = saddle.account;
  expect(await send(vBnb, 'harnessDoTransferOut', [root, current])).toSucceed();
  expect(await send(vBnb, 'harnessDoTransferIn', [root, balance], { value: balance })).toSucceed();
}

async function getBalances(bTokens, accounts) {
  const balances = {};
  for (let bToken of bTokens) {
    const cBalances = balances[bToken._address] = {};
    for (let account of accounts) {
      cBalances[account] = {
        bnb: await bnbBalance(account),
        cash: bToken.underlying && await balanceOf(bToken.underlying, account),
        tokens: await balanceOf(bToken, account),
        borrows: (await borrowSnapshot(bToken, account)).principal
      };
    }
    cBalances[bToken._address] = {
      bnb: await bnbBalance(bToken._address),
      cash: bToken.underlying && await balanceOf(bToken.underlying, bToken._address),
      tokens: await totalSupply(bToken),
      borrows: await totalBorrows(bToken),
      reserves: await totalReserves(bToken)
    };
  }
  return balances;
}

async function adjustBalances(balances, deltas) {
  for (let delta of deltas) {
    let bToken, account, key, diff;
    if (delta.length == 4) {
      ([bToken, account, key, diff] = delta);
    } else {
      ([bToken, key, diff] = delta);
      account = bToken._address;
    }
    balances[bToken._address][account][key] = balances[bToken._address][account][key].add(diff);
  }
  return balances;
}


async function preApprove(bToken, from, amount, opts = {}) {
  if (dfn(opts.faucet, true)) {
    expect(await send(bToken.underlying, 'harnessSetBalance', [from, amount], { from })).toSucceed();
  }

  return send(bToken.underlying, 'approve', [bToken._address, amount], { from });
}

async function quickMint(bToken, minter, mintAmount, opts = {}) {
  // make sure to accrue interest
  await fastForward(bToken, 1);

  if (dfn(opts.approve, true)) {
    expect(await preApprove(bToken, minter, mintAmount, opts)).toSucceed();
  }
  if (dfn(opts.exchangeRate)) {
    expect(await send(bToken, 'harnessSetExchangeRate', [bnbMantissa(opts.exchangeRate)])).toSucceed();
  }
  return send(bToken, 'mint', [mintAmount], { from: minter });
}

async function quickMintBAI(comptroller, vai, vaiMinter, vaiMintAmount, opts = {}) {
  // make sure to accrue interest
  await fastForward(vai, 1);

  expect(await send(vai, 'harnessSetBalanceOf', [vaiMinter, vaiMintAmount], { vaiMinter })).toSucceed();
  expect(await send(comptroller, 'harnessSetMintedBAIs', [vaiMinter, vaiMintAmount], { vaiMinter })).toSucceed();
  expect(await send(vai, 'harnessIncrementTotalSupply', [vaiMintAmount], { vaiMinter })).toSucceed();
}

async function preSupply(bToken, account, tokens, opts = {}) {
  if (dfn(opts.total, true)) {
    expect(await send(bToken, 'harnessSetTotalSupply', [tokens])).toSucceed();
  }
  return send(bToken, 'harnessSetBalance', [account, tokens]);
}

async function quickRedeem(bToken, redeemer, redeemTokens, opts = {}) {
  await fastForward(bToken, 1);

  if (dfn(opts.supply, true)) {
    expect(await preSupply(bToken, redeemer, redeemTokens, opts)).toSucceed();
  }
  if (dfn(opts.exchangeRate)) {
    expect(await send(bToken, 'harnessSetExchangeRate', [bnbMantissa(opts.exchangeRate)])).toSucceed();
  }
  return send(bToken, 'redeem', [redeemTokens], { from: redeemer });
}

async function quickRedeemUnderlying(bToken, redeemer, redeemAmount, opts = {}) {
  await fastForward(bToken, 1);

  if (dfn(opts.exchangeRate)) {
    expect(await send(bToken, 'harnessSetExchangeRate', [bnbMantissa(opts.exchangeRate)])).toSucceed();
  }
  return send(bToken, 'redeemUnderlying', [redeemAmount], { from: redeemer });
}

async function setOraclePrice(bToken, price) {
  return send(bToken.comptroller.priceOracle, 'setUnderlyingPrice', [bToken._address, bnbMantissa(price)]);
}

async function setBorrowRate(bToken, rate) {
  return send(bToken.interestRateModel, 'setBorrowRate', [bnbMantissa(rate)]);
}

async function getBorrowRate(interestRateModel, cash, borrows, reserves) {
  return call(interestRateModel, 'getBorrowRate', [cash, borrows, reserves].map(bnbUnsigned));
}

async function getSupplyRate(interestRateModel, cash, borrows, reserves, reserveFactor) {
  return call(interestRateModel, 'getSupplyRate', [cash, borrows, reserves, reserveFactor].map(bnbUnsigned));
}

async function pretendBorrow(bToken, borrower, accountIndex, marketIndex, principalRaw, blockNumber = 2e7) {
  await send(bToken, 'harnessSetTotalBorrows', [bnbUnsigned(principalRaw)]);
  await send(bToken, 'harnessSetAccountBorrows', [borrower, bnbUnsigned(principalRaw), bnbMantissa(accountIndex)]);
  await send(bToken, 'harnessSetBorrowIndex', [bnbMantissa(marketIndex)]);
  await send(bToken, 'harnessSetAccrualBlockNumber', [bnbUnsigned(blockNumber)]);
  await send(bToken, 'harnessSetBlockNumber', [bnbUnsigned(blockNumber)]);
}

async function pretendBAIMint(vai, vaiMinter, accountIndex, totalSupply, blockNumber = 2e7) {
  await send(vai, 'harnessIncrementTotalSupply', [bnbUnsigned(totalSupply)]);
  await send(vai, 'harnessSetBalanceOf', [vaiMinter, bnbUnsigned(totalSupply), bnbMantissa(accountIndex)]);
}

module.exports = {
  makeComptroller,
  makeBToken,
  makeBAI,
  makeInterestRateModel,
  makePriceOracle,
  makeToken,

  balanceOf,
  totalSupply,
  borrowSnapshot,
  totalBorrows,
  totalReserves,
  enterMarkets,
  fastForward,
  setBalance,
  setBNBBalance,
  getBalances,
  adjustBalances,

  preApprove,
  quickMint,
  quickMintBAI,

  preSupply,
  quickRedeem,
  quickRedeemUnderlying,

  setOraclePrice,
  setBorrowRate,
  getBorrowRate,
  getSupplyRate,
  pretendBorrow,
  pretendBAIMint
};
