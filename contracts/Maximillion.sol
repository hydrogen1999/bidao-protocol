pragma solidity ^0.5.16;

import "./BBNB.sol";

/**
 * @title Bai's Maximillion Contract
 * @author Bai
 */
contract Maximillion {
    /**
     * @notice The default vBnb market to repay in
     */
    BBNB public vBnb;

    /**
     * @notice Construct a Maximillion to repay max in a BBNB market
     */
    constructor(BBNB vBnb_) public {
        vBnb = vBnb_;
    }

    /**
     * @notice msg.sender sends BNB to repay an account's borrow in the vBnb market
     * @dev The provided BNB is applied towards the borrow balance, any excess is refunded
     * @param borrower The address of the borrower account to repay on behalf of
     */
    function repayBehalf(address borrower) public payable {
        repayBehalfExplicit(borrower, vBnb);
    }

    /**
     * @notice msg.sender sends BNB to repay an account's borrow in a vBnb market
     * @dev The provided BNB is applied towards the borrow balance, any excess is refunded
     * @param borrower The address of the borrower account to repay on behalf of
     * @param vBnb_ The address of the vBnb contract to repay in
     */
    function repayBehalfExplicit(address borrower, BBNB vBnb_) public payable {
        uint received = msg.value;
        uint borrows = vBnb_.borrowBalanceCurrent(borrower);
        if (received > borrows) {
            vBnb_.repayBorrowBehalf.value(borrows)(borrower);
            msg.sender.transfer(received - borrows);
        } else {
            vBnb_.repayBorrowBehalf.value(received)(borrower);
        }
    }
}
