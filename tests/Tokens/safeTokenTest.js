const {
  makeBToken,
  getBalances,
  adjustBalances
} = require('../Utils/Bai');

const exchangeRate = 5;

describe('BBNB', function () {
  let root, nonRoot, accounts;
  let bToken;
  beforeEach(async () => {
    [root, nonRoot, ...accounts] = saddle.accounts;
    bToken = await makeBToken({kind: 'vbnb', comptrollerOpts: {kind: 'bool'}});
  });

  describe("getCashPrior", () => {
    it("returns the amount of bnb held by the vBnb contract before the current message", async () => {
      expect(await call(bToken, 'harnessGetCashPrior', [], {value: 100})).toEqualNumber(0);
    });
  });

  describe("doTransferIn", () => {
    it("succeeds if from is msg.nonRoot and amount is msg.value", async () => {
      expect(await call(bToken, 'harnessDoTransferIn', [root, 100], {value: 100})).toEqualNumber(100);
    });

    it("reverts if from != msg.sender", async () => {
      await expect(call(bToken, 'harnessDoTransferIn', [nonRoot, 100], {value: 100})).rejects.toRevert("revert sender mismatch");
    });

    it("reverts if amount != msg.value", async () => {
      await expect(call(bToken, 'harnessDoTransferIn', [root, 77], {value: 100})).rejects.toRevert("revert value mismatch");
    });

    describe("doTransferOut", () => {
      it("transfers bnb out", async () => {
        const beforeBalances = await getBalances([bToken], [nonRoot]);
        const receipt = await send(bToken, 'harnessDoTransferOut', [nonRoot, 77], {value: 77});
        const afterBalances = await getBalances([bToken], [nonRoot]);
        expect(receipt).toSucceed();
        expect(afterBalances).toEqual(await adjustBalances(beforeBalances, [
          [bToken, nonRoot, 'bnb', 77]
        ]));
      });

      it("reverts if it fails", async () => {
        await expect(call(bToken, 'harnessDoTransferOut', [root, 77], {value: 0})).rejects.toRevert();
      });
    });
  });
});
