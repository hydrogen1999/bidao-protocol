const {
  address,
  encodeParameters,
} = require('../Utils/BSC');
const {
  makeComptroller,
  makeBToken,
} = require('../Utils/Bai');

function cullTuple(tuple) {
  return Object.keys(tuple).reduce((acc, key) => {
    if (Number.isNaN(Number(key))) {
      return {
        ...acc,
        [key]: tuple[key]
      };
    } else {
      return acc;
    }
  }, {});
}

describe('BaiLens', () => {
  let BaiLens;
  let acct;

  beforeEach(async () => {
    BaiLens = await deploy('BaiLens');
    acct = accounts[0];
  });

  describe('bTokenMetadata', () => {
    it('is correct for a vBep20', async () => {
      let vBep20 = await makeBToken();
      expect(
        cullTuple(await call(BaiLens, 'bTokenMetadata', [vBep20._address]))
      ).toEqual(
        {
          bToken: vBep20._address,
          exchangeRateCurrent: "1000000000000000000",
          supplyRatePerBlock: "0",
          borrowRatePerBlock: "0",
          reserveFactorMantissa: "0",
          totalBorrows: "0",
          totalReserves: "0",
          totalSupply: "0",
          totalCash: "0",
          isListed:false,
          collateralFactorMantissa: "0",
          underlyingAssetAddress: await call(vBep20, 'underlying', []),
          bTokenDecimals: "8",
          underlyingDecimals: "18"
        }
      );
    });

    it('is correct for vBnb', async () => {
      let vBnb = await makeBToken({kind: 'vbnb'});
      expect(
        cullTuple(await call(BaiLens, 'bTokenMetadata', [vBnb._address]))
      ).toEqual({
        borrowRatePerBlock: "0",
        bToken: vBnb._address,
        bTokenDecimals: "8",
        collateralFactorMantissa: "0",
        exchangeRateCurrent: "1000000000000000000",
        isListed: false,
        reserveFactorMantissa: "0",
        supplyRatePerBlock: "0",
        totalBorrows: "0",
        totalCash: "0",
        totalReserves: "0",
        totalSupply: "0",
        underlyingAssetAddress: "0x0000000000000000000000000000000000000000",
        underlyingDecimals: "18",
      });
    });
  });

  describe('bTokenMetadataAll', () => {
    it('is correct for a vBep20 and vBnb', async () => {
      let vBep20 = await makeBToken();
      let vBnb = await makeBToken({kind: 'vbnb'});
      expect(
        (await call(BaiLens, 'bTokenMetadataAll', [[vBep20._address, vBnb._address]])).map(cullTuple)
      ).toEqual([
        {
          bToken: vBep20._address,
          exchangeRateCurrent: "1000000000000000000",
          supplyRatePerBlock: "0",
          borrowRatePerBlock: "0",
          reserveFactorMantissa: "0",
          totalBorrows: "0",
          totalReserves: "0",
          totalSupply: "0",
          totalCash: "0",
          isListed:false,
          collateralFactorMantissa: "0",
          underlyingAssetAddress: await call(vBep20, 'underlying', []),
          bTokenDecimals: "8",
          underlyingDecimals: "18"
        },
        {
          borrowRatePerBlock: "0",
          bToken: vBnb._address,
          bTokenDecimals: "8",
          collateralFactorMantissa: "0",
          exchangeRateCurrent: "1000000000000000000",
          isListed: false,
          reserveFactorMantissa: "0",
          supplyRatePerBlock: "0",
          totalBorrows: "0",
          totalCash: "0",
          totalReserves: "0",
          totalSupply: "0",
          underlyingAssetAddress: "0x0000000000000000000000000000000000000000",
          underlyingDecimals: "18",
        }
      ]);
    });
  });

  describe('bTokenBalances', () => {
    it('is correct for vBEP20', async () => {
      let vBep20 = await makeBToken();
      expect(
        cullTuple(await call(BaiLens, 'bTokenBalances', [vBep20._address, acct]))
      ).toEqual(
        {
          balanceOf: "0",
          balanceOfUnderlying: "0",
          borrowBalanceCurrent: "0",
          bToken: vBep20._address,
          tokenAllowance: "0",
          tokenBalance: "10000000000000000000000000",
        }
      );
    });

    it('is correct for vBNB', async () => {
      let vBnb = await makeBToken({kind: 'vbnb'});
      let bnbBalance = await web3.eth.getBalance(acct);
      expect(
        cullTuple(await call(BaiLens, 'bTokenBalances', [vBnb._address, acct], {gasPrice: '0'}))
      ).toEqual(
        {
          balanceOf: "0",
          balanceOfUnderlying: "0",
          borrowBalanceCurrent: "0",
          bToken: vBnb._address,
          tokenAllowance: bnbBalance,
          tokenBalance: bnbBalance,
        }
      );
    });
  });

  describe('bTokenBalancesAll', () => {
    it('is correct for vBnb and vBep20', async () => {
      let vBep20 = await makeBToken();
      let vBnb = await makeBToken({kind: 'vbnb'});
      let bnbBalance = await web3.eth.getBalance(acct);
      
      expect(
        (await call(BaiLens, 'bTokenBalancesAll', [[vBep20._address, vBnb._address], acct], {gasPrice: '0'})).map(cullTuple)
      ).toEqual([
        {
          balanceOf: "0",
          balanceOfUnderlying: "0",
          borrowBalanceCurrent: "0",
          bToken: vBep20._address,
          tokenAllowance: "0",
          tokenBalance: "10000000000000000000000000",
        },
        {
          balanceOf: "0",
          balanceOfUnderlying: "0",
          borrowBalanceCurrent: "0",
          bToken: vBnb._address,
          tokenAllowance: bnbBalance,
          tokenBalance: bnbBalance,
        }
      ]);
    })
  });

  describe('bTokenUnderlyingPrice', () => {
    it('gets correct price for vBep20', async () => {
      let vBep20 = await makeBToken();
      expect(
        cullTuple(await call(BaiLens, 'bTokenUnderlyingPrice', [vBep20._address]))
      ).toEqual(
        {
          bToken: vBep20._address,
          underlyingPrice: "0",
        }
      );
    });

    it('gets correct price for vBnb', async () => {
      let vBnb = await makeBToken({kind: 'vbnb'});
      expect(
        cullTuple(await call(BaiLens, 'bTokenUnderlyingPrice', [vBnb._address]))
      ).toEqual(
        {
          bToken: vBnb._address,
          underlyingPrice: "1000000000000000000",
        }
      );
    });
  });

  describe('bTokenUnderlyingPriceAll', () => {
    it('gets correct price for both', async () => {
      let vBep20 = await makeBToken();
      let vBnb = await makeBToken({kind: 'vbnb'});
      expect(
        (await call(BaiLens, 'bTokenUnderlyingPriceAll', [[vBep20._address, vBnb._address]])).map(cullTuple)
      ).toEqual([
        {
          bToken: vBep20._address,
          underlyingPrice: "0",
        },
        {
          bToken: vBnb._address,
          underlyingPrice: "1000000000000000000",
        }
      ]);
    });
  });

  describe('getAccountLimits', () => {
    it('gets correct values', async () => {
      let comptroller = await makeComptroller();

      expect(
        cullTuple(await call(BaiLens, 'getAccountLimits', [comptroller._address, acct]))
      ).toEqual({
        liquidity: "0",
        markets: [],
        shortfall: "0"
      });
    });
  });

  describe('governance', () => {
    let xvs, gov;
    let targets, values, signatures, callDatas;
    let proposalBlock, proposalId;
    let votingDelay;
    let votingPeriod;

    beforeEach(async () => {
      xvs = await deploy('XBID', [acct]);
      gov = await deploy('GovernorAlpha', [address(0), xvs._address, address(0)]);
      targets = [acct];
      values = ["0"];
      signatures = ["getBalanceOf(address)"];
      callDatas = [encodeParameters(['address'], [acct])];
      await send(xvs, 'delegate', [acct]);
      await send(gov, 'propose', [targets, values, signatures, callDatas, "do nothing"]);
      proposalBlock = +(await web3.eth.getBlockNumber());
      proposalId = await call(gov, 'latestProposalIds', [acct]);
      votingDelay = Number(await call(gov, 'votingDelay'));
      votingPeriod = Number(await call(gov, 'votingPeriod'));
    });

    describe('getGovReceipts', () => {
      it('gets correct values', async () => {
        expect(
          (await call(BaiLens, 'getGovReceipts', [gov._address, acct, [proposalId]])).map(cullTuple)
        ).toEqual([
          {
            hasVoted: false,
            proposalId: proposalId,
            support: false,
            votes: "0",
          }
        ]);
      })
    });

    describe('getGovProposals', () => {
      it('gets correct values', async () => {
        expect(
          (await call(BaiLens, 'getGovProposals', [gov._address, [proposalId]])).map(cullTuple)
        ).toEqual([
          {
            againstVotes: "0",
            calldatas: callDatas,
            canceled: false,
            endBlock: (Number(proposalBlock) + votingDelay + votingPeriod).toString(),
            eta: "0",
            executed: false,
            forVotes: "0",
            proposalId: proposalId,
            proposer: acct,
            signatures: signatures,
            startBlock: (Number(proposalBlock) + votingDelay).toString(),
            targets: targets
          }
        ]);
      })
    });
  });

  describe('xvs', () => {
    let xvs, currentBlock;

    beforeEach(async () => {
      currentBlock = +(await web3.eth.getBlockNumber());
      xvs = await deploy('XBID', [acct]);
    });

    describe('getXBIDBalanceMetadata', () => {
      it('gets correct values', async () => {
        expect(
          cullTuple(await call(BaiLens, 'getXBIDBalanceMetadata', [xvs._address, acct]))
        ).toEqual({
          balance: "30000000000000000000000000",
          delegate: "0x0000000000000000000000000000000000000000",
          votes: "0",
        });
      });
    });

    describe('getXBIDBalanceMetadataExt', () => {
      it('gets correct values', async () => {
        let comptroller = await makeComptroller();
        await send(comptroller, 'setBaiAccrued', [acct, 5]); // harness only

        expect(
          cullTuple(await call(BaiLens, 'getXBIDBalanceMetadataExt', [xvs._address, comptroller._address, acct]))
        ).toEqual({
          balance: "30000000000000000000000000",
          delegate: "0x0000000000000000000000000000000000000000",
          votes: "0",
          allocated: "5"
        });
      });
    });

    describe('getBaiVotes', () => {
      it('gets correct values', async () => {
        expect(
          (await call(BaiLens, 'getBaiVotes', [xvs._address, acct, [currentBlock, currentBlock - 1]])).map(cullTuple)
        ).toEqual([
          {
            blockNumber: currentBlock.toString(),
            votes: "0",
          },
          {
            blockNumber: (Number(currentBlock) - 1).toString(),
            votes: "0",
          }
        ]);
      });

      it('reverts on future value', async () => {
        await expect(
          call(BaiLens, 'getBaiVotes', [xvs._address, acct, [currentBlock + 1]])
        ).rejects.toRevert('revert XBID::getPriorVotes: not yet determined')
      });
    });
  });
});
