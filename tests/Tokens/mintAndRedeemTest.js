const {
  bnbUnsigned,
  bnbMantissa
} = require('../Utils/BSC');

const {
  makeBToken,
  balanceOf,
  fastForward,
  setBalance,
  getBalances,
  adjustBalances,
  preApprove,
  quickMint,
  preSupply,
  quickRedeem,
  quickRedeemUnderlying
} = require('../Utils/Bai');

const exchangeRate = 50e3;
const mintAmount = bnbUnsigned(10e4);
const mintTokens = mintAmount.div(exchangeRate);
const redeemTokens = bnbUnsigned(10e3);
const redeemAmount = redeemTokens.mul(exchangeRate);

async function preMint(bToken, minter, mintAmount, mintTokens, exchangeRate) {
  await preApprove(bToken, minter, mintAmount);
  await send(bToken.comptroller, 'setMintAllowed', [true]);
  await send(bToken.comptroller, 'setMintVerify', [true]);
  await send(bToken.interestRateModel, 'setFailBorrowRate', [false]);
  await send(bToken.underlying, 'harnessSetFailTransferFromAddress', [minter, false]);
  await send(bToken, 'harnessSetBalance', [minter, 0]);
  await send(bToken, 'harnessSetExchangeRate', [bnbMantissa(exchangeRate)]);
}

async function mintFresh(bToken, minter, mintAmount) {
  return send(bToken, 'harnessMintFresh', [minter, mintAmount]);
}

async function preRedeem(bToken, redeemer, redeemTokens, redeemAmount, exchangeRate) {
  await preSupply(bToken, redeemer, redeemTokens);
  await send(bToken.comptroller, 'setRedeemAllowed', [true]);
  await send(bToken.comptroller, 'setRedeemVerify', [true]);
  await send(bToken.interestRateModel, 'setFailBorrowRate', [false]);
  await send(bToken.underlying, 'harnessSetBalance', [bToken._address, redeemAmount]);
  await send(bToken.underlying, 'harnessSetBalance', [redeemer, 0]);
  await send(bToken.underlying, 'harnessSetFailTransferToAddress', [redeemer, false]);
  await send(bToken, 'harnessSetExchangeRate', [bnbMantissa(exchangeRate)]);
}

async function redeemFreshTokens(bToken, redeemer, redeemTokens, redeemAmount) {
  return send(bToken, 'harnessRedeemFresh', [redeemer, redeemTokens, 0]);
}

async function redeemFreshAmount(bToken, redeemer, redeemTokens, redeemAmount) {
  return send(bToken, 'harnessRedeemFresh', [redeemer, 0, redeemAmount]);
}

describe('BToken', function () {
  let root, minter, redeemer, accounts;
  let bToken;
  beforeEach(async () => {
    [root, minter, redeemer, ...accounts] = saddle.accounts;
    bToken = await makeBToken({comptrollerOpts: {kind: 'bool'}, exchangeRate});
  });

  describe('mintFresh', () => {
    beforeEach(async () => {
      await preMint(bToken, minter, mintAmount, mintTokens, exchangeRate);
    });

    it("fails if comptroller tells it to", async () => {
      await send(bToken.comptroller, 'setMintAllowed', [false]);
      expect(await mintFresh(bToken, minter, mintAmount)).toHaveTrollReject('MINT_COMPTROLLER_REJECTION', 'MATH_ERROR');
    });

    it("proceeds if comptroller tells it to", async () => {
      await expect(await mintFresh(bToken, minter, mintAmount)).toSucceed();
    });

    it("fails if not fresh", async () => {
      await fastForward(bToken);
      expect(await mintFresh(bToken, minter, mintAmount)).toHaveTokenFailure('MARKET_NOT_FRESH', 'MINT_FRESHNESS_CHECK');
    });

    it("continues if fresh", async () => {
      await expect(await send(bToken, 'accrueInterest')).toSucceed();
      expect(await mintFresh(bToken, minter, mintAmount)).toSucceed();
    });

    it("fails if insufficient approval", async () => {
      expect(
        await send(bToken.underlying, 'approve', [bToken._address, 1], {from: minter})
      ).toSucceed();
      await expect(mintFresh(bToken, minter, mintAmount)).rejects.toRevert('revert Insufficient allowance');
    });

    it("fails if insufficient balance", async() => {
      await setBalance(bToken.underlying, minter, 1);
      await expect(mintFresh(bToken, minter, mintAmount)).rejects.toRevert('revert Insufficient balance');
    });

    it("proceeds if sufficient approval and balance", async () =>{
      expect(await mintFresh(bToken, minter, mintAmount)).toSucceed();
    });

    it("fails if exchange calculation fails", async () => {
      expect(await send(bToken, 'harnessSetExchangeRate', [0])).toSucceed();
      await expect(mintFresh(bToken, minter, mintAmount)).rejects.toRevert('revert MINT_EXCHANGE_CALCULATION_FAILED');
    });

    it("fails if transferring in fails", async () => {
      await send(bToken.underlying, 'harnessSetFailTransferFromAddress', [minter, true]);
      await expect(mintFresh(bToken, minter, mintAmount)).rejects.toRevert('revert TOKEN_TRANSFER_IN_FAILED');
    });

    it("transfers the underlying cash, tokens, and emits Mint, Transfer events", async () => {
      const beforeBalances = await getBalances([bToken], [minter]);
      const result = await mintFresh(bToken, minter, mintAmount);
      const afterBalances = await getBalances([bToken], [minter]);
      expect(result).toSucceed();
      expect(result).toHaveLog('Mint', {
        minter,
        mintAmount: mintAmount.toString(),
        mintTokens: mintTokens.toString()
      });
      expect(result).toHaveLog(['Transfer', 1], {
        from: bToken._address,
        to: minter,
        amount: mintTokens.toString()
      });
      expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
        [bToken, minter, 'cash', -mintAmount],
        [bToken, minter, 'tokens', mintTokens],
        [bToken, 'cash', mintAmount],
        [bToken, 'tokens', mintTokens]
      ]));
    });
  });

  describe('mint', () => {
    beforeEach(async () => {
      await preMint(bToken, minter, mintAmount, mintTokens, exchangeRate);
    });

    it("emits a mint failure if interest accrual fails", async () => {
      await send(bToken.interestRateModel, 'setFailBorrowRate', [true]);
      await expect(quickMint(bToken, minter, mintAmount)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("returns error from mintFresh without emitting any extra logs", async () => {
      await send(bToken.underlying, 'harnessSetBalance', [minter, 1]);
      await expect(mintFresh(bToken, minter, mintAmount)).rejects.toRevert('revert Insufficient balance');
    });

    it("returns success from mintFresh and mints the correct number of tokens", async () => {
      expect(await quickMint(bToken, minter, mintAmount)).toSucceed();
      expect(mintTokens).not.toEqualNumber(0);
      expect(await balanceOf(bToken, minter)).toEqualNumber(mintTokens);
    });

    it("emits an AccrueInterest event", async () => {
      expect(await quickMint(bToken, minter, mintAmount)).toHaveLog('AccrueInterest', {
        borrowIndex: "1000000000000000000",
        cashPrior: "0",
        interestAccumulated: "0",
        totalBorrows: "0",
      });
    });
  });

  [redeemFreshTokens, redeemFreshAmount].forEach((redeemFresh) => {
    describe(redeemFresh.name, () => {
      beforeEach(async () => {
        await preRedeem(bToken, redeemer, redeemTokens, redeemAmount, exchangeRate);
      });

      it("fails if comptroller tells it to", async () =>{
        await send(bToken.comptroller, 'setRedeemAllowed', [false]);
        expect(await redeemFresh(bToken, redeemer, redeemTokens, redeemAmount)).toHaveTrollReject('REDEEM_COMPTROLLER_REJECTION');
      });

      it("fails if not fresh", async () => {
        await fastForward(bToken);
        expect(await redeemFresh(bToken, redeemer, redeemTokens, redeemAmount)).toHaveTokenFailure('MARKET_NOT_FRESH', 'REDEEM_FRESHNESS_CHECK');
      });

      it("continues if fresh", async () => {
        await expect(await send(bToken, 'accrueInterest')).toSucceed();
        expect(await redeemFresh(bToken, redeemer, redeemTokens, redeemAmount)).toSucceed();
      });

      it("fails if insufficient protocol cash to transfer out", async() => {
        await send(bToken.underlying, 'harnessSetBalance', [bToken._address, 1]);
        expect(await redeemFresh(bToken, redeemer, redeemTokens, redeemAmount)).toHaveTokenFailure('TOKEN_INSUFFICIENT_CASH', 'REDEEM_TRANSFER_OUT_NOT_POSSIBLE');
      });

      it("fails if exchange calculation fails", async () => {
        if (redeemFresh == redeemFreshTokens) {
          expect(await send(bToken, 'harnessSetExchangeRate', ['0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'])).toSucceed();
          expect(await redeemFresh(bToken, redeemer, redeemTokens, redeemAmount)).toHaveTokenFailure('MATH_ERROR', 'REDEEM_EXCHANGE_TOKENS_CALCULATION_FAILED');
        } else {
          expect(await send(bToken, 'harnessSetExchangeRate', [0])).toSucceed();
          expect(await redeemFresh(bToken, redeemer, redeemTokens, redeemAmount)).toHaveTokenFailure('MATH_ERROR', 'REDEEM_EXCHANGE_AMOUNT_CALCULATION_FAILED');
        }
      });

      it("fails if transferring out fails", async () => {
        await send(bToken.underlying, 'harnessSetFailTransferToAddress', [redeemer, true]);
        await expect(redeemFresh(bToken, redeemer, redeemTokens, redeemAmount)).rejects.toRevert("revert TOKEN_TRANSFER_OUT_FAILED");
      });

      it("fails if total supply < redemption amount", async () => {
        await send(bToken, 'harnessExchangeRateDetails', [0, 0, 0]);
        expect(await redeemFresh(bToken, redeemer, redeemTokens, redeemAmount)).toHaveTokenFailure('MATH_ERROR', 'REDEEM_NEW_TOTAL_SUPPLY_CALCULATION_FAILED');
      });

      it("reverts if new account balance underflows", async () => {
        await send(bToken, 'harnessSetBalance', [redeemer, 0]);
        expect(await redeemFresh(bToken, redeemer, redeemTokens, redeemAmount)).toHaveTokenFailure('MATH_ERROR', 'REDEEM_NEW_ACCOUNT_BALANCE_CALCULATION_FAILED');
      });

      it("transfers the underlying cash, tokens, and emits Redeem, Transfer events", async () => {
        const beforeBalances = await getBalances([bToken], [redeemer]);
        const result = await redeemFresh(bToken, redeemer, redeemTokens, redeemAmount);
        const afterBalances = await getBalances([bToken], [redeemer]);
        expect(result).toSucceed();
        expect(result).toHaveLog('Redeem', {
          redeemer,
          redeemAmount: redeemAmount.toString(),
          redeemTokens: redeemTokens.toString()
        });
        expect(result).toHaveLog(['Transfer', 1], {
          from: redeemer,
          to: bToken._address,
          amount: redeemTokens.toString()
        });
        expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
          [bToken, redeemer, 'cash', redeemAmount],
          [bToken, redeemer, 'tokens', -redeemTokens],
          [bToken, 'cash', -redeemAmount],
          [bToken, 'tokens', -redeemTokens]
        ]));
      });
    });
  });

  describe('redeem', () => {
    beforeEach(async () => {
      await preRedeem(bToken, redeemer, redeemTokens, redeemAmount, exchangeRate);
    });

    it("emits a redeem failure if interest accrual fails", async () => {
      await send(bToken.interestRateModel, 'setFailBorrowRate', [true]);
      await expect(quickRedeem(bToken, redeemer, redeemTokens)).rejects.toRevert("revert INTEREST_RATE_MODEL_ERROR");
    });

    it("returns error from redeemFresh without emitting any extra logs", async () => {
      await setBalance(bToken.underlying, bToken._address, 0);
      expect(await quickRedeem(bToken, redeemer, redeemTokens, {exchangeRate})).toHaveTokenFailure('TOKEN_INSUFFICIENT_CASH', 'REDEEM_TRANSFER_OUT_NOT_POSSIBLE');
    });

    it("returns success from redeemFresh and redeems the right amount", async () => {
      expect(
        await send(bToken.underlying, 'harnessSetBalance', [bToken._address, redeemAmount])
      ).toSucceed();
      expect(await quickRedeem(bToken, redeemer, redeemTokens, {exchangeRate})).toSucceed();
      expect(redeemAmount).not.toEqualNumber(0);
      expect(await balanceOf(bToken.underlying, redeemer)).toEqualNumber(redeemAmount);
    });

    it("returns success from redeemFresh and redeems the right amount of underlying", async () => {
      expect(
        await send(bToken.underlying, 'harnessSetBalance', [bToken._address, redeemAmount])
      ).toSucceed();
      expect(
        await quickRedeemUnderlying(bToken, redeemer, redeemAmount, {exchangeRate})
      ).toSucceed();
      expect(redeemAmount).not.toEqualNumber(0);
      expect(await balanceOf(bToken.underlying, redeemer)).toEqualNumber(redeemAmount);
    });

    it("emits an AccrueInterest event", async () => {
      expect(await quickMint(bToken, minter, mintAmount)).toHaveLog('AccrueInterest', {
        borrowIndex: "1000000000000000000",
        cashPrior: "500000000",
        interestAccumulated: "0",
        totalBorrows: "0",
      });
    });
  });
});
