const {
  makeComptroller,
  makeBToken,
  balanceOf,
  fastForward,
  pretendBorrow,
  quickMint
} = require('../Utils/Bai');
const {
  bnbExp,
  bnbDouble,
  bnbUnsigned
} = require('../Utils/BSC');

const venusRate = bnbUnsigned(1e18);

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
  let comptroller, vLOW, vREP, vZRX, vEVIL;
  beforeEach(async () => {
    let interestRateModelOpts = {borrowRate: 0.000001};
    [root, a1, a2, a3, ...accounts] = saddle.accounts;
    comptroller = await makeComptroller();
    vLOW = await makeBToken({comptroller, supportMarket: true, underlyingPrice: 1, interestRateModelOpts});
    vREP = await makeBToken({comptroller, supportMarket: true, underlyingPrice: 2, interestRateModelOpts});
    vZRX = await makeBToken({comptroller, supportMarket: true, underlyingPrice: 3, interestRateModelOpts});
    vEVIL = await makeBToken({comptroller, supportMarket: false, underlyingPrice: 3, interestRateModelOpts});
  });

  describe('getBaiMarkets()', () => {
    it('should return the venus markets', async () => {
      for (let mkt of [vLOW, vREP, vZRX]) {
        await send(comptroller, '_setBaiSpeed', [mkt._address, bnbExp(0.5)]);
      }
      expect(await call(comptroller, 'getBaiMarkets')).toEqual(
        [vLOW, vREP, vZRX].map((c) => c._address)
      );
    });
  });

  describe('_setBaiSpeed()', () => {
    it('should update market index when calling setBaiSpeed', async () => {
      const mkt = vREP;
      await send(comptroller, 'setBlockNumber', [0]);
      await send(mkt, 'harnessSetTotalSupply', [bnbUnsigned(10e18)]);

      await send(comptroller, '_setBaiSpeed', [mkt._address, bnbExp(0.5)]);
      await fastForward(comptroller, 20);
      await send(comptroller, '_setBaiSpeed', [mkt._address, bnbExp(1)]);

      const {index, block} = await call(comptroller, 'venusSupplyState', [mkt._address]);
      expect(index).toEqualNumber(2e36);
      expect(block).toEqualNumber(20);
    });

    it('should correctly drop a xvs market if called by admin', async () => {
      for (let mkt of [vLOW, vREP, vZRX]) {
        await send(comptroller, '_setBaiSpeed', [mkt._address, bnbExp(0.5)]);
      }
      const tx = await send(comptroller, '_setBaiSpeed', [vLOW._address, 0]);
      expect(await call(comptroller, 'getBaiMarkets')).toEqual(
        [vREP, vZRX].map((c) => c._address)
      );
      expect(tx).toHaveLog('BaiSpeedUpdated', {
        bToken: vLOW._address,
        newSpeed: 0
      });
    });

    it('should correctly drop a xvs market from middle of array', async () => {
      for (let mkt of [vLOW, vREP, vZRX]) {
        await send(comptroller, '_setBaiSpeed', [mkt._address, bnbExp(0.5)]);
      }
      await send(comptroller, '_setBaiSpeed', [vREP._address, 0]);
      expect(await call(comptroller, 'getBaiMarkets')).toEqual(
        [vLOW, vZRX].map((c) => c._address)
      );
    });

    it('should not drop a xvs market unless called by admin', async () => {
      for (let mkt of [vLOW, vREP, vZRX]) {
        await send(comptroller, '_setBaiSpeed', [mkt._address, bnbExp(0.5)]);
      }
      await expect(
        send(comptroller, '_setBaiSpeed', [vLOW._address, 0], {from: a1})
      ).rejects.toRevert('revert only admin can set venus speed');
    });

    it('should not add non-listed markets', async () => {
      const vBAT = await makeBToken({ comptroller, supportMarket: false });
      await expect(
        send(comptroller, 'harnessAddBaiMarkets', [[vBAT._address]])
      ).rejects.toRevert('revert venus market is not listed');

      const markets = await call(comptroller, 'getBaiMarkets');
      expect(markets).toEqual([]);
    });
  });

  describe('updateBaiBorrowIndex()', () => {
    it('should calculate xvs borrower index correctly', async () => {
      const mkt = vREP;
      await send(comptroller, '_setBaiSpeed', [mkt._address, bnbExp(0.5)]);
      await send(comptroller, 'setBlockNumber', [100]);
      await send(mkt, 'harnessSetTotalBorrows', [bnbUnsigned(11e18)]);
      await send(comptroller, 'harnessUpdateBaiBorrowIndex', [
        mkt._address,
        bnbExp(1.1),
      ]);
      /*
        100 blocks, 10e18 origin total borrows, 0.5e18 borrowSpeed

        borrowAmt   = totalBorrows * 1e18 / borrowIdx
                    = 11e18 * 1e18 / 1.1e18 = 10e18
        venusAccrued = deltaBlocks * borrowSpeed
                    = 100 * 0.5e18 = 50e18
        newIndex   += 1e36 + venusAccrued * 1e36 / borrowAmt
                    = 1e36 + 50e18 * 1e36 / 10e18 = 6e36
      */

      const {index, block} = await call(comptroller, 'venusBorrowState', [mkt._address]);
      expect(index).toEqualNumber(6e36);
      expect(block).toEqualNumber(100);
    });

    it('should not revert or update venusBorrowState index if bToken not in Bai markets', async () => {
      const mkt = await makeBToken({
        comptroller: comptroller,
        supportMarket: true,
        addBaiMarket: false,
      });
      await send(comptroller, 'setBlockNumber', [100]);
      await send(comptroller, 'harnessUpdateBaiBorrowIndex', [
        mkt._address,
        bnbExp(1.1),
      ]);

      const {index, block} = await call(comptroller, 'venusBorrowState', [mkt._address]);
      expect(index).toEqualNumber(0);
      expect(block).toEqualNumber(100);
      const speed = await call(comptroller, 'venusSpeeds', [mkt._address]);
      expect(speed).toEqualNumber(0);
    });

    it('should not update index if no blocks passed since last accrual', async () => {
      const mkt = vREP;
      await send(comptroller, '_setBaiSpeed', [mkt._address, bnbExp(0.5)]);
      await send(comptroller, 'harnessUpdateBaiBorrowIndex', [
        mkt._address,
        bnbExp(1.1),
      ]);

      const {index, block} = await call(comptroller, 'venusBorrowState', [mkt._address]);
      expect(index).toEqualNumber(1e36);
      expect(block).toEqualNumber(0);
    });

    it('should not update index if venus speed is 0', async () => {
      const mkt = vREP;
      await send(comptroller, '_setBaiSpeed', [mkt._address, bnbExp(0.5)]);
      await send(comptroller, 'setBlockNumber', [100]);
      await send(comptroller, '_setBaiSpeed', [mkt._address, bnbExp(0)]);
      await send(comptroller, 'harnessUpdateBaiBorrowIndex', [
        mkt._address,
        bnbExp(1.1),
      ]);

      const {index, block} = await call(comptroller, 'venusBorrowState', [mkt._address]);
      expect(index).toEqualNumber(1e36);
      expect(block).toEqualNumber(100);
    });
  });

  describe('updateBaiSupplyIndex()', () => {
    it('should calculate xvs supplier index correctly', async () => {
      const mkt = vREP;
      await send(comptroller, '_setBaiSpeed', [mkt._address, bnbExp(0.5)]);
      await send(comptroller, 'setBlockNumber', [100]);
      await send(mkt, 'harnessSetTotalSupply', [bnbUnsigned(10e18)]);
      await send(comptroller, 'harnessUpdateBaiSupplyIndex', [mkt._address]);
      /*
        suppyTokens = 10e18
        venusAccrued = deltaBlocks * supplySpeed
                    = 100 * 0.5e18 = 50e18
        newIndex   += venusAccrued * 1e36 / supplyTokens
                    = 1e36 + 50e18 * 1e36 / 10e18 = 6e36
      */
      const {index, block} = await call(comptroller, 'venusSupplyState', [mkt._address]);
      expect(index).toEqualNumber(6e36);
      expect(block).toEqualNumber(100);
    });

    it('should not update index on non-Bai markets', async () => {
      const mkt = await makeBToken({
        comptroller: comptroller,
        supportMarket: true,
        addBaiMarket: false
      });
      await send(comptroller, 'setBlockNumber', [100]);
      await send(comptroller, 'harnessUpdateBaiSupplyIndex', [
        mkt._address
      ]);

      const {index, block} = await call(comptroller, 'venusSupplyState', [mkt._address]);
      expect(index).toEqualNumber(0);
      expect(block).toEqualNumber(100);
      const speed = await call(comptroller, 'venusSpeeds', [mkt._address]);
      expect(speed).toEqualNumber(0);
      // vtoken could have no venus speed or xvs supplier state if not in venus markets
      // this logic could also possibly be implemented in the allowed hook
    });

    it('should not update index if no blocks passed since last accrual', async () => {
      const mkt = vREP;
      await send(comptroller, 'setBlockNumber', [0]);
      await send(mkt, 'harnessSetTotalSupply', [bnbUnsigned(10e18)]);
      await send(comptroller, '_setBaiSpeed', [mkt._address, bnbExp(0.5)]);
      await send(comptroller, 'harnessUpdateBaiSupplyIndex', [mkt._address]);

      const {index, block} = await call(comptroller, 'venusSupplyState', [mkt._address]);
      expect(index).toEqualNumber(1e36);
      expect(block).toEqualNumber(0);
    });

    it('should not matter if the index is updated multiple times', async () => {
      const venusRemaining = venusRate.mul(100)
      await send(comptroller, 'harnessAddBaiMarkets', [[vLOW._address]]);
      await send(comptroller.xvs, 'transfer', [comptroller._address, venusRemaining], {from: root});
      await pretendBorrow(vLOW, a1, 1, 1, 100);
      await send(comptroller, 'harnessRefreshBaiSpeeds');

      await quickMint(vLOW, a2, bnbUnsigned(10e18));
      await quickMint(vLOW, a3, bnbUnsigned(15e18));

      const a2Accrued0 = await totalBaiAccrued(comptroller, a2);
      const a3Accrued0 = await totalBaiAccrued(comptroller, a3);
      const a2Balance0 = await balanceOf(vLOW, a2);
      const a3Balance0 = await balanceOf(vLOW, a3);

      await fastForward(comptroller, 20);

      const txT1 = await send(vLOW, 'transfer', [a2, a3Balance0.sub(a2Balance0)], {from: a3});

      const a2Accrued1 = await totalBaiAccrued(comptroller, a2);
      const a3Accrued1 = await totalBaiAccrued(comptroller, a3);
      const a2Balance1 = await balanceOf(vLOW, a2);
      const a3Balance1 = await balanceOf(vLOW, a3);

      await fastForward(comptroller, 10);
      await send(comptroller, 'harnessUpdateBaiSupplyIndex', [vLOW._address]);
      await fastForward(comptroller, 10);

      const txT2 = await send(vLOW, 'transfer', [a3, a2Balance1.sub(a3Balance1)], {from: a2});

      const a2Accrued2 = await totalBaiAccrued(comptroller, a2);
      const a3Accrued2 = await totalBaiAccrued(comptroller, a3);

      expect(a2Accrued0).toEqualNumber(0);
      expect(a3Accrued0).toEqualNumber(0);
      expect(a2Accrued1).not.toEqualNumber(0);
      expect(a3Accrued1).not.toEqualNumber(0);
      expect(a2Accrued1).toEqualNumber(a3Accrued2.sub(a3Accrued1));
      expect(a3Accrued1).toEqualNumber(a2Accrued2.sub(a2Accrued1));

      expect(txT1.gasUsed).toBeLessThan(220000);
      expect(txT1.gasUsed).toBeGreaterThan(150000);
      expect(txT2.gasUsed).toBeLessThan(150000);
      expect(txT2.gasUsed).toBeGreaterThan(100000);
    });
  });

  describe('distributeBorrowerBai()', () => {

    it('should update borrow index checkpoint but not venusAccrued for first time user', async () => {
      const mkt = vREP;
      await send(comptroller, "setBaiBorrowState", [mkt._address, bnbDouble(6), 10]);
      await send(comptroller, "setBaiBorrowerIndex", [mkt._address, root, bnbUnsigned(0)]);

      await send(comptroller, "harnessDistributeBorrowerBai", [mkt._address, root, bnbExp(1.1)]);
      expect(await call(comptroller, "venusAccrued", [root])).toEqualNumber(0);
      expect(await call(comptroller, "venusBorrowerIndex", [ mkt._address, root])).toEqualNumber(6e36);
    });

    it('should transfer xvs and update borrow index checkpoint correctly for repeat time user', async () => {
      const mkt = vREP;
      await send(comptroller.xvs, 'transfer', [comptroller._address, bnbUnsigned(50e18)], {from: root});
      await send(mkt, "harnessSetAccountBorrows", [a1, bnbUnsigned(5.5e18), bnbExp(1)]);
      await send(comptroller, "setBaiBorrowState", [mkt._address, bnbDouble(6), 10]);
      await send(comptroller, "setBaiBorrowerIndex", [mkt._address, a1, bnbDouble(1)]);

      /*
      * 100 delta blocks, 10e18 origin total borrows, 0.5e18 borrowSpeed => 6e18 venusBorrowIndex
      * this tests that an acct with half the total borrows over that time gets 25e18 XBID
        borrowerAmount = borrowBalance * 1e18 / borrow idx
                       = 5.5e18 * 1e18 / 1.1e18 = 5e18
        deltaIndex     = marketStoredIndex - userStoredIndex
                       = 6e36 - 1e36 = 5e36
        borrowerAccrued= borrowerAmount * deltaIndex / 1e36
                       = 5e18 * 5e36 / 1e36 = 25e18
      */
      const tx = await send(comptroller, "harnessDistributeBorrowerBai", [mkt._address, a1, bnbUnsigned(1.1e18)]);
      expect(await venusAccrued(comptroller, a1)).toEqualNumber(25e18);
      expect(await xvsBalance(comptroller, a1)).toEqualNumber(0);
      expect(tx).toHaveLog('DistributedBorrowerBai', {
        bToken: mkt._address,
        borrower: a1,
        venusDelta: bnbUnsigned(25e18).toString(),
        venusBorrowIndex: bnbDouble(6).toString()
      });
    });

    it('should not transfer xvs automatically', async () => {
      const mkt = vREP;
      await send(comptroller.xvs, 'transfer', [comptroller._address, bnbUnsigned(50e18)], {from: root});
      await send(mkt, "harnessSetAccountBorrows", [a1, bnbUnsigned(5.5e17), bnbExp(1)]);
      await send(comptroller, "setBaiBorrowState", [mkt._address, bnbDouble(1.0019), 10]);
      await send(comptroller, "setBaiBorrowerIndex", [mkt._address, a1, bnbDouble(1)]);
      /*
        borrowerAmount = borrowBalance * 1e18 / borrow idx
                       = 5.5e17 * 1e18 / 1.1e18 = 5e17
        deltaIndex     = marketStoredIndex - userStoredIndex
                       = 1.0019e36 - 1e36 = 0.0019e36
        borrowerAccrued= borrowerAmount * deltaIndex / 1e36
                       = 5e17 * 0.0019e36 / 1e36 = 0.00095e18
        0.00095e18 < venusClaimThreshold of 0.001e18
      */
      await send(comptroller, "harnessDistributeBorrowerBai", [mkt._address, a1, bnbExp(1.1)]);
      expect(await venusAccrued(comptroller, a1)).toEqualNumber(0.00095e18);
      expect(await xvsBalance(comptroller, a1)).toEqualNumber(0);
    });

    it('should not revert or distribute when called with non-Bai market', async () => {
      const mkt = await makeBToken({
        comptroller: comptroller,
        supportMarket: true,
        addBaiMarket: false,
      });

      await send(comptroller, "harnessDistributeBorrowerBai", [mkt._address, a1, bnbExp(1.1)]);
      expect(await venusAccrued(comptroller, a1)).toEqualNumber(0);
      expect(await xvsBalance(comptroller, a1)).toEqualNumber(0);
      expect(await call(comptroller, 'venusBorrowerIndex', [mkt._address, a1])).toEqualNumber(0);
    });
  });

  describe('distributeSupplierBai()', () => {
    it('should transfer xvs and update supply index correctly for first time user', async () => {
      const mkt = vREP;
      await send(comptroller.xvs, 'transfer', [comptroller._address, bnbUnsigned(50e18)], {from: root});

      await send(mkt, "harnessSetBalance", [a1, bnbUnsigned(5e18)]);
      await send(comptroller, "setBaiSupplyState", [mkt._address, bnbDouble(6), 10]);
      /*
      * 100 delta blocks, 10e18 total supply, 0.5e18 supplySpeed => 6e18 venusSupplyIndex
      * confirming an acct with half the total supply over that time gets 25e18 XBID:
        supplierAmount  = 5e18
        deltaIndex      = marketStoredIndex - userStoredIndex
                        = 6e36 - 1e36 = 5e36
        suppliedAccrued+= supplierTokens * deltaIndex / 1e36
                        = 5e18 * 5e36 / 1e36 = 25e18
      */

      const tx = await send(comptroller, "harnessDistributeAllSupplierBai", [mkt._address, a1]);
      expect(await venusAccrued(comptroller, a1)).toEqualNumber(0);
      expect(await xvsBalance(comptroller, a1)).toEqualNumber(25e18);
      expect(tx).toHaveLog('DistributedSupplierBai', {
        bToken: mkt._address,
        supplier: a1,
        venusDelta: bnbUnsigned(25e18).toString(),
        venusSupplyIndex: bnbDouble(6).toString()
      });
    });

    it('should update xvs accrued and supply index for repeat user', async () => {
      const mkt = vREP;
      await send(comptroller.xvs, 'transfer', [comptroller._address, bnbUnsigned(50e18)], {from: root});

      await send(mkt, "harnessSetBalance", [a1, bnbUnsigned(5e18)]);
      await send(comptroller, "setBaiSupplyState", [mkt._address, bnbDouble(6), 10]);
      await send(comptroller, "setBaiSupplierIndex", [mkt._address, a1, bnbDouble(2)])
      /*
        supplierAmount  = 5e18
        deltaIndex      = marketStoredIndex - userStoredIndex
                        = 6e36 - 2e36 = 4e36
        suppliedAccrued+= supplierTokens * deltaIndex / 1e36
                        = 5e18 * 4e36 / 1e36 = 20e18
      */

     await send(comptroller, "harnessDistributeAllSupplierBai", [mkt._address, a1]);
      expect(await venusAccrued(comptroller, a1)).toEqualNumber(0);
      expect(await xvsBalance(comptroller, a1)).toEqualNumber(20e18);
    });

    it('should not transfer when venusAccrued below threshold', async () => {
      const mkt = vREP;
      await send(comptroller.xvs, 'transfer', [comptroller._address, bnbUnsigned(50e18)], {from: root});

      await send(mkt, "harnessSetBalance", [a1, bnbUnsigned(5e17)]);
      await send(comptroller, "setBaiSupplyState", [mkt._address, bnbDouble(1.0019), 10]);
      /*
        supplierAmount  = 5e17
        deltaIndex      = marketStoredIndex - userStoredIndex
                        = 1.0019e36 - 1e36 = 0.0019e36
        suppliedAccrued+= supplierTokens * deltaIndex / 1e36
                        = 5e17 * 0.0019e36 / 1e36 = 0.00095e18
      */

      await send(comptroller, "harnessDistributeSupplierBai", [mkt._address, a1]);
      expect(await venusAccrued(comptroller, a1)).toEqualNumber(0.00095e18);
      expect(await xvsBalance(comptroller, a1)).toEqualNumber(0);
    });

    it('should not revert or distribute when called with non-Bai market', async () => {
      const mkt = await makeBToken({
        comptroller: comptroller,
        supportMarket: true,
        addBaiMarket: false,
      });

      await send(comptroller, "harnessDistributeSupplierBai", [mkt._address, a1]);
      expect(await venusAccrued(comptroller, a1)).toEqualNumber(0);
      expect(await xvsBalance(comptroller, a1)).toEqualNumber(0);
      expect(await call(comptroller, 'venusBorrowerIndex', [mkt._address, a1])).toEqualNumber(0);
    });

  });

  describe('transferXBID', () => {
    it('should transfer xvs accrued when amount is above threshold', async () => {
      const venusRemaining = 1000, a1AccruedPre = 100, threshold = 1;
      const xvsBalancePre = await xvsBalance(comptroller, a1);
      const tx0 = await send(comptroller.xvs, 'transfer', [comptroller._address, venusRemaining], {from: root});
      const tx1 = await send(comptroller, 'setBaiAccrued', [a1, a1AccruedPre]);
      const tx2 = await send(comptroller, 'harnessTransferBai', [a1, a1AccruedPre, threshold]);
      const a1AccruedPost = await venusAccrued(comptroller, a1);
      const xvsBalancePost = await xvsBalance(comptroller, a1);
      expect(xvsBalancePre).toEqualNumber(0);
      expect(xvsBalancePost).toEqualNumber(a1AccruedPre);
    });

    it('should not transfer when xvs accrued is below threshold', async () => {
      const venusRemaining = 1000, a1AccruedPre = 100, threshold = 101;
      const xvsBalancePre = await call(comptroller.xvs, 'balanceOf', [a1]);
      const tx0 = await send(comptroller.xvs, 'transfer', [comptroller._address, venusRemaining], {from: root});
      const tx1 = await send(comptroller, 'setBaiAccrued', [a1, a1AccruedPre]);
      const tx2 = await send(comptroller, 'harnessTransferBai', [a1, a1AccruedPre, threshold]);
      const a1AccruedPost = await venusAccrued(comptroller, a1);
      const xvsBalancePost = await xvsBalance(comptroller, a1);
      expect(xvsBalancePre).toEqualNumber(0);
      expect(xvsBalancePost).toEqualNumber(0);
    });

    it('should not transfer xvs if xvs accrued is greater than xvs remaining', async () => {
      const venusRemaining = 99, a1AccruedPre = 100, threshold = 1;
      const xvsBalancePre = await xvsBalance(comptroller, a1);
      const tx0 = await send(comptroller.xvs, 'transfer', [comptroller._address, venusRemaining], {from: root});
      const tx1 = await send(comptroller, 'setBaiAccrued', [a1, a1AccruedPre]);
      const tx2 = await send(comptroller, 'harnessTransferBai', [a1, a1AccruedPre, threshold]);
      const a1AccruedPost = await venusAccrued(comptroller, a1);
      const xvsBalancePost = await xvsBalance(comptroller, a1);
      expect(xvsBalancePre).toEqualNumber(0);
      expect(xvsBalancePost).toEqualNumber(0);
    });
  });

  describe('claimBai', () => {
    it('should accrue xvs and then transfer xvs accrued', async () => {
      const venusRemaining = venusRate.mul(100), mintAmount = bnbUnsigned(12e18), deltaBlocks = 10;
      await send(comptroller.xvs, 'transfer', [comptroller._address, venusRemaining], {from: root});
      await pretendBorrow(vLOW, a1, 1, 1, 100);
      await send(comptroller, '_setBaiSpeed', [vLOW._address, bnbExp(0.5)]);
      await send(comptroller, 'harnessRefreshBaiSpeeds');
      const speed = await call(comptroller, 'venusSpeeds', [vLOW._address]);
      const a2AccruedPre = await venusAccrued(comptroller, a2);
      const xvsBalancePre = await xvsBalance(comptroller, a2);
      await quickMint(vLOW, a2, mintAmount);
      await fastForward(comptroller, deltaBlocks);
      const tx = await send(comptroller, 'claimBai', [a2]);
      const a2AccruedPost = await venusAccrued(comptroller, a2);
      const xvsBalancePost = await xvsBalance(comptroller, a2);
      expect(tx.gasUsed).toBeLessThan(400000);
      expect(speed).toEqualNumber(venusRate);
      expect(a2AccruedPre).toEqualNumber(0);
      expect(a2AccruedPost).toEqualNumber(0);
      expect(xvsBalancePre).toEqualNumber(0);
      expect(xvsBalancePost).toEqualNumber(venusRate.mul(deltaBlocks).sub(1)); // index is 8333...
    });

    it('should accrue xvs and then transfer xvs accrued in a single market', async () => {
      const venusRemaining = venusRate.mul(100), mintAmount = bnbUnsigned(12e18), deltaBlocks = 10;
      await send(comptroller.xvs, 'transfer', [comptroller._address, venusRemaining], {from: root});
      await pretendBorrow(vLOW, a1, 1, 1, 100);
      await send(comptroller, 'harnessAddBaiMarkets', [[vLOW._address]]);
      await send(comptroller, 'harnessRefreshBaiSpeeds');
      const speed = await call(comptroller, 'venusSpeeds', [vLOW._address]);
      const a2AccruedPre = await venusAccrued(comptroller, a2);
      const xvsBalancePre = await xvsBalance(comptroller, a2);
      await quickMint(vLOW, a2, mintAmount);
      await fastForward(comptroller, deltaBlocks);
      const tx = await send(comptroller, 'claimBai', [a2, [vLOW._address]]);
      const a2AccruedPost = await venusAccrued(comptroller, a2);
      const xvsBalancePost = await xvsBalance(comptroller, a2);
      expect(tx.gasUsed).toBeLessThan(220000);
      expect(speed).toEqualNumber(venusRate);
      expect(a2AccruedPre).toEqualNumber(0);
      expect(a2AccruedPost).toEqualNumber(0);
      expect(xvsBalancePre).toEqualNumber(0);
      expect(xvsBalancePost).toEqualNumber(venusRate.mul(deltaBlocks).sub(1)); // index is 8333...
    });

    it('should claim when xvs accrued is below threshold', async () => {
      const venusRemaining = bnbExp(1), accruedAmt = bnbUnsigned(0.0009e18)
      await send(comptroller.xvs, 'transfer', [comptroller._address, venusRemaining], {from: root});
      await send(comptroller, 'setBaiAccrued', [a1, accruedAmt]);
      await send(comptroller, 'claimBai', [a1, [vLOW._address]]);
      expect(await venusAccrued(comptroller, a1)).toEqualNumber(0);
      expect(await xvsBalance(comptroller, a1)).toEqualNumber(accruedAmt);
    });

    it('should revert when a market is not listed', async () => {
      const cNOT = await makeBToken({comptroller});
      await expect(
        send(comptroller, 'claimBai', [a1, [cNOT._address]])
      ).rejects.toRevert('revert not listed market');
    });
  });

  describe('claimBai batch', () => {
    it('should revert when claiming xvs from non-listed market', async () => {
      const venusRemaining = venusRate.mul(100), deltaBlocks = 10, mintAmount = bnbExp(10);
      await send(comptroller.xvs, 'transfer', [comptroller._address, venusRemaining], {from: root});
      let [_, __, ...claimAccts] = saddle.accounts;

      for(let from of claimAccts) {
        expect(await send(vLOW.underlying, 'harnessSetBalance', [from, mintAmount], { from })).toSucceed();
        send(vLOW.underlying, 'approve', [vLOW._address, mintAmount], { from });
        send(vLOW, 'mint', [mintAmount], { from });
      }

      await pretendBorrow(vLOW, root, 1, 1, bnbExp(10));
      await send(comptroller, 'harnessRefreshBaiSpeeds');

      await fastForward(comptroller, deltaBlocks);

      await expect(send(comptroller, 'claimBai', [claimAccts, [vLOW._address, vEVIL._address], true, true])).rejects.toRevert('revert not listed market');
    });

    it('should claim the expected amount when holders and vtokens arg is duplicated', async () => {
      const venusRemaining = venusRate.mul(100), deltaBlocks = 10, mintAmount = bnbExp(10);
      await send(comptroller.xvs, 'transfer', [comptroller._address, venusRemaining], {from: root});
      let [_, __, ...claimAccts] = saddle.accounts;
      for(let from of claimAccts) {
        expect(await send(vLOW.underlying, 'harnessSetBalance', [from, mintAmount], { from })).toSucceed();
        send(vLOW.underlying, 'approve', [vLOW._address, mintAmount], { from });
        send(vLOW, 'mint', [mintAmount], { from });
      }
      await pretendBorrow(vLOW, root, 1, 1, bnbExp(10));
      await send(comptroller, 'harnessAddBaiMarkets', [[vLOW._address]]);
      await send(comptroller, 'harnessRefreshBaiSpeeds');

      await fastForward(comptroller, deltaBlocks);

      const tx = await send(comptroller, 'claimBai', [[...claimAccts, ...claimAccts], [vLOW._address, vLOW._address], false, true]);
      // xvs distributed => 10e18
      for(let acct of claimAccts) {
        expect(await call(comptroller, 'venusSupplierIndex', [vLOW._address, acct])).toEqualNumber(bnbDouble(1.125));
        expect(await xvsBalance(comptroller, acct)).toEqualNumber(bnbExp(1.25));
      }
    });

    it('claims xvs for multiple suppliers only', async () => {
      const venusRemaining = venusRate.mul(100), deltaBlocks = 10, mintAmount = bnbExp(10);
      await send(comptroller.xvs, 'transfer', [comptroller._address, venusRemaining], {from: root});
      let [_, __, ...claimAccts] = saddle.accounts;
      for(let from of claimAccts) {
        expect(await send(vLOW.underlying, 'harnessSetBalance', [from, mintAmount], { from })).toSucceed();
        send(vLOW.underlying, 'approve', [vLOW._address, mintAmount], { from });
        send(vLOW, 'mint', [mintAmount], { from });
      }
      await pretendBorrow(vLOW, root, 1, 1, bnbExp(10));
      await send(comptroller, 'harnessAddBaiMarkets', [[vLOW._address]]);
      await send(comptroller, 'harnessRefreshBaiSpeeds');

      await fastForward(comptroller, deltaBlocks);

      const tx = await send(comptroller, 'claimBai', [claimAccts, [vLOW._address], false, true]);
      // xvs distributed => 10e18
      for(let acct of claimAccts) {
        expect(await call(comptroller, 'venusSupplierIndex', [vLOW._address, acct])).toEqualNumber(bnbDouble(1.125));
        expect(await xvsBalance(comptroller, acct)).toEqualNumber(bnbExp(1.25));
      }
    });

    it('claims xvs for multiple borrowers only, primes uninitiated', async () => {
      const venusRemaining = venusRate.mul(100), deltaBlocks = 10, mintAmount = bnbExp(10), borrowAmt = bnbExp(1), borrowIdx = bnbExp(1)
      await send(comptroller.xvs, 'transfer', [comptroller._address, venusRemaining], {from: root});
      let [_,__, ...claimAccts] = saddle.accounts;

      for(let acct of claimAccts) {
        await send(vLOW, 'harnessIncrementTotalBorrows', [borrowAmt]);
        await send(vLOW, 'harnessSetAccountBorrows', [acct, borrowAmt, borrowIdx]);
      }
      await send(comptroller, 'harnessAddBaiMarkets', [[vLOW._address]]);
      await send(comptroller, 'harnessRefreshBaiSpeeds');

      await send(comptroller, 'harnessFastForward', [10]);

      const tx = await send(comptroller, 'claimBai', [claimAccts, [vLOW._address], true, false]);
      for(let acct of claimAccts) {
        expect(await call(comptroller, 'venusBorrowerIndex', [vLOW._address, acct])).toEqualNumber(bnbDouble(2.25));
        expect(await call(comptroller, 'venusSupplierIndex', [vLOW._address, acct])).toEqualNumber(0);
      }
    });

    it('should revert when a market is not listed', async () => {
      const cNOT = await makeBToken({comptroller});
      await expect(
        send(comptroller, 'claimBai', [[a1, a2], [cNOT._address], true, true])
      ).rejects.toRevert('revert not listed market');
    });
  });

  describe('harnessRefreshBaiSpeeds', () => {
    it('should start out 0', async () => {
      await send(comptroller, 'harnessRefreshBaiSpeeds');
      const speed = await call(comptroller, 'venusSpeeds', [vLOW._address]);
      expect(speed).toEqualNumber(0);
    });

    it('should get correct speeds with borrows', async () => {
      await pretendBorrow(vLOW, a1, 1, 1, 100);
      await send(comptroller, 'harnessAddBaiMarkets', [[vLOW._address]]);
      const tx = await send(comptroller, 'harnessRefreshBaiSpeeds');
      const speed = await call(comptroller, 'venusSpeeds', [vLOW._address]);
      expect(speed).toEqualNumber(venusRate);
      expect(tx).toHaveLog(['BaiSpeedUpdated', 0], {
        bToken: vLOW._address,
        newSpeed: speed
      });
    });

    it('should get correct speeds for 2 assets', async () => {
      await pretendBorrow(vLOW, a1, 1, 1, 100);
      await pretendBorrow(vZRX, a1, 1, 1, 100);
      await send(comptroller, 'harnessAddBaiMarkets', [[vLOW._address, vZRX._address]]);
      await send(comptroller, 'harnessRefreshBaiSpeeds');
      const speed1 = await call(comptroller, 'venusSpeeds', [vLOW._address]);
      const speed2 = await call(comptroller, 'venusSpeeds', [vREP._address]);
      const speed3 = await call(comptroller, 'venusSpeeds', [vZRX._address]);
      expect(speed1).toEqualNumber(venusRate.div(4));
      expect(speed2).toEqualNumber(0);
      expect(speed3).toEqualNumber(venusRate.div(4).mul(3));
    });
  });

  describe('harnessAddBaiMarkets', () => {
    it('should correctly add a venus market if called by admin', async () => {
      const vBAT = await makeBToken({comptroller, supportMarket: true});
      const tx1 = await send(comptroller, 'harnessAddBaiMarkets', [[vLOW._address, vREP._address, vZRX._address]]);
      const tx2 = await send(comptroller, 'harnessAddBaiMarkets', [[vBAT._address]]);
      const markets = await call(comptroller, 'getBaiMarkets');
      expect(markets).toEqual([vLOW, vREP, vZRX, vBAT].map((c) => c._address));
      expect(tx2).toHaveLog('BaiSpeedUpdated', {
        bToken: vBAT._address,
        newSpeed: 1
      });
    });

    it('should not write over a markets existing state', async () => {
      const mkt = vLOW._address;
      const bn0 = 10, bn1 = 20;
      const idx = bnbUnsigned(1.5e36);

      await send(comptroller, "harnessAddBaiMarkets", [[mkt]]);
      await send(comptroller, "setBaiSupplyState", [mkt, idx, bn0]);
      await send(comptroller, "setBaiBorrowState", [mkt, idx, bn0]);
      await send(comptroller, "setBlockNumber", [bn1]);
      await send(comptroller, "_setBaiSpeed", [mkt, 0]);
      await send(comptroller, "harnessAddBaiMarkets", [[mkt]]);

      const supplyState = await call(comptroller, 'venusSupplyState', [mkt]);
      expect(supplyState.block).toEqual(bn1.toString());
      expect(supplyState.index).toEqual(idx.toString());

      const borrowState = await call(comptroller, 'venusBorrowState', [mkt]);
      expect(borrowState.block).toEqual(bn1.toString());
      expect(borrowState.index).toEqual(idx.toString());
    });
  });
});
