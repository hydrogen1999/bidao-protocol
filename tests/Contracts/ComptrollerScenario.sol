pragma solidity ^0.5.16;

import "../../contracts/Comptroller.sol";

contract ComptrollerScenario is Comptroller {
    uint public blockNumber;
    address public xvsAddress;
    address public vaiAddress;

    constructor() Comptroller() public {}

    function setXBIDAddress(address xvsAddress_) public {
        xvsAddress = xvsAddress_;
    }

    function getXBIDAddress() public view returns (address) {
        return xvsAddress;
    }

    function setBAIAddress(address vaiAddress_) public {
        vaiAddress = vaiAddress_;
    }

    function getBAIAddress() public view returns (address) {
        return vaiAddress;
    }

    function membershipLength(BToken bToken) public view returns (uint) {
        return accountAssets[address(bToken)].length;
    }

    function fastForward(uint blocks) public returns (uint) {
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
            if (markets[address(allMarkets[i])].isBai) {
                n++;
            }
        }

        address[] memory venusMarkets = new address[](n);
        uint k = 0;
        for (uint i = 0; i < m; i++) {
            if (markets[address(allMarkets[i])].isBai) {
                venusMarkets[k++] = address(allMarkets[i]);
            }
        }
        return venusMarkets;
    }

    function unlist(BToken bToken) public {
        markets[address(bToken)].isListed = false;
    }

    /**
     * @notice Recalculate and update XBID speeds for all XBID markets
     */
    function refreshBaiSpeeds() public {
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
}
