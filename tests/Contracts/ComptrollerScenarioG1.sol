pragma solidity ^0.5.16;

import "../../contracts/ComptrollerG1.sol";

contract ComptrollerScenarioG1 is ComptrollerG1 {
    uint public blockNumber;
    address public xvsAddress;
    address public vaiAddress;

    constructor() ComptrollerG1() public {}

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
}
