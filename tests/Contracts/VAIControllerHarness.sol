pragma solidity ^0.5.16;

import "../../contracts/BAIController.sol";

contract BAIControllerHarness is BAIController {
    address vaiAddress;
    uint public blockNumber;

    constructor() BAIController() public {}

    function setBaiBAIState(uint224 index, uint32 blockNumber_) public {
        venusBAIState.index = index;
        venusBAIState.block = blockNumber_;
    }

    function setBAIAddress(address vaiAddress_) public {
        vaiAddress = vaiAddress_;
    }

    function getBAIAddress() public view returns (address) {
        return vaiAddress;
    }

    function setBaiBAIMinterIndex(address vaiMinter, uint index) public {
        venusBAIMinterIndex[vaiMinter] = index;
    }

    function harnessUpdateBaiBAIMintIndex() public {
        updateBaiBAIMintIndex();
    }

    function harnessCalcDistributeBAIMinterBai(address vaiMinter) public {
        calcDistributeBAIMinterBai(vaiMinter);
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
}
