const {
  bnbUnsigned,
  bnbMantissa,
  bnbExp,
} = require('./Utils/BSC');

const {
  makeComptroller,
  makeBToken,
  preApprove,
  preSupply,
  quickRedeem,
} = require('./Utils/Bai');

async function xvsBalance(comptroller, user) {
  return bnbUnsigned(await call(comptroller.xvs, 'balanceOf', [user]))
}

async function venusAccrued(comptroller, user) {
  return bnbUnsigned(await call(comptroller, 'venusAccrued', [user]));
}

async function fastForwardPatch(patch, comptroller, blocks) {
  if (patch == 'unitroller') {
    return await send(comptroller, 'harnessFastForward', [blocks]);
  } else {
    return await send(comptroller, 'fastForward', [blocks]);
  }
}

const fs = require('fs');
const util = require('util');
const diffStringsUnified = require('jest-diff').default;


async function preRedeem(
  bToken,
  redeemer,
  redeemTokens,
  redeemAmount,
  exchangeRate
) {
  await preSupply(bToken, redeemer, redeemTokens);
  await send(bToken.underlying, 'harnessSetBalance', [
    bToken._address,
    redeemAmount
  ]);
}

const sortOpcodes = (opcodesMap) => {
  return Object.values(opcodesMap)
    .map(elem => [elem.fee, elem.name])
    .sort((a, b) => b[0] - a[0]);
};

const getGasCostFile = name => {
  try {
    const jsonString = fs.readFileSync(name);
    return JSON.parse(jsonString);
  } catch (err) {
    console.log(err);
    return {};
  }
};

const recordGasCost = (totalFee, key, filename, opcodes = {}) => {
  let fileObj = getGasCostFile(filename);
  const newCost = {fee: totalFee, opcodes: opcodes};
  console.log(diffStringsUnified(fileObj[key], newCost));
  fileObj[key] = newCost;
  fs.writeFileSync(filename, JSON.stringify(fileObj, null, ' '), 'utf-8');
};

async function mint(bToken, minter, mintAmount, exchangeRate) {
  expect(await preApprove(bToken, minter, mintAmount, {})).toSucceed();
  return send(bToken, 'mint', [mintAmount], { from: minter });
}

async function claimBai(comptroller, holder) {
  return send(comptroller, 'claimBai', [holder], { from: holder });
}

/// GAS PROFILER: saves a digest of the gas prices of common BToken operations
/// transiently fails, not sure why

describe('Gas report', () => {
  let root, minter, redeemer, accounts, bToken;
  const exchangeRate = 50e3;
  const preMintAmount = bnbUnsigned(30e4);
  const mintAmount = bnbUnsigned(10e4);
  const mintTokens = mintAmount.div(exchangeRate);
  const redeemTokens = bnbUnsigned(10e3);
  const redeemAmount = redeemTokens.multipliedBy(exchangeRate);
  const filename = './gasCosts.json';

  describe('BToken', () => {
    beforeEach(async () => {
      [root, minter, redeemer, ...accounts] = saddle.accounts;
      bToken = await makeBToken({
        comptrollerOpts: { kind: 'bool'}, 
        interestRateModelOpts: { kind: 'white-paper'},
        exchangeRate
      });
    });

    it('first mint', async () => {
      await send(bToken, 'harnessSetAccrualBlockNumber', [40]);
      await send(bToken, 'harnessSetBlockNumber', [41]);

      const trxReceipt = await mint(bToken, minter, mintAmount, exchangeRate);
      recordGasCost(trxReceipt.gasUsed, 'first mint', filename);
    });

    it('second mint', async () => {
      await mint(bToken, minter, mintAmount, exchangeRate);

      await send(bToken, 'harnessSetAccrualBlockNumber', [40]);
      await send(bToken, 'harnessSetBlockNumber', [41]);

      const mint2Receipt = await mint(bToken, minter, mintAmount, exchangeRate);
      expect(Object.keys(mint2Receipt.events)).toEqual(['AccrueInterest', 'Transfer', 'Mint']);

      console.log(mint2Receipt.gasUsed);
      const opcodeCount = {};

      await saddle.trace(mint2Receipt, {
        execLog: log => {
          if (log.lastLog != undefined) {
            const key = `${log.op} @ ${log.gasCost}`;
            opcodeCount[key] = (opcodeCount[key] || 0) + 1;
          }
        }
      });

      recordGasCost(mint2Receipt.gasUsed, 'second mint', filename, opcodeCount);
    });

    it('second mint, no interest accrued', async () => {
      await mint(bToken, minter, mintAmount, exchangeRate);

      await send(bToken, 'harnessSetAccrualBlockNumber', [40]);
      await send(bToken, 'harnessSetBlockNumber', [40]);

      const mint2Receipt = await mint(bToken, minter, mintAmount, exchangeRate);
      expect(Object.keys(mint2Receipt.events)).toEqual(['Transfer', 'Mint']);
      recordGasCost(mint2Receipt.gasUsed, 'second mint, no interest accrued', filename);

      // console.log("NO ACCRUED");
      // const opcodeCount = {};
      // await saddle.trace(mint2Receipt, {
      //   execLog: log => {
      //     opcodeCount[log.op] = (opcodeCount[log.op] || 0) + 1;
      //   }
      // });
      // console.log(getOpcodeDigest(opcodeCount));
    });

    it('redeem', async () => {
      await preRedeem(bToken, redeemer, redeemTokens, redeemAmount, exchangeRate);
      const trxReceipt = await quickRedeem(bToken, redeemer, redeemTokens);
      recordGasCost(trxReceipt.gasUsed, 'redeem', filename);
    });

    it.skip('print mint opcode list', async () => {
      await preMint(bToken, minter, mintAmount, mintTokens, exchangeRate);
      const trxReceipt = await quickMint(bToken, minter, mintAmount);
      const opcodeCount = {};
      await saddle.trace(trxReceipt, {
        execLog: log => {
          opcodeCount[log.op] = (opcodeCount[log.op] || 0) + 1;
        }
      });
      console.log(getOpcodeDigest(opcodeCount));
    });
  });

  describe.each([
    ['unitroller-g2'],
    ['unitroller']
  ])('XBID claims %s', (patch) => {
    beforeEach(async () => {
      [root, minter, redeemer, ...accounts] = saddle.accounts;
      comptroller = await makeComptroller({ kind: patch });
      let interestRateModelOpts = {borrowRate: 0.000001};
      bToken = await makeBToken({comptroller, supportMarket: true, underlyingPrice: 2, interestRateModelOpts});
      if (patch == 'unitroller') {
        await send(comptroller, '_setBaiSpeed', [bToken._address, bnbExp(0.05)]);
      } else {
        await send(comptroller, '_addBaiMarkets', [[bToken].map(c => c._address)]);
        await send(comptroller, 'setBaiSpeed', [bToken._address, bnbExp(0.05)]);
      }
      await send(comptroller.xvs, 'transfer', [comptroller._address, bnbUnsigned(50e18)], {from: root});
    });

    it(`${patch} second mint with xvs accrued`, async () => {
      await mint(bToken, minter, mintAmount, exchangeRate);

      await fastForwardPatch(patch, comptroller, 10);

      console.log('XBID balance before mint', (await xvsBalance(comptroller, minter)).toString());
      console.log('XBID accrued before mint', (await venusAccrued(comptroller, minter)).toString());
      const mint2Receipt = await mint(bToken, minter, mintAmount, exchangeRate);
      console.log('XBID balance after mint', (await xvsBalance(comptroller, minter)).toString());
      console.log('XBID accrued after mint', (await venusAccrued(comptroller, minter)).toString());
      recordGasCost(mint2Receipt.gasUsed, `${patch} second mint with xvs accrued`, filename);
    });

    it(`${patch} claim xvs`, async () => {
      await mint(bToken, minter, mintAmount, exchangeRate);

      await fastForwardPatch(patch, comptroller, 10);

      console.log('XBID balance before claim', (await xvsBalance(comptroller, minter)).toString());
      console.log('XBID accrued before claim', (await venusAccrued(comptroller, minter)).toString());
      const claimReceipt = await claimBai(comptroller, minter);
      console.log('XBID balance after claim', (await xvsBalance(comptroller, minter)).toString());
      console.log('XBID accrued after claim', (await venusAccrued(comptroller, minter)).toString());
      recordGasCost(claimReceipt.gasUsed, `${patch} claim xvs`, filename);
    });
  });
});
