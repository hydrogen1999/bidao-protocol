const {
  bnbGasCost,
  bnbUnsigned
} = require('../Utils/BSC');

const {
  makeBToken,
  fastForward,
  setBalance,
  getBalances,
  adjustBalances,
  pretendBorrow,
  preApprove
} = require('../Utils/Bai');

const repayAmount = bnbUnsigned(10e2);
const seizeAmount = repayAmount;
const seizeTokens = seizeAmount.mul(4); // forced

async function preLiquidate(bToken, liquidator, borrower, repayAmount, bTokenCollateral) {
  // setup for success in liquidating
  await send(bToken.comptroller, 'setLiquidateBorrowAllowed', [true]);
  await send(bToken.comptroller, 'setLiquidateBorrowVerify', [true]);
  await send(bToken.comptroller, 'setRepayBorrowAllowed', [true]);
  await send(bToken.comptroller, 'setRepayBorrowVerify', [true]);
  await send(bToken.comptroller, 'setSeizeAllowed', [true]);
  await send(bToken.comptroller, 'setSeizeVerify', [true]);
  await send(bToken.comptroller, 'setFailCalculateSeizeTokens', [false]);
  await send(bToken.underlying, 'harnessSetFailTransferFromAddress', [liquidator, false]);
  await send(bToken.interestRateModel, 'setFailBorrowRate', [false]);
  await send(bTokenCollateral.interestRateModel, 'setFailBorrowRate', [false]);
  await send(bTokenCollateral.comptroller, 'setCalculatedSeizeTokens', [seizeTokens]);
  await setBalance(bTokenCollateral, liquidator, 0);
  await setBalance(bTokenCollateral, borrower, seizeTokens);
  await pretendBorrow(bTokenCollateral, borrower, 0, 1, 0);
  await pretendBorrow(bToken, borrower, 1, 1, repayAmount);
  await preApprove(bToken, liquidator, repayAmount);
}

async function liquidateFresh(bToken, liquidator, borrower, repayAmount, bTokenCollateral) {
  return send(bToken, 'harnessLiquidateBorrowFresh', [liquidator, borrower, repayAmount, bTokenCollateral._address]);
}

async function liquidate(bToken, liquidator, borrower, repayAmount, bTokenCollateral) {
  // make sure to have a block delta so we accrue interest
  await fastForward(bToken, 1);
  await fastForward(bTokenCollateral, 1);
  return send(bToken, 'liquidateBorrow', [borrower, repayAmount, bTokenCollateral._address], {from: liquidator});
}

async function seize(bToken, liquidator, borrower, seizeAmount) {
  return send(bToken, 'seize', [liquidator, borrower, seizeAmount]);
}

describe('BToken', function () {
  let root, liquidator, borrower, accounts;
  let bToken, bTokenCollateral;

  beforeEach(async () => {
    [root, liquidator, borrower, ...accounts] = saddle.accounts;
    bToken = await makeBToken({comptrollerOpts: {kind: 'bool'}});
    bTokenCollateral = await makeBToken({comptroller: bToken.comptroller});
  });

  beforeEach(async () => {
    await preLiquidate(bToken, liquidator, borrower, repayAmount, bTokenCollateral);
  });

  describe('liquidateBorrowFresh', () => {
    it("fails if comptroller tells it to", async () => {
      await send(bToken.comptroller, 'setLiquidateBorrowAllowed', [false]);
      expect(
        await liquidateFresh(bToken, liquidator, borrower, repayAmount, bTokenCollateral)
      ).toHaveTrollReject('LIQUIDATE_COMPTROLLER_REJECTION', 'MATH_ERROR');
    });

    it("proceeds if comptroller tells it to", async () => {
      expect(
        await liquidateFresh(bToken, liquidator, borrower, repayAmount, bTokenCollateral)
      ).toSucceed();
    });

    it("fails if market not fresh", async () => {
      await fastForward(bToken);
      expect(
        await liquidateFresh(bToken, liquidator, borrower, repayAmount, bTokenCollateral)
      ).toHaveTokenFailure('MARKET_NOT_FRESH', 'LIQUIDATE_FRESHNESS_CHECK');
    });

    it("fails if collateral market not fresh", async () => {
      await fastForward(bToken);
      await fastForward(bTokenCollateral);
      await send(bToken, 'accrueInterest');
      expect(
        await liquidateFresh(bToken, liquidator, borrower, repayAmount, bTokenCollateral)
      ).toHaveTokenFailure('MARKET_NOT_FRESH', 'LIQUIDATE_COLLATERAL_FRESHNESS_CHECK');
    });

    it("fails if borrower is equal to liquidator", async () => {
      expect(
        await liquidateFresh(bToken, borrower, borrower, repayAmount, bTokenCollateral)
      ).toHaveTokenFailure('INVALID_ACCOUNT_PAIR', 'LIQUIDATE_LIQUIDATOR_IS_BORROWER');
    });

    it("fails if repayAmount = 0", async () => {
      expect(await liquidateFresh(bToken, liquidator, borrower, 0, bTokenCollateral)).toHaveTokenFailure('INVALID_CLOSE_AMOUNT_REQUESTED', 'LIQUIDATE_CLOSE_AMOUNT_IS_ZERO');
    });

    it("fails if calculating seize tokens fails and does not adjust balances", async () => {
      const beforeBalances = await getBalances([bToken, bTokenCollateral], [liquidator, borrower]);
      await send(bToken.comptroller, 'setFailCalculateSeizeTokens', [true]);
      await expect(
        liquidateFresh(bToken, liquidator, borrower, repayAmount, bTokenCollateral)
      ).rejects.toRevert('revert LIQUIDATE_COMPTROLLER_CALCULATE_AMOUNT_SEIZE_FAILED');
      const afterBalances = await getBalances([bToken, bTokenCollateral], [liquidator, borrower]);
      expect(afterBalances).toEqual(beforeBalances);
    });

    it("fails if repay fails", async () => {
      await send(bToken.comptroller, 'setRepayBorrowAllowed', [false]);
      expect(
        await liquidateFresh(bToken, liquidator, borrower, repayAmount, bTokenCollateral)
      ).toHaveTrollReject('LIQUIDATE_REPAY_BORROW_FRESH_FAILED');
    });

    it("reverts if seize fails", async () => {
      await send(bToken.comptroller, 'setSeizeAllowed', [false]);
      await expect(
        liquidateFresh(bToken, liquidator, borrower, repayAmount, bTokenCollateral)
      ).rejects.toRevert("revert token seizure failed");
    });

    it("reverts if liquidateBorrowVerify fails", async() => {
      await send(bToken.comptroller, 'setLiquidateBorrowVerify', [false]);
      await expect(
        liquidateFresh(bToken, liquidator, borrower, repayAmount, bTokenCollateral)
      ).rejects.toRevert("revert liquidateBorrowVerify rejected liquidateBorrow");
    });

    it("transfers the cash, borrows, tokens, and emits Transfer, LiquidateBorrow events", async () => {
      const beforeBalances = await getBalances([bToken, bTokenCollateral], [liquidator, borrower]);
      const result = await liquidateFresh(bToken, liquidator, borrower, repayAmount, bTokenCollateral);
      const afterBalances = await getBalances([bToken, bTokenCollateral], [liquidator, borrower]);
      expect(result).toSucceed();
      expect(result).toHaveLog('LiquidateBorrow', {
        liquidator: liquidator,
        borrower: borrower,
        repayAmount: repayAmount.toString(),
        bTokenCollateral: bTokenCollateral._address,
        seizeTokens: seizeTokens.toString()
      });
      expect(result).toHaveLog(['Transfer', 0], {
        from: liquidator,
        to: bToken._address,
        amount: repayAmount.toString()
      });
      expect(result).toHaveLog(['Transfer', 1], {
        from: borrower,
        to: liquidator,
        amount: seizeTokens.toString()
      });
      expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
        [bToken, 'cash', repayAmount],
        [bToken, 'borrows', -repayAmount],
        [bToken, liquidator, 'cash', -repayAmount],
        [bTokenCollateral, liquidator, 'tokens', seizeTokens],
        [bToken, borrower, 'borrows', -repayAmount],
        [bTokenCollateral, borrower, 'tokens', -seizeTokens]
      ]));
    });
  });

  describe('liquidateBorrow', () => {
    it("emits a liquidation failure if borrowed asset interest accrual fails", async () => {
      await send(bToken.interestRateModel, 'setFailBorrowRate', [true]);
      await expect(liquidate(bToken, liquidator, borrower, repayAmount, bTokenCollateral)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("emits a liquidation failure if collateral asset interest accrual fails", async () => {
      await send(bTokenCollateral.interestRateModel, 'setFailBorrowRate', [true]);
      await expect(liquidate(bToken, liquidator, borrower, repayAmount, bTokenCollateral)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("returns error from liquidateBorrowFresh without emitting any extra logs", async () => {
      expect(await liquidate(bToken, liquidator, borrower, 0, bTokenCollateral)).toHaveTokenFailure('INVALID_CLOSE_AMOUNT_REQUESTED', 'LIQUIDATE_CLOSE_AMOUNT_IS_ZERO');
    });

    it("returns success from liquidateBorrowFresh and transfers the correct amounts", async () => {
      const beforeBalances = await getBalances([bToken, bTokenCollateral], [liquidator, borrower]);
      const result = await liquidate(bToken, liquidator, borrower, repayAmount, bTokenCollateral);
      const gasCost = await bnbGasCost(result);
      const afterBalances = await getBalances([bToken, bTokenCollateral], [liquidator, borrower]);
      expect(result).toSucceed();
      expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
        [bToken, 'cash', repayAmount],
        [bToken, 'borrows', -repayAmount],
        [bToken, liquidator, 'bnb', -gasCost],
        [bToken, liquidator, 'cash', -repayAmount],
        [bTokenCollateral, liquidator, 'bnb', -gasCost],
        [bTokenCollateral, liquidator, 'tokens', seizeTokens],
        [bToken, borrower, 'borrows', -repayAmount],
        [bTokenCollateral, borrower, 'tokens', -seizeTokens]
      ]));
    });
  });

  describe('seize', () => {
    // XXX verify callers are properly checked

    it("fails if seize is not allowed", async () => {
      await send(bToken.comptroller, 'setSeizeAllowed', [false]);
      expect(await seize(bTokenCollateral, liquidator, borrower, seizeTokens)).toHaveTrollReject('LIQUIDATE_SEIZE_COMPTROLLER_REJECTION', 'MATH_ERROR');
    });

    it("fails if bTokenBalances[borrower] < amount", async () => {
      await setBalance(bTokenCollateral, borrower, 1);
      expect(await seize(bTokenCollateral, liquidator, borrower, seizeTokens)).toHaveTokenMathFailure('LIQUIDATE_SEIZE_BALANCE_DECREMENT_FAILED', 'INTEGER_UNDERFLOW');
    });

    it("fails if bTokenBalances[liquidator] overflows", async () => {
      await setBalance(bTokenCollateral, liquidator, '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF');
      expect(await seize(bTokenCollateral, liquidator, borrower, seizeTokens)).toHaveTokenMathFailure('LIQUIDATE_SEIZE_BALANCE_INCREMENT_FAILED', 'INTEGER_OVERFLOW');
    });

    it("succeeds, updates balances, and emits Transfer event", async () => {
      const beforeBalances = await getBalances([bTokenCollateral], [liquidator, borrower]);
      const result = await seize(bTokenCollateral, liquidator, borrower, seizeTokens);
      const afterBalances = await getBalances([bTokenCollateral], [liquidator, borrower]);
      expect(result).toSucceed();
      expect(result).toHaveLog('Transfer', {
        from: borrower,
        to: liquidator,
        amount: seizeTokens.toString()
      });
      expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
        [bTokenCollateral, liquidator, 'tokens', seizeTokens],
        [bTokenCollateral, borrower, 'tokens', -seizeTokens]
      ]));
    });
  });
});
