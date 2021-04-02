const {
  bnbUnsigned,
  bnbMantissa,
  both
} = require('../Utils/BSC');

const {fastForward, makeBToken} = require('../Utils/Bai');

const factor = bnbMantissa(.02);

const reserves = bnbUnsigned(3e12);
const cash = bnbUnsigned(reserves.mul(2));
const reduction = bnbUnsigned(2e12);

describe('BToken', function () {
  let root, accounts;
  beforeEach(async () => {
    [root, ...accounts] = saddle.accounts;
  });

  describe('_setReserveFactorFresh', () => {
    let bToken;
    beforeEach(async () => {
      bToken = await makeBToken();
    });

    it("rejects change by non-admin", async () => {
      expect(
        await send(bToken, 'harnessSetReserveFactorFresh', [factor], {from: accounts[0]})
      ).toHaveTokenFailure('UNAUTHORIZED', 'SET_RESERVE_FACTOR_ADMIN_CHECK');
      expect(await call(bToken, 'reserveFactorMantissa')).toEqualNumber(0);
    });

    it("rejects change if market not fresh", async () => {
      expect(await send(bToken, 'harnessFastForward', [5])).toSucceed();
      expect(await send(bToken, 'harnessSetReserveFactorFresh', [factor])).toHaveTokenFailure('MARKET_NOT_FRESH', 'SET_RESERVE_FACTOR_FRESH_CHECK');
      expect(await call(bToken, 'reserveFactorMantissa')).toEqualNumber(0);
    });

    it("rejects newReserveFactor that descales to 1", async () => {
      expect(await send(bToken, 'harnessSetReserveFactorFresh', [bnbMantissa(1.01)])).toHaveTokenFailure('BAD_INPUT', 'SET_RESERVE_FACTOR_BOUNDS_CHECK');
      expect(await call(bToken, 'reserveFactorMantissa')).toEqualNumber(0);
    });

    it("accepts newReserveFactor in valid range and emits log", async () => {
      const result = await send(bToken, 'harnessSetReserveFactorFresh', [factor])
      expect(result).toSucceed();
      expect(await call(bToken, 'reserveFactorMantissa')).toEqualNumber(factor);
      expect(result).toHaveLog("NewReserveFactor", {
        oldReserveFactorMantissa: '0',
        newReserveFactorMantissa: factor.toString(),
      });
    });

    it("accepts a change back to zero", async () => {
      const result1 = await send(bToken, 'harnessSetReserveFactorFresh', [factor]);
      const result2 = await send(bToken, 'harnessSetReserveFactorFresh', [0]);
      expect(result1).toSucceed();
      expect(result2).toSucceed();
      expect(result2).toHaveLog("NewReserveFactor", {
        oldReserveFactorMantissa: factor.toString(),
        newReserveFactorMantissa: '0',
      });
      expect(await call(bToken, 'reserveFactorMantissa')).toEqualNumber(0);
    });
  });

  describe('_setReserveFactor', () => {
    let bToken;
    beforeEach(async () => {
      bToken = await makeBToken();
    });

    beforeEach(async () => {
      await send(bToken.interestRateModel, 'setFailBorrowRate', [false]);
      await send(bToken, '_setReserveFactor', [0]);
    });

    it("emits a reserve factor failure if interest accrual fails", async () => {
      await send(bToken.interestRateModel, 'setFailBorrowRate', [true]);
      await fastForward(bToken, 1);
      await expect(send(bToken, '_setReserveFactor', [factor])).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
      expect(await call(bToken, 'reserveFactorMantissa')).toEqualNumber(0);
    });

    it("returns error from setReserveFactorFresh without emitting any extra logs", async () => {
      const {reply, receipt} = await both(bToken, '_setReserveFactor', [bnbMantissa(2)]);
      expect(reply).toHaveTokenError('BAD_INPUT');
      expect(receipt).toHaveTokenFailure('BAD_INPUT', 'SET_RESERVE_FACTOR_BOUNDS_CHECK');
      expect(await call(bToken, 'reserveFactorMantissa')).toEqualNumber(0);
    });

    it("returns success from setReserveFactorFresh", async () => {
      expect(await call(bToken, 'reserveFactorMantissa')).toEqualNumber(0);
      expect(await send(bToken, 'harnessFastForward', [5])).toSucceed();
      expect(await send(bToken, '_setReserveFactor', [factor])).toSucceed();
      expect(await call(bToken, 'reserveFactorMantissa')).toEqualNumber(factor);
    });
  });

  describe("_reduceReservesFresh", () => {
    let bToken;
    beforeEach(async () => {
      bToken = await makeBToken();
      expect(await send(bToken, 'harnessSetTotalReserves', [reserves])).toSucceed();
      expect(
        await send(bToken.underlying, 'harnessSetBalance', [bToken._address, cash])
      ).toSucceed();
    });

    it("fails if called by non-admin", async () => {
      expect(
        await send(bToken, 'harnessReduceReservesFresh', [reduction], {from: accounts[0]})
      ).toHaveTokenFailure('UNAUTHORIZED', 'REDUCE_RESERVES_ADMIN_CHECK');
      expect(await call(bToken, 'totalReserves')).toEqualNumber(reserves);
    });

    it("fails if market not fresh", async () => {
      expect(await send(bToken, 'harnessFastForward', [5])).toSucceed();
      expect(await send(bToken, 'harnessReduceReservesFresh', [reduction])).toHaveTokenFailure('MARKET_NOT_FRESH', 'REDUCE_RESERVES_FRESH_CHECK');
      expect(await call(bToken, 'totalReserves')).toEqualNumber(reserves);
    });

    it("fails if amount exceeds reserves", async () => {
      expect(await send(bToken, 'harnessReduceReservesFresh', [reserves.add(1)])).toHaveTokenFailure('BAD_INPUT', 'REDUCE_RESERVES_VALIDATION');
      expect(await call(bToken, 'totalReserves')).toEqualNumber(reserves);
    });

    it("fails if amount exceeds available cash", async () => {
      const cashLessThanReserves = reserves.sub(2);
      await send(bToken.underlying, 'harnessSetBalance', [bToken._address, cashLessThanReserves]);
      expect(await send(bToken, 'harnessReduceReservesFresh', [reserves])).toHaveTokenFailure('TOKEN_INSUFFICIENT_CASH', 'REDUCE_RESERVES_CASH_NOT_ABAILABLE');
      expect(await call(bToken, 'totalReserves')).toEqualNumber(reserves);
    });

    it("increases admin balance and reduces reserves on success", async () => {
      const balance = bnbUnsigned(await call(bToken.underlying, 'balanceOf', [root]));
      expect(await send(bToken, 'harnessReduceReservesFresh', [reserves])).toSucceed();
      expect(await call(bToken.underlying, 'balanceOf', [root])).toEqualNumber(balance.add(reserves));
      expect(await call(bToken, 'totalReserves')).toEqualNumber(0);
    });

    it("emits an event on success", async () => {
      const result = await send(bToken, 'harnessReduceReservesFresh', [reserves]);
      expect(result).toHaveLog('ReservesReduced', {
        admin: root,
        reduceAmount: reserves.toString(),
        newTotalReserves: '0'
      });
    });
  });

  describe("_reduceReserves", () => {
    let bToken;
    beforeEach(async () => {
      bToken = await makeBToken();
      await send(bToken.interestRateModel, 'setFailBorrowRate', [false]);
      expect(await send(bToken, 'harnessSetTotalReserves', [reserves])).toSucceed();
      expect(
        await send(bToken.underlying, 'harnessSetBalance', [bToken._address, cash])
      ).toSucceed();
    });

    it("emits a reserve-reduction failure if interest accrual fails", async () => {
      await send(bToken.interestRateModel, 'setFailBorrowRate', [true]);
      await fastForward(bToken, 1);
      await expect(send(bToken, '_reduceReserves', [reduction])).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("returns error from _reduceReservesFresh without emitting any extra logs", async () => {
      const {reply, receipt} = await both(bToken, 'harnessReduceReservesFresh', [reserves.add(1)]);
      expect(reply).toHaveTokenError('BAD_INPUT');
      expect(receipt).toHaveTokenFailure('BAD_INPUT', 'REDUCE_RESERVES_VALIDATION');
    });

    it("returns success code from _reduceReservesFresh and reduces the correct amount", async () => {
      expect(await call(bToken, 'totalReserves')).toEqualNumber(reserves);
      expect(await send(bToken, 'harnessFastForward', [5])).toSucceed();
      expect(await send(bToken, '_reduceReserves', [reduction])).toSucceed();
    });
  });
});
