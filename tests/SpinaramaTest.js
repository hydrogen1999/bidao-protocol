const {
  bnbMantissa,
  minerStart,
  minerStop
} = require('./Utils/BSC');

const {
  makeBToken,
  balanceOf,
  borrowSnapshot,
  enterMarkets
} = require('./Utils/Bai');

describe('Spinarama', () => {
  let root, from, accounts;

  beforeEach(async () => {
    [root, from, ...accounts] = saddle.accounts;
  });

  describe('#mintMint', () => {
    it('should succeed', async () => {
      const bToken = await makeBToken({supportMarket: true, underlyingPrice: 1});
      await send(bToken.underlying, 'harnessSetBalance', [from, 100], {from});
      await send(bToken.underlying, 'approve', [bToken._address, '0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'], {from});
      await minerStop();
      const p1 = send(bToken, 'mint', [1], {from});
      const p2 = send(bToken, 'mint', [2], {from});
      await minerStart();
      expect(await p1).toSucceed();
      expect(await p2).toSucceed();
      expect(await balanceOf(bToken, from)).toEqualNumber(3);
    });

    it('should partial succeed', async () => {
      const bToken = await makeBToken({supportMarket: true, underlyingPrice: 1});
      await send(bToken.underlying, 'harnessSetBalance', [from, 100], {from});
      await send(bToken.underlying, 'approve', [bToken._address, 10], {from});
      await minerStop();
      const p1 = send(bToken, 'mint', [11], {from});
      const p2 = send(bToken, 'mint', [10], {from});
      await expect(minerStart()).rejects.toRevert("revert Insufficient allowance");
      try {
        await p1;
      } catch (err) {
        // hack: miner start reverts with correct message, but tx gives us a weird tx obj. ganache bug?
        expect(err.toString()).toContain("reverted by the EVM");
      }
      await expect(p2).resolves.toSucceed();
      expect(await balanceOf(bToken, from)).toEqualNumber(10);
    });
  });

  describe('#mintRedeem', () => {
    it('should succeed', async () => {
      const bToken = await makeBToken({supportMarket: true, underlyingPrice: 1});
      await send(bToken.underlying, 'harnessSetBalance', [from, 100], {from});
      await send(bToken.underlying, 'approve', [bToken._address, 10], {from});
      await send(bToken.comptroller.vai, 'approve', [bToken.comptroller._address, 100], {from});
      await minerStop();
      const p1 = send(bToken, 'mint', [10], {from});
      const p2 = send(bToken, 'redeemUnderlying', [10], {from});
      await minerStart();
      expect(await p1).toSucceed();
      expect(await p2).toSucceed();
      expect(await balanceOf(bToken, from)).toEqualNumber(0);
    });
  });

  describe('#redeemMint', () => {
    it('should succeed', async () => {
      const bToken = await makeBToken({supportMarket: true, underlyingPrice: 1});
      await send(bToken, 'harnessSetTotalSupply', [10]);
      await send(bToken, 'harnessSetExchangeRate', [bnbMantissa(1)]);
      await send(bToken, 'harnessSetBalance', [from, 10]);
      await send(bToken.underlying, 'harnessSetBalance', [bToken._address, 10]);
      await send(bToken.underlying, 'approve', [bToken._address, 10], {from});
      await minerStop();
      const p1 = send(bToken, 'redeem', [10], {from});
      const p2 = send(bToken, 'mint', [10], {from});
      await minerStart();
      expect(await p1).toSucceed();
      expect(await p2).toSucceed();
      expect(await balanceOf(bToken, from)).toEqualNumber(10);
    });
  });

  describe('#repayRepay', () => {
    it('should succeed', async () => {
      const bToken1 = await makeBToken({supportMarket: true, underlyingPrice: 1, collateralFactor: .5});
      const bToken2 = await makeBToken({supportMarket: true, underlyingPrice: 1, comptroller: bToken1.comptroller});
      await send(bToken1.underlying, 'harnessSetBalance', [from, 10]);
      await send(bToken1.underlying, 'approve', [bToken1._address, 10], {from});
      await send(bToken2.underlying, 'harnessSetBalance', [bToken2._address, 10]);
      await send(bToken2, 'harnessSetTotalSupply', [100]);
      await send(bToken2.underlying, 'approve', [bToken2._address, 10], {from});
      await send(bToken2, 'harnessSetExchangeRate', [bnbMantissa(1)]);
      await send(bToken1.comptroller.vai, 'approve', [bToken1.comptroller._address, 100], {from});
      expect(await enterMarkets([bToken1, bToken2], from)).toSucceed();
      expect(await send(bToken1, 'mint', [10], {from})).toSucceed();
      expect(await send(bToken2, 'borrow', [2], {from})).toSucceed();
      await minerStop();
      const p1 = send(bToken2, 'repayBorrow', [1], {from});
      const p2 = send(bToken2, 'repayBorrow', [1], {from});
      await minerStart();
      expect(await p1).toSucceed();
      expect(await p2).toSucceed();
      expect((await borrowSnapshot(bToken2, from)).principal).toEqualNumber(0);
    });

    // XXX not yet converted below this point...moving on to certora

    it.skip('can have partial failure succeed', async () => {
      const {moneyMarketHarness,
        priceOracle,
        interestRateModel} = await setupMoneyMarket(root);
      const spinarama = await Spinarama.new(moneyMarketHarness._address).send({from: root});
      const OMG = await setupSupply(root, accounts[0], spinarama, moneyMarketHarness, priceOracle, interestRateModel);
      const BAT = await setupBorrow(root, accounts[0], spinarama, moneyMarketHarness, priceOracle, interestRateModel);

      // Add cash to the protocol
      await addCash(moneyMarketHarness, BAT, root);

      // Supply some collateral
      expect(await spinarama.methods.supply(OMG._address, 15).send({from: accounts[0]})).toSucceed();

      // Now borrow 5 bat
      expect(await spinarama.methods.borrow(BAT._address, 5).send({from: accounts[0]})).toSucceed();

      // And repay it, repay it
      const {'0': err0, '1': err1} = await spinarama.methods.repayRepay(BAT._address, 100, 1).call({from: accounts[0]});

      expect(err0).hasErrorCode(ErrorEnum.INTEGER_UNDERFLOW);
      expect(err1).hasErrorCode(ErrorEnum.NO_ERROR);
    });
  });

  describe('#borrowRepayBorrow', () => {
    it.skip('should fail', async () => {
      const {moneyMarketHarness,
        priceOracle,
        interestRateModel} = await setupMoneyMarket(root);
      const spinarama = await Spinarama.new(moneyMarketHarness._address).send({from: root});
      const OMG = await setupSupply(root, accounts[0], spinarama, moneyMarketHarness, priceOracle, interestRateModel);
      const BAT = await setupBorrow(root, accounts[0], spinarama, moneyMarketHarness, priceOracle, interestRateModel);

      // Add cash to the protocol
      await addCash(moneyMarketHarness, BAT, root);

      // Supply some collateral
      expect(await spinarama.methods.supply(OMG._address, 15).send({from: accounts[0]})).toSucceed();

      // Borrow then repayBorrow should revert
      await expect(
        spinarama.methods.borrowRepayBorrow(BAT._address, 5, 1).call({from: accounts[0]})
      ).rejects.toRevert();
    });

    it.skip('can succeed with partial failure', async () => {
      const {moneyMarketHarness,
        priceOracle,
        interestRateModel} = await setupMoneyMarket(root);
      const spinarama = await Spinarama.new(moneyMarketHarness._address).send({from: root});
      const OMG = await setupSupply(root, accounts[0], spinarama, moneyMarketHarness, priceOracle, interestRateModel);
      const BAT = await setupBorrow(root, accounts[0], spinarama, moneyMarketHarness, priceOracle, interestRateModel);

      // Add cash to the protocol
      await addCash(moneyMarketHarness, BAT, root);

      // Supply some collateral
      expect(await spinarama.methods.supply(OMG._address, 15).send({from: accounts[0]})).toSucceed();

      // Borrow a little, repay a lot
      const {'0': err0, '1': err1} = await spinarama.methods.borrowRepayBorrow(BAT._address, 1, 1000).call({from: accounts[0]});

      expect(err0).hasErrorCode(ErrorEnum.NO_ERROR);
      expect(err1).hasErrorCode(ErrorEnum.INTEGER_UNDERFLOW);
    });
  });

  describe('#borrowSupply', () => {
    it.skip('should fail in same asset', async () => {
      const {moneyMarketHarness,
        priceOracle,
        interestRateModel} = await setupMoneyMarket(root);
      const spinarama = await Spinarama.new(moneyMarketHarness._address).send({from: root});
      const OMG = await setupSupply(root, accounts[0], spinarama, moneyMarketHarness, priceOracle, interestRateModel);
      const BAT = await setupBorrow(root, accounts[0], spinarama, moneyMarketHarness, priceOracle, interestRateModel);

      // Add cash to the protocol
      await addCash(moneyMarketHarness, BAT, root);

      // Supply some collateral
      expect(await spinarama.methods.supply(OMG._address, 15).send({from: accounts[0]})).toSucceed();

      // Borrow then supply should revert
      await expect(
        spinarama.methods.borrowSupply(BAT._address, BAT._address, 5, 1).call({from: accounts[0]})
      ).rejects.toRevert();
    });

    it.skip('should fail, even in different assets', async () => {
      const {moneyMarketHarness,
        priceOracle,
        interestRateModel} = await setupMoneyMarket(root);
      const spinarama = await Spinarama.new(moneyMarketHarness._address).send({from: root});
      const OMG = await setupSupply(root, accounts[0], spinarama, moneyMarketHarness, priceOracle, interestRateModel);
      const BAT = await setupBorrow(root, accounts[0], spinarama, moneyMarketHarness, priceOracle, interestRateModel);

      // Add cash to the protocol
      await addCash(moneyMarketHarness, BAT, root);

      // Supply some collateral
      expect(await spinarama.methods.supply(OMG._address, 15).send({from: accounts[0]})).toSucceed();

      // Borrow then supply in different assets
      await expect(
        spinarama.methods.borrowSupply(BAT._address, OMG._address, 5, 1).call({from: accounts[0]})
      ).rejects.toRevert();
    });
  });

  describe('#supplyLiquidate', () => {
    it.skip('should fail', async () => {
      const {moneyMarketHarness,
        priceOracle,
        interestRateModel} = await setupMoneyMarket(root);
      const spinarama = await Spinarama.new(moneyMarketHarness._address).send({from: root});
      const OMG = await setupSupply(root, accounts[0], spinarama, moneyMarketHarness, priceOracle, interestRateModel);
      const BAT = await setupBorrow(root, accounts[0], spinarama, moneyMarketHarness, priceOracle, interestRateModel);

      // Add cash to the protocol
      await addCash(moneyMarketHarness, BAT, root);

      // Supply some collateral
      expect(await spinarama.methods.supply(OMG._address, 15).send({from: accounts[0]})).toSucceed();

      await expect(
        spinarama.methods.supplyLiquidate(OMG._address, 5, accounts[0], OMG._address, BAT._address, 0).call({from: accounts[0]})
      ).rejects.toRevert();
    });
  });

  describe('#withdrawLiquidate', () => {
    it.skip('should fail', async () => {
      const {moneyMarketHarness,
        priceOracle,
        interestRateModel} = await setupMoneyMarket(root);
      const spinarama = await Spinarama.new(moneyMarketHarness._address).send({from: root});
      const OMG = await setupSupply(root, accounts[0], spinarama, moneyMarketHarness, priceOracle, interestRateModel);
      const BAT = await setupBorrow(root, accounts[0], spinarama, moneyMarketHarness, priceOracle, interestRateModel);

      // Add cash to the protocol
      await addCash(moneyMarketHarness, BAT, root);

      // Supply some collateral
      expect(await spinarama.methods.supply(OMG._address, 15).send({from: accounts[0]})).toSucceed();

      await expect(
        spinarama.methods.withdrawLiquidate(OMG._address, 5, accounts[0], OMG._address, BAT._address, 0).call({from: accounts[0]})
      ).rejects.toRevert();
    });
  });

  describe('#borrowLiquidate', () => {
    it.skip('should fail', async () => {
      const {moneyMarketHarness,
        priceOracle,
        interestRateModel} = await setupMoneyMarket(root);
      const spinarama = await Spinarama.new(moneyMarketHarness._address).send({from: root});
      const OMG = await setupSupply(root, accounts[0], spinarama, moneyMarketHarness, priceOracle, interestRateModel);
      const BAT = await setupBorrow(root, accounts[0], spinarama, moneyMarketHarness, priceOracle, interestRateModel);

      // Add cash to the protocol
      await addCash(moneyMarketHarness, BAT, root);

      // Supply some collateral
      expect(await spinarama.methods.supply(OMG._address, 15).send({from: accounts[0]})).toSucceed();

      await expect(
        spinarama.methods.borrowLiquidate(OMG._address, 5, accounts[0], OMG._address, BAT._address, 0).call({from: accounts[0]})
      ).rejects.toRevert();
    });
  });

  describe('#repayBorrowLiquidate', () => {
    it.skip('should fail', async () => {
      const {moneyMarketHarness,
        priceOracle,
        interestRateModel} = await setupMoneyMarket(root)
      const spinarama = await Spinarama.new(moneyMarketHarness._address).send({from: root});
      const OMG = await setupSupply(root, accounts[0], spinarama, moneyMarketHarness, priceOracle, interestRateModel);
      const BAT = await setupBorrow(root, accounts[0], spinarama, moneyMarketHarness, priceOracle, interestRateModel);

      // Add cash to the protocol
      await addCash(moneyMarketHarness, BAT, root);

      // Supply some collateral
      expect(await spinarama.methods.supply(OMG._address, 15).send({from: accounts[0]})).toSucceed();

      // Borrow some OMG
      expect(await spinarama.methods.borrow(OMG._address, 5).send({from: accounts[0]})).toSucceed();

      await expect(
        spinarama.methods.repayBorrowLiquidate(OMG._address, 1, accounts[0], OMG._address, BAT._address, 0).call({from: accounts[0]})
      ).rejects.toRevert();
    });
  });

  describe('#liquidateLiquidate', () => {
    it.skip('should fail', async () => {
      const {moneyMarketHarness,
        priceOracle,
        interestRateModel} = await setupMoneyMarket(root)
      const spinarama = await Spinarama.new(moneyMarketHarness._address).send({from: root});
      const OMG = await setupSupply(root, accounts[0], spinarama, moneyMarketHarness, priceOracle, interestRateModel);
      const BAT = await setupBorrow(root, accounts[0], spinarama, moneyMarketHarness, priceOracle, interestRateModel);

      // Add cash to the protocol
      await addCash(moneyMarketHarness, BAT, root);

      // Supply some collateral
      expect(await spinarama.methods.supply(OMG._address, 15).send({from: accounts[0]})).toSucceed();

      await expect(
        spinarama.methods.liquidateLiquidate(OMG._address, 1, accounts[0], OMG._address, BAT._address, 0).call({from: accounts[0]})
      ).rejects.toRevert();
    });
  });
});
