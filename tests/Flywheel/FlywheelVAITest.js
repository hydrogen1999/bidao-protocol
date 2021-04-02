const {
  makeComptroller,
  makeBAI,
  balanceOf,
  fastForward,
  pretendBAIMint,
  quickMint,
  quickMintBAI
} = require('../Utils/Bai');
const {
  bnbExp,
  bnbDouble,
  bnbUnsigned
} = require('../Utils/BSC');

const venusBAIRate = bnbUnsigned(5e17);

async function venusAccrued(comptroller, user) {
  return bnbUnsigned(await call(comptroller, 'venusAccrued', [user]));
}

async function xvsBalance(comptroller, user) {
  return bnbUnsigned(await call(comptroller.xvs, 'balanceOf', [user]))
}

async function totalBaiAccrued(comptroller, user) {
  return (await venusAccrued(comptroller, user)).add(await xvsBalance(comptroller, user));
}

describe('Flywheel', () => {
  let root, a1, a2, a3, accounts;
  let comptroller, vaicontroller, vai;
  beforeEach(async () => {
    [root, a1, a2, a3, ...accounts] = saddle.accounts;
    comptroller = await makeComptroller();
    vai = comptroller.vai;
    vaicontroller = comptroller.vaiunitroller;
  });

  describe('updateBaiBAIMintIndex()', () => {
    it('should calculate xvs vai minter index correctly', async () => {
      await send(vaicontroller, 'setBlockNumber', [100]);
      await send(vai, 'harnessSetTotalSupply', [bnbUnsigned(10e18)]);
      await send(comptroller, '_setBaiBAIRate', [bnbExp(0.5)]);
      await send(vaicontroller, 'harnessUpdateBaiBAIMintIndex');
      /*
        vaiTokens = 10e18
        venusAccrued = deltaBlocks * setBaiBAIRate
                    = 100 * 0.5e18 = 50e18
        newIndex   += venusAccrued * 1e36 / vaiTokens
                    = 1e36 + 50e18 * 1e36 / 10e18 = 6e36
      */

      const {index, block} = await call(vaicontroller, 'venusBAIState');
      expect(index).toEqualNumber(6e36);
      expect(block).toEqualNumber(100);
    });

    it('should not update index if no blocks passed since last accrual', async () => {
      await send(vaicontroller, 'harnessUpdateBaiBAIMintIndex');

      const {index, block} = await call(vaicontroller, 'venusBAIState');
      expect(index).toEqualNumber(1e36);
      expect(block).toEqualNumber(0);
    });
  });

  describe('distributeBAIMinterBai()', () => {
    it('should update vai minter index checkpoint but not venusAccrued for first time user', async () => {
      await send(vaicontroller, "setBaiBAIState", [bnbDouble(6), 10]);
      await send(vaicontroller, "setBaiBAIMinterIndex", [root, bnbUnsigned(0)]);

      await send(comptroller, "harnessDistributeBAIMinterBai", [root]);
      expect(await call(comptroller, "venusAccrued", [root])).toEqualNumber(0);
      expect(await call(vaicontroller, "venusBAIMinterIndex", [root])).toEqualNumber(6e36);
    });

    it('should transfer xvs and update vai minter index checkpoint correctly for repeat time user', async () => {
      await send(comptroller.xvs, 'transfer', [comptroller._address, bnbUnsigned(50e18)], {from: root});
      await send(vai, "harnessSetBalanceOf", [a1, bnbUnsigned(5e18)]);
      await send(comptroller, "harnessSetMintedBAIs", [a1, bnbUnsigned(5e18)]);
      await send(vaicontroller, "setBaiBAIState", [bnbDouble(6), 10]);
      await send(vaicontroller, "setBaiBAIMinterIndex", [a1, bnbDouble(1)]);

      /*
      * 100 delta blocks, 10e18 origin total vai mint, 0.5e18 vaiMinterSpeed => 6e18 venusBAIMintIndex
      * this tests that an acct with half the total vai mint over that time gets 25e18 XBID
        vaiMinterAmount = vaiBalance * 1e18
                       = 5e18 * 1e18 = 5e18
        deltaIndex     = marketStoredIndex - userStoredIndex
                       = 6e36 - 1e36 = 5e36
        vaiMinterAccrued= vaiMinterAmount * deltaIndex / 1e36
                       = 5e18 * 5e36 / 1e36 = 25e18
      */
      const tx = await send(comptroller, "harnessDistributeBAIMinterBai", [a1]);
      expect(await venusAccrued(comptroller, a1)).toEqualNumber(25e18);
      expect(await xvsBalance(comptroller, a1)).toEqualNumber(0);
      expect(tx).toHaveLog('DistributedBAIMinterBai', {
        vaiMinter: a1,
        venusDelta: bnbUnsigned(25e18).toString(),
        venusBAIMintIndex: bnbDouble(6).toString()
      });
    });

    it('should not transfer if below xvs claim threshold', async () => {
      await send(comptroller.xvs, 'transfer', [comptroller._address, bnbUnsigned(50e18)], {from: root});

      await send(vai, "harnessSetBalanceOf", [a1, bnbUnsigned(5e17)]);
      await send(comptroller, "harnessSetMintedBAIs", [a1, bnbUnsigned(5e17)]);
      await send(vaicontroller, "setBaiBAIState", [bnbDouble(1.0019), 10]);
      /*
        vaiMinterAmount  = 5e17
        deltaIndex      = marketStoredIndex - userStoredIndex
                        = 1.0019e36 - 1e36 = 0.0019e36
        vaiMintedAccrued+= vaiMinterTokens * deltaIndex / 1e36
                        = 5e17 * 0.0019e36 / 1e36 = 0.00095e18
      */

      await send(comptroller, "harnessDistributeBAIMinterBai", [a1]);
      expect(await venusAccrued(comptroller, a1)).toEqualNumber(0.00095e18);
      expect(await xvsBalance(comptroller, a1)).toEqualNumber(0);
    });
  });

  describe('claimBai', () => {
    it('should accrue xvs and then transfer xvs accrued', async () => {
      const xvsRemaining = venusBAIRate.mul(100), mintAmount = bnbUnsigned(12e18), deltaBlocks = 10;
      await send(comptroller.xvs, 'transfer', [comptroller._address, xvsRemaining], {from: root});
      //await pretendBAIMint(vai, a1, 1, 1, 100);
      const speed = await call(comptroller, 'venusBAIRate');
      const a2AccruedPre = await venusAccrued(comptroller, a2);
      const xvsBalancePre = await xvsBalance(comptroller, a2);
      await quickMintBAI(comptroller, vai, a2, mintAmount);
      await fastForward(vaicontroller, deltaBlocks);
      const tx = await send(comptroller, 'claimBai', [a2]);
      const a2AccruedPost = await venusAccrued(comptroller, a2);
      const xvsBalancePost = await xvsBalance(comptroller, a2);
      expect(tx.gasUsed).toBeLessThan(400000);
      expect(speed).toEqualNumber(venusBAIRate);
      expect(a2AccruedPre).toEqualNumber(0);
      expect(a2AccruedPost).toEqualNumber(0);
      expect(xvsBalancePre).toEqualNumber(0);
      expect(xvsBalancePost).toEqualNumber(venusBAIRate.mul(deltaBlocks).sub(1)); // index is 8333...
    });

    it('should claim when xvs accrued is below threshold', async () => {
      const xvsRemaining = bnbExp(1), accruedAmt = bnbUnsigned(0.0009e18)
      await send(comptroller.xvs, 'transfer', [comptroller._address, xvsRemaining], {from: root});
      await send(comptroller, 'setBaiAccrued', [a1, accruedAmt]);
      await send(comptroller, 'claimBai', [a1]);
      expect(await venusAccrued(comptroller, a1)).toEqualNumber(0);
      expect(await xvsBalance(comptroller, a1)).toEqualNumber(accruedAmt);
    });
  });

  describe('claimBai batch', () => {
    it('should claim the expected amount when holders and arg is duplicated', async () => {
      const xvsRemaining = venusBAIRate.mul(100), deltaBlocks = 10, mintAmount = bnbExp(10);
      await send(comptroller.xvs, 'transfer', [comptroller._address, xvsRemaining], {from: root});
      let [_, __, ...claimAccts] = saddle.accounts;
      for(let from of claimAccts) {
        await send(vai, 'harnessIncrementTotalSupply', [mintAmount]);
        expect(await send(vai, 'harnessSetBalanceOf', [from, mintAmount], { from })).toSucceed();
        expect(await await send(comptroller, 'harnessSetMintedBAIs', [from, mintAmount], { from })).toSucceed();
      }
      await fastForward(vaicontroller, deltaBlocks);

      const tx = await send(comptroller, 'claimBai', [[...claimAccts, ...claimAccts], [], false, false]);
      // xvs distributed => 10e18
      for(let acct of claimAccts) {
        expect(await call(vaicontroller, 'venusBAIMinterIndex', [acct])).toEqualNumber(bnbDouble(1.0625));
        expect(await xvsBalance(comptroller, acct)).toEqualNumber(bnbExp(0.625));
      }
    });

    it('claims xvs for multiple vai minters only, primes uninitiated', async () => {
      const xvsRemaining = venusBAIRate.mul(100), deltaBlocks = 10, mintAmount = bnbExp(10), vaiAmt = bnbExp(1), vaiMintIdx = bnbExp(1)
      await send(comptroller.xvs, 'transfer', [comptroller._address, xvsRemaining], {from: root});
      let [_,__, ...claimAccts] = saddle.accounts;

      for(let acct of claimAccts) {
        await send(vai, 'harnessIncrementTotalSupply', [vaiAmt]);
        await send(vai, 'harnessSetBalanceOf', [acct, vaiAmt]);
        await send(comptroller, 'harnessSetMintedBAIs', [acct, vaiAmt]);
      }

      await send(vaicontroller, 'harnessFastForward', [10]);

      const tx = await send(comptroller, 'claimBai', [claimAccts, [], false, false]);
      for(let acct of claimAccts) {
        expect(await call(vaicontroller, 'venusBAIMinterIndex', [acct])).toEqualNumber(bnbDouble(1.625));
      }
    });
  });

  describe('_setBaiBAIRate', () => {
    it('should correctly change venus vai rate if called by admin', async () => {
      expect(await call(comptroller, 'venusBAIRate')).toEqualNumber(venusBAIRate);
      const tx1 = await send(comptroller, '_setBaiBAIRate', [bnbUnsigned(3e18)]);
      expect(await call(comptroller, 'venusBAIRate')).toEqualNumber(bnbUnsigned(3e18));
      const tx2 = await send(comptroller, '_setBaiBAIRate', [bnbUnsigned(2e18)]);
      expect(await call(comptroller, 'venusBAIRate')).toEqualNumber(bnbUnsigned(2e18));
      expect(tx2).toHaveLog('NewBaiBAIRate', {
        oldBaiBAIRate: bnbUnsigned(3e18),
        newBaiBAIRate: bnbUnsigned(2e18)
      });
    });

    it('should not change venus vai rate unless called by admin', async () => {
      await expect(
        send(comptroller, '_setBaiBAIRate', [bnbUnsigned(1e18)], {from: a1})
      ).rejects.toRevert('revert only admin can');
    });
  });
});
