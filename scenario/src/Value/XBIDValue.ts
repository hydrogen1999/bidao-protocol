import { Event } from '../Event';
import { World } from '../World';
import { XBID } from '../Contract/XBID';
import {
  getAddressV,
  getNumberV
} from '../CoreValue';
import {
  AddressV,
  ListV,
  NumberV,
  StringV,
  Value
} from '../Value';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import { getXBID } from '../ContractLookup';

export function xvsFetchers() {
  return [
    new Fetcher<{ xvs: XBID }, AddressV>(`
        #### Address

        * "<XBID> Address" - Returns the address of XBID token
          * E.g. "XBID Address"
      `,
      "Address",
      [
        new Arg("xvs", getXBID, { implicit: true })
      ],
      async (world, { xvs }) => new AddressV(xvs._address)
    ),

    new Fetcher<{ xvs: XBID }, StringV>(`
        #### Name

        * "<XBID> Name" - Returns the name of the XBID token
          * E.g. "XBID Name"
      `,
      "Name",
      [
        new Arg("xvs", getXBID, { implicit: true })
      ],
      async (world, { xvs }) => new StringV(await xvs.methods.name().call())
    ),

    new Fetcher<{ xvs: XBID }, StringV>(`
        #### Symbol

        * "<XBID> Symbol" - Returns the symbol of the XBID token
          * E.g. "XBID Symbol"
      `,
      "Symbol",
      [
        new Arg("xvs", getXBID, { implicit: true })
      ],
      async (world, { xvs }) => new StringV(await xvs.methods.symbol().call())
    ),

    new Fetcher<{ xvs: XBID }, NumberV>(`
        #### Decimals

        * "<XBID> Decimals" - Returns the number of decimals of the XBID token
          * E.g. "XBID Decimals"
      `,
      "Decimals",
      [
        new Arg("xvs", getXBID, { implicit: true })
      ],
      async (world, { xvs }) => new NumberV(await xvs.methods.decimals().call())
    ),

    new Fetcher<{ xvs: XBID }, NumberV>(`
        #### TotalSupply

        * "XBID TotalSupply" - Returns XBID token's total supply
      `,
      "TotalSupply",
      [
        new Arg("xvs", getXBID, { implicit: true })
      ],
      async (world, { xvs }) => new NumberV(await xvs.methods.totalSupply().call())
    ),

    new Fetcher<{ xvs: XBID, address: AddressV }, NumberV>(`
        #### TokenBalance

        * "XBID TokenBalance <Address>" - Returns the XBID token balance of a given address
          * E.g. "XBID TokenBalance Geoff" - Returns Geoff's XBID balance
      `,
      "TokenBalance",
      [
        new Arg("xvs", getXBID, { implicit: true }),
        new Arg("address", getAddressV)
      ],
      async (world, { xvs, address }) => new NumberV(await xvs.methods.balanceOf(address.val).call())
    ),

    new Fetcher<{ xvs: XBID, owner: AddressV, spender: AddressV }, NumberV>(`
        #### Allowance

        * "XBID Allowance owner:<Address> spender:<Address>" - Returns the XBID allowance from owner to spender
          * E.g. "XBID Allowance Geoff Torrey" - Returns the XBID allowance of Geoff to Torrey
      `,
      "Allowance",
      [
        new Arg("xvs", getXBID, { implicit: true }),
        new Arg("owner", getAddressV),
        new Arg("spender", getAddressV)
      ],
      async (world, { xvs, owner, spender }) => new NumberV(await xvs.methods.allowance(owner.val, spender.val).call())
    ),

    new Fetcher<{ xvs: XBID, account: AddressV }, NumberV>(`
        #### GetCurrentVotes

        * "XBID GetCurrentVotes account:<Address>" - Returns the current XBID votes balance for an account
          * E.g. "XBID GetCurrentVotes Geoff" - Returns the current XBID vote balance of Geoff
      `,
      "GetCurrentVotes",
      [
        new Arg("xvs", getXBID, { implicit: true }),
        new Arg("account", getAddressV),
      ],
      async (world, { xvs, account }) => new NumberV(await xvs.methods.getCurrentVotes(account.val).call())
    ),

    new Fetcher<{ xvs: XBID, account: AddressV, blockNumber: NumberV }, NumberV>(`
        #### GetPriorVotes

        * "XBID GetPriorVotes account:<Address> blockBumber:<Number>" - Returns the current XBID votes balance at given block
          * E.g. "XBID GetPriorVotes Geoff 5" - Returns the XBID vote balance for Geoff at block 5
      `,
      "GetPriorVotes",
      [
        new Arg("xvs", getXBID, { implicit: true }),
        new Arg("account", getAddressV),
        new Arg("blockNumber", getNumberV),
      ],
      async (world, { xvs, account, blockNumber }) => new NumberV(await xvs.methods.getPriorVotes(account.val, blockNumber.encode()).call())
    ),

    new Fetcher<{ xvs: XBID, account: AddressV }, NumberV>(`
        #### GetCurrentVotesBlock

        * "XBID GetCurrentVotesBlock account:<Address>" - Returns the current XBID votes checkpoint block for an account
          * E.g. "XBID GetCurrentVotesBlock Geoff" - Returns the current XBID votes checkpoint block for Geoff
      `,
      "GetCurrentVotesBlock",
      [
        new Arg("xvs", getXBID, { implicit: true }),
        new Arg("account", getAddressV),
      ],
      async (world, { xvs, account }) => {
        const numCheckpoints = Number(await xvs.methods.numCheckpoints(account.val).call());
        const checkpoint = await xvs.methods.checkpoints(account.val, numCheckpoints - 1).call();

        return new NumberV(checkpoint.fromBlock);
      }
    ),

    new Fetcher<{ xvs: XBID, account: AddressV }, NumberV>(`
        #### VotesLength

        * "XBID VotesLength account:<Address>" - Returns the XBID vote checkpoint array length
          * E.g. "XBID VotesLength Geoff" - Returns the XBID vote checkpoint array length of Geoff
      `,
      "VotesLength",
      [
        new Arg("xvs", getXBID, { implicit: true }),
        new Arg("account", getAddressV),
      ],
      async (world, { xvs, account }) => new NumberV(await xvs.methods.numCheckpoints(account.val).call())
    ),

    new Fetcher<{ xvs: XBID, account: AddressV }, ListV>(`
        #### AllVotes

        * "XBID AllVotes account:<Address>" - Returns information about all votes an account has had
          * E.g. "XBID AllVotes Geoff" - Returns the XBID vote checkpoint array
      `,
      "AllVotes",
      [
        new Arg("xvs", getXBID, { implicit: true }),
        new Arg("account", getAddressV),
      ],
      async (world, { xvs, account }) => {
        const numCheckpoints = Number(await xvs.methods.numCheckpoints(account.val).call());
        const checkpoints = await Promise.all(new Array(numCheckpoints).fill(undefined).map(async (_, i) => {
          const {fromBlock, votes} = await xvs.methods.checkpoints(account.val, i).call();

          return new StringV(`Block ${fromBlock}: ${votes} vote${votes !== 1 ? "s" : ""}`);
        }));

        return new ListV(checkpoints);
      }
    )
  ];
}

export async function getXBIDValue(world: World, event: Event): Promise<Value> {
  return await getFetcherValue<any, any>("XBID", xvsFetchers(), world, event);
}
