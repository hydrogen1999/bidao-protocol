pragma solidity ^0.5.16;

import "../../contracts/ComptrollerG2.sol";

contract ComptrollerScenarioG2 is ComptrollerG2 {
    uint public blockNumber;

    constructor() ComptrollerG2() public {}

    function fastForward(uint blocks) public returns (uint) {
        blockNumber += blocks;
        return blockNumber;
    }

    function setBlockNumber(uint number) public {
        blockNumber = number;
    }

    function membershipLength(BToken bToken) public view returns (uint) {
        return accountAssets[address(bToken)].length;
    }

    function unlist(BToken bToken) public {
        markets[address(bToken)].isListed = false;
    }

    function setBaiSpeed(address bToken, uint venusSpeed) public {
        venusSpeeds[bToken] = venusSpeed;
    }
}
