const {makeBToken} = require('../Utils/Bai');

describe('BToken', function () {
  let root, accounts;
  beforeEach(async () => {
    [root, ...accounts] = saddle.accounts;
  });

  describe('transfer', () => {
    it("cannot transfer from a zero balance", async () => {
      const bToken = await makeBToken({supportMarket: true});
      expect(await call(bToken, 'balanceOf', [root])).toEqualNumber(0);
      expect(await send(bToken, 'transfer', [accounts[0], 100])).toHaveTokenFailure('MATH_ERROR', 'TRANSFER_NOT_ENOUGH');
    });

    it("transfers 50 tokens", async () => {
      const bToken = await makeBToken({supportMarket: true});
      await send(bToken, 'harnessSetBalance', [root, 100]);
      expect(await call(bToken, 'balanceOf', [root])).toEqualNumber(100);
      await send(bToken, 'transfer', [accounts[0], 50]);
      expect(await call(bToken, 'balanceOf', [root])).toEqualNumber(50);
      expect(await call(bToken, 'balanceOf', [accounts[0]])).toEqualNumber(50);
    });

    it("doesn't transfer when src == dst", async () => {
      const bToken = await makeBToken({supportMarket: true});
      await send(bToken, 'harnessSetBalance', [root, 100]);
      expect(await call(bToken, 'balanceOf', [root])).toEqualNumber(100);
      expect(await send(bToken, 'transfer', [root, 50])).toHaveTokenFailure('BAD_INPUT', 'TRANSFER_NOT_ALLOWED');
    });

    it("rejects transfer when not allowed and reverts if not verified", async () => {
      const bToken = await makeBToken({comptrollerOpts: {kind: 'bool'}});
      await send(bToken, 'harnessSetBalance', [root, 100]);
      expect(await call(bToken, 'balanceOf', [root])).toEqualNumber(100);

      await send(bToken.comptroller, 'setTransferAllowed', [false])
      expect(await send(bToken, 'transfer', [root, 50])).toHaveTrollReject('TRANSFER_COMPTROLLER_REJECTION');

      await send(bToken.comptroller, 'setTransferAllowed', [true])
      await send(bToken.comptroller, 'setTransferVerify', [false])
      await expect(send(bToken, 'transfer', [accounts[0], 50])).rejects.toRevert("revert transferVerify rejected transfer");
    });
  });
});