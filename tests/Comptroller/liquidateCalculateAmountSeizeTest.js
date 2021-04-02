const {bnbUnsigned} = require('../Utils/BSC');
const {
  makeComptroller,
  makeBToken,
  setOraclePrice
} = require('../Utils/Bai');

const borrowedPrice = 2e10;
const collateralPrice = 1e18;
const repayAmount = bnbUnsigned(1e18);

async function calculateSeizeTokens(comptroller, bTokenBorrowed, bTokenCollateral, repayAmount) {
  return call(comptroller, 'liquidateCalculateSeizeTokens', [bTokenBorrowed._address, bTokenCollateral._address, repayAmount]);
}

function rando(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

describe('Comptroller', () => {
  let root, accounts;
  let comptroller, bTokenBorrowed, bTokenCollateral;

  beforeEach(async () => {
    [root, ...accounts] = saddle.accounts;
    comptroller = await makeComptroller();
    bTokenBorrowed = await makeBToken({comptroller: comptroller, underlyingPrice: 0});
    bTokenCollateral = await makeBToken({comptroller: comptroller, underlyingPrice: 0});
  });

  beforeEach(async () => {
    await setOraclePrice(bTokenBorrowed, borrowedPrice);
    await setOraclePrice(bTokenCollateral, collateralPrice);
    await send(bTokenCollateral, 'harnessExchangeRateDetails', [8e10, 4e10, 0]);
  });

  describe('liquidateCalculateAmountSeize', () => {
    it("fails if either asset price is 0", async () => {
      await setOraclePrice(bTokenBorrowed, 0);
      expect(
        await calculateSeizeTokens(comptroller, bTokenBorrowed, bTokenCollateral, repayAmount)
      ).toHaveTrollErrorTuple(['PRICE_ERROR', 0]);

      await setOraclePrice(bTokenCollateral, 0);
      expect(
        await calculateSeizeTokens(comptroller, bTokenBorrowed, bTokenCollateral, repayAmount)
      ).toHaveTrollErrorTuple(['PRICE_ERROR', 0]);
    });

    it("fails if the repayAmount causes overflow ", async () => {
      expect(
        await calculateSeizeTokens(comptroller, bTokenBorrowed, bTokenCollateral, '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF')
      ).toHaveTrollErrorTuple(['MATH_ERROR', 0]);
    });

    it("fails if the borrowed asset price causes overflow ", async () => {
      await setOraclePrice(bTokenBorrowed, -1);
      expect(
        await calculateSeizeTokens(comptroller, bTokenBorrowed, bTokenCollateral, repayAmount)
      ).toHaveTrollErrorTuple(['MATH_ERROR', 0]);
    });

    it("reverts if it fails to calculate the exchange rate", async () => {
      await send(bTokenCollateral, 'harnessExchangeRateDetails', [1, 0, 10]); // (1 - 10) -> underflow
      await expect(
        send(comptroller, 'liquidateCalculateSeizeTokens', [bTokenBorrowed._address, bTokenCollateral._address, repayAmount])
      ).rejects.toRevert("revert exchangeRateStored: exchangeRateStoredInternal failed");
    });

    [
      [1e18, 1e18, 1e18, 1e18, 1e18],
      [2e18, 1e18, 1e18, 1e18, 1e18],
      [2e18, 2e18, 1.42e18, 1.3e18, 2.45e18],
      [2.789e18, 5.230480842e18, 771.32e18, 1.3e18, 10002.45e18],
      [ 7.009232529961056e+24,2.5278726317240445e+24,2.6177112093242585e+23,1179713989619784000,7.790468414639561e+24 ],
      [rando(0, 1e25), rando(0, 1e25), rando(1, 1e25), rando(1e18, 1.5e18), rando(0, 1e25)]
    ].forEach((testCase) => {
      it(`returns the correct value for ${testCase}`, async () => {
        const [exchangeRate, borrowedPrice, collateralPrice, liquidationIncentive, repayAmount] = testCase.map(bnbUnsigned);

        await setOraclePrice(bTokenCollateral, collateralPrice);
        await setOraclePrice(bTokenBorrowed, borrowedPrice);
        await send(comptroller, '_setLiquidationIncentive', [liquidationIncentive]);
        await send(bTokenCollateral, 'harnessSetExchangeRate', [exchangeRate]);

        const seizeAmount = repayAmount.mul(liquidationIncentive).mul(borrowedPrice).div(collateralPrice);
        const seizeTokens = seizeAmount.div(exchangeRate);

        expect(
          await calculateSeizeTokens(comptroller, bTokenBorrowed, bTokenCollateral, repayAmount)
        ).toHaveTrollErrorTuple(
          ['NO_ERROR', Number(seizeTokens)],
          (x, y) => Math.abs(x - y) < 1e7
        );
      });
    });
  });
});
