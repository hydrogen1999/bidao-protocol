pragma solidity ^0.5.16;

import "../../contracts/Comptroller.sol";
import "../../contracts/PriceOracle.sol";

contract ComptrollerKovan is Comptroller {
  function getXBIDAddress() public view returns (address) {
    return 0x61460874a7196d6a22D1eE4922473664b3E95270;
  }
}

contract ComptrollerRopsten is Comptroller {
  function getXBIDAddress() public view returns (address) {
    return 0x1Fe16De955718CFAb7A44605458AB023838C2793;
  }
}

contract ComptrollerHarness is Comptroller {
    address xvsAddress;
    uint public blockNumber;

    constructor() Comptroller() public {}

    function setBaiSupplyState(address bToken, uint224 index, uint32 blockNumber_) public {
        venusSupplyState[bToken].index = index;
        venusSupplyState[bToken].block = blockNumber_;
    }

    function setBaiBorrowState(address bToken, uint224 index, uint32 blockNumber_) public {
        venusBorrowState[bToken].index = index;
        venusBorrowState[bToken].block = blockNumber_;
    }

    function setBaiAccrued(address user, uint userAccrued) public {
        venusAccrued[user] = userAccrued;
    }

    function setXBIDAddress(address xvsAddress_) public {
        xvsAddress = xvsAddress_;
    }

    function getXBIDAddress() public view returns (address) {
        return xvsAddress;
    }

    /**
     * @notice Set the amount of XBID distributed per block
     * @param venusRate_ The amount of XBID wei per block to distribute
     */
    function harnessSetBaiRate(uint venusRate_) public {
        venusRate = venusRate_;
    }

    /**
     * @notice Recalculate and update XBID speeds for all XBID markets
     */
    function harnessRefreshBaiSpeeds() public {
        BToken[] memory allMarkets_ = allMarkets;

        for (uint i = 0; i < allMarkets_.length; i++) {
            BToken bToken = allMarkets_[i];
            Exp memory borrowIndex = Exp({mantissa: bToken.borrowIndex()});
            updateBaiSupplyIndex(address(bToken));
            updateBaiBorrowIndex(address(bToken), borrowIndex);
        }

        Exp memory totalUtility = Exp({mantissa: 0});
        Exp[] memory utilities = new Exp[](allMarkets_.length);
        for (uint i = 0; i < allMarkets_.length; i++) {
            BToken bToken = allMarkets_[i];
            if (venusSpeeds[address(bToken)] > 0) {
                Exp memory assetPrice = Exp({mantissa: oracle.getUnderlyingPrice(bToken)});
                Exp memory utility = mul_(assetPrice, bToken.totalBorrows());
                utilities[i] = utility;
                totalUtility = add_(totalUtility, utility);
            }
        }

        for (uint i = 0; i < allMarkets_.length; i++) {
            BToken bToken = allMarkets[i];
            uint newSpeed = totalUtility.mantissa > 0 ? mul_(venusRate, div_(utilities[i], totalUtility)) : 0;
            setBaiSpeedInternal(bToken, newSpeed);
        }
    }

    function setBaiBorrowerIndex(address bToken, address borrower, uint index) public {
        venusBorrowerIndex[bToken][borrower] = index;
    }

    function setBaiSupplierIndex(address bToken, address supplier, uint index) public {
        venusSupplierIndex[bToken][supplier] = index;
    }

    function harnessDistributeAllBorrowerBai(address bToken, address borrower, uint marketBorrowIndexMantissa) public {
        distributeBorrowerBai(bToken, borrower, Exp({mantissa: marketBorrowIndexMantissa}));
        venusAccrued[borrower] = grantXBIDInternal(borrower, venusAccrued[borrower]);
    }

    function harnessDistributeAllSupplierBai(address bToken, address supplier) public {
        distributeSupplierBai(bToken, supplier);
        venusAccrued[supplier] = grantXBIDInternal(supplier, venusAccrued[supplier]);
    }

    function harnessUpdateBaiBorrowIndex(address bToken, uint marketBorrowIndexMantissa) public {
        updateBaiBorrowIndex(bToken, Exp({mantissa: marketBorrowIndexMantissa}));
    }

    function harnessUpdateBaiSupplyIndex(address bToken) public {
        updateBaiSupplyIndex(bToken);
    }

    function harnessDistributeBorrowerBai(address bToken, address borrower, uint marketBorrowIndexMantissa) public {
        distributeBorrowerBai(bToken, borrower, Exp({mantissa: marketBorrowIndexMantissa}));
    }

    function harnessDistributeSupplierBai(address bToken, address supplier) public {
        distributeSupplierBai(bToken, supplier);
    }

    function harnessDistributeBAIMinterBai(address vaiMinter) public {
        distributeBAIMinterBai(vaiMinter, false);
    }

    function harnessTransferBai(address user, uint userAccrued, uint threshold) public returns (uint) {
        if (userAccrued > 0 && userAccrued >= threshold) {
            return grantXBIDInternal(user, userAccrued);
        }
        return userAccrued;
    }

    function harnessAddBaiMarkets(address[] memory bTokens) public {
        for (uint i = 0; i < bTokens.length; i++) {
            // temporarily set venusSpeed to 1 (will be fixed by `harnessRefreshBaiSpeeds`)
            setBaiSpeedInternal(BToken(bTokens[i]), 1);
        }
    }

    function harnessSetMintedBAIs(address user, uint amount) public {
        mintedBAIs[user] = amount;
    }

    function harnessFastForward(uint blocks) public returns (uint) {
        blockNumber += blocks;
        return blockNumber;
    }

    function setBlockNumber(uint number) public {
        blockNumber = number;
    }

    function getBlockNumber() public view returns (uint) {
        return blockNumber;
    }

    function getBaiMarkets() public view returns (address[] memory) {
        uint m = allMarkets.length;
        uint n = 0;
        for (uint i = 0; i < m; i++) {
            if (venusSpeeds[address(allMarkets[i])] > 0) {
                n++;
            }
        }

        address[] memory venusMarkets = new address[](n);
        uint k = 0;
        for (uint i = 0; i < m; i++) {
            if (venusSpeeds[address(allMarkets[i])] > 0) {
                venusMarkets[k++] = address(allMarkets[i]);
            }
        }
        return venusMarkets;
    }
}

contract ComptrollerBorked {
    function _become(Unitroller unitroller) public {
        require(msg.sender == unitroller.admin(), "only unitroller admin can change brains");
        unitroller._acceptImplementation();
    }
}

contract BoolComptroller is ComptrollerInterface {
    bool allowMint = true;
    bool allowRedeem = true;
    bool allowBorrow = true;
    bool allowRepayBorrow = true;
    bool allowLiquidateBorrow = true;
    bool allowSeize = true;
    bool allowTransfer = true;

    bool verifyMint = true;
    bool verifyRedeem = true;
    bool verifyBorrow = true;
    bool verifyRepayBorrow = true;
    bool verifyLiquidateBorrow = true;
    bool verifySeize = true;
    bool verifyTransfer = true;

    bool failCalculateSeizeTokens;
    uint calculatedSeizeTokens;

    uint noError = 0;
    uint opaqueError = noError + 11; // an arbitrary, opaque error code

    /*** Assets You Are In ***/

    function enterMarkets(address[] calldata _bTokens) external returns (uint[] memory) {
        _bTokens;
        uint[] memory ret;
        return ret;
    }

    function exitMarket(address _bToken) external returns (uint) {
        _bToken;
        return noError;
    }

    /*** Policy Hooks ***/

    function mintAllowed(address _bToken, address _minter, uint _mintAmount) external returns (uint) {
        _bToken;
        _minter;
        _mintAmount;
        return allowMint ? noError : opaqueError;
    }

    function mintVerify(address _bToken, address _minter, uint _mintAmount, uint _mintTokens) external {
        _bToken;
        _minter;
        _mintAmount;
        _mintTokens;
        require(verifyMint, "mintVerify rejected mint");
    }

    function redeemAllowed(address _bToken, address _redeemer, uint _redeemTokens) external returns (uint) {
        _bToken;
        _redeemer;
        _redeemTokens;
        return allowRedeem ? noError : opaqueError;
    }

    function redeemVerify(address _bToken, address _redeemer, uint _redeemAmount, uint _redeemTokens) external {
        _bToken;
        _redeemer;
        _redeemAmount;
        _redeemTokens;
        require(verifyRedeem, "redeemVerify rejected redeem");
    }

    function borrowAllowed(address _bToken, address _borrower, uint _borrowAmount) external returns (uint) {
        _bToken;
        _borrower;
        _borrowAmount;
        return allowBorrow ? noError : opaqueError;
    }

    function borrowVerify(address _bToken, address _borrower, uint _borrowAmount) external {
        _bToken;
        _borrower;
        _borrowAmount;
        require(verifyBorrow, "borrowVerify rejected borrow");
    }

    function repayBorrowAllowed(
        address _bToken,
        address _payer,
        address _borrower,
        uint _repayAmount) external returns (uint) {
        _bToken;
        _payer;
        _borrower;
        _repayAmount;
        return allowRepayBorrow ? noError : opaqueError;
    }

    function repayBorrowVerify(
        address _bToken,
        address _payer,
        address _borrower,
        uint _repayAmount,
        uint _borrowerIndex) external {
        _bToken;
        _payer;
        _borrower;
        _repayAmount;
        _borrowerIndex;
        require(verifyRepayBorrow, "repayBorrowVerify rejected repayBorrow");
    }

    function liquidateBorrowAllowed(
        address _bTokenBorrowed,
        address _bTokenCollateral,
        address _liquidator,
        address _borrower,
        uint _repayAmount) external returns (uint) {
        _bTokenBorrowed;
        _bTokenCollateral;
        _liquidator;
        _borrower;
        _repayAmount;
        return allowLiquidateBorrow ? noError : opaqueError;
    }

    function liquidateBorrowVerify(
        address _bTokenBorrowed,
        address _bTokenCollateral,
        address _liquidator,
        address _borrower,
        uint _repayAmount,
        uint _seizeTokens) external {
        _bTokenBorrowed;
        _bTokenCollateral;
        _liquidator;
        _borrower;
        _repayAmount;
        _seizeTokens;
        require(verifyLiquidateBorrow, "liquidateBorrowVerify rejected liquidateBorrow");
    }

    function seizeAllowed(
        address _bTokenCollateral,
        address _bTokenBorrowed,
        address _borrower,
        address _liquidator,
        uint _seizeTokens) external returns (uint) {
        _bTokenCollateral;
        _bTokenBorrowed;
        _liquidator;
        _borrower;
        _seizeTokens;
        return allowSeize ? noError : opaqueError;
    }

    function seizeVerify(
        address _bTokenCollateral,
        address _bTokenBorrowed,
        address _liquidator,
        address _borrower,
        uint _seizeTokens) external {
        _bTokenCollateral;
        _bTokenBorrowed;
        _liquidator;
        _borrower;
        _seizeTokens;
        require(verifySeize, "seizeVerify rejected seize");
    }

    function transferAllowed(
        address _bToken,
        address _src,
        address _dst,
        uint _transferTokens) external returns (uint) {
        _bToken;
        _src;
        _dst;
        _transferTokens;
        return allowTransfer ? noError : opaqueError;
    }

    function transferVerify(
        address _bToken,
        address _src,
        address _dst,
        uint _transferTokens) external {
        _bToken;
        _src;
        _dst;
        _transferTokens;
        require(verifyTransfer, "transferVerify rejected transfer");
    }

    /*** Special Liquidation Calculation ***/

    function liquidateCalculateSeizeTokens(
        address _bTokenBorrowed,
        address _bTokenCollateral,
        uint _repayAmount) external view returns (uint, uint) {
        _bTokenBorrowed;
        _bTokenCollateral;
        _repayAmount;
        return failCalculateSeizeTokens ? (opaqueError, 0) : (noError, calculatedSeizeTokens);
    }

    /**** Mock Settors ****/

    /*** Policy Hooks ***/

    function setMintAllowed(bool allowMint_) public {
        allowMint = allowMint_;
    }

    function setMintVerify(bool verifyMint_) public {
        verifyMint = verifyMint_;
    }

    function setRedeemAllowed(bool allowRedeem_) public {
        allowRedeem = allowRedeem_;
    }

    function setRedeemVerify(bool verifyRedeem_) public {
        verifyRedeem = verifyRedeem_;
    }

    function setBorrowAllowed(bool allowBorrow_) public {
        allowBorrow = allowBorrow_;
    }

    function setBorrowVerify(bool verifyBorrow_) public {
        verifyBorrow = verifyBorrow_;
    }

    function setRepayBorrowAllowed(bool allowRepayBorrow_) public {
        allowRepayBorrow = allowRepayBorrow_;
    }

    function setRepayBorrowVerify(bool verifyRepayBorrow_) public {
        verifyRepayBorrow = verifyRepayBorrow_;
    }

    function setLiquidateBorrowAllowed(bool allowLiquidateBorrow_) public {
        allowLiquidateBorrow = allowLiquidateBorrow_;
    }

    function setLiquidateBorrowVerify(bool verifyLiquidateBorrow_) public {
        verifyLiquidateBorrow = verifyLiquidateBorrow_;
    }

    function setSeizeAllowed(bool allowSeize_) public {
        allowSeize = allowSeize_;
    }

    function setSeizeVerify(bool verifySeize_) public {
        verifySeize = verifySeize_;
    }

    function setTransferAllowed(bool allowTransfer_) public {
        allowTransfer = allowTransfer_;
    }

    function setTransferVerify(bool verifyTransfer_) public {
        verifyTransfer = verifyTransfer_;
    }

    /*** Liquidity/Liquidation Calculations ***/

    function setCalculatedSeizeTokens(uint seizeTokens_) public {
        calculatedSeizeTokens = seizeTokens_;
    }

    function setFailCalculateSeizeTokens(bool shouldFail) public {
        failCalculateSeizeTokens = shouldFail;
    }

    function mintedBAIs(address owner) external pure returns (uint) {
        owner;
        return 1e18;
    }

    function setMintedBAIOf(address owner, uint amount) external returns (uint) {
        owner;
        amount;
        return noError;
    }

    function vaiMintRate() external pure returns (uint) {
        return 1e18;
    }
}

contract EchoTypesComptroller is UnitrollerAdminStorage {
    function stringy(string memory s) public pure returns(string memory) {
        return s;
    }

    function addresses(address a) public pure returns(address) {
        return a;
    }

    function booly(bool b) public pure returns(bool) {
        return b;
    }

    function listOInts(uint[] memory u) public pure returns(uint[] memory) {
        return u;
    }

    function reverty() public pure {
        require(false, "gotcha sucka");
    }

    function becomeBrains(address payable unitroller) public {
        Unitroller(unitroller)._acceptImplementation();
    }
}
