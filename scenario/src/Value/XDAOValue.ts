import { Event } from '../Event';
import { World } from '../World';
import { XDAO } from '../Contract/XDAO';
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
import { getXDAO } from '../ContractLookup';

export function sxpFetchers() {
  return [
    new Fetcher<{ sxp: XDAO }, AddressV>(`
        #### Address

        * "<XDAO> Address" - Returns the address of XDAO token
          * E.g. "XDAO Address"
      `,
      "Address",
      [
        new Arg("sxp", getXDAO, { implicit: true })
      ],
      async (world, { sxp }) => new AddressV(sxp._address)
    ),

    new Fetcher<{ sxp: XDAO }, StringV>(`
        #### Name

        * "<XDAO> Name" - Returns the name of the XDAO token
          * E.g. "XDAO Name"
      `,
      "Name",
      [
        new Arg("sxp", getXDAO, { implicit: true })
      ],
      async (world, { sxp }) => new StringV(await sxp.methods.name().call())
    ),

    new Fetcher<{ sxp: XDAO }, StringV>(`
        #### Symbol

        * "<XDAO> Symbol" - Returns the symbol of the XDAO token
          * E.g. "XDAO Symbol"
      `,
      "Symbol",
      [
        new Arg("sxp", getXDAO, { implicit: true })
      ],
      async (world, { sxp }) => new StringV(await sxp.methods.symbol().call())
    ),

    new Fetcher<{ sxp: XDAO }, NumberV>(`
        #### Decimals

        * "<XDAO> Decimals" - Returns the number of decimals of the XDAO token
          * E.g. "XDAO Decimals"
      `,
      "Decimals",
      [
        new Arg("sxp", getXDAO, { implicit: true })
      ],
      async (world, { sxp }) => new NumberV(await sxp.methods.decimals().call())
    ),

    new Fetcher<{ sxp: XDAO }, NumberV>(`
        #### TotalSupply

        * "XDAO TotalSupply" - Returns XDAO token's total supply
      `,
      "TotalSupply",
      [
        new Arg("sxp", getXDAO, { implicit: true })
      ],
      async (world, { sxp }) => new NumberV(await sxp.methods.totalSupply().call())
    ),

    new Fetcher<{ sxp: XDAO, address: AddressV }, NumberV>(`
        #### TokenBalance

        * "XDAO TokenBalance <Address>" - Returns the XDAO token balance of a given address
          * E.g. "XDAO TokenBalance Geoff" - Returns Geoff's XDAO balance
      `,
      "TokenBalance",
      [
        new Arg("sxp", getXDAO, { implicit: true }),
        new Arg("address", getAddressV)
      ],
      async (world, { sxp, address }) => new NumberV(await sxp.methods.balanceOf(address.val).call())
    ),

    new Fetcher<{ sxp: XDAO, owner: AddressV, spender: AddressV }, NumberV>(`
        #### Allowance

        * "XDAO Allowance owner:<Address> spender:<Address>" - Returns the XDAO allowance from owner to spender
          * E.g. "XDAO Allowance Geoff Torrey" - Returns the XDAO allowance of Geoff to Torrey
      `,
      "Allowance",
      [
        new Arg("sxp", getXDAO, { implicit: true }),
        new Arg("owner", getAddressV),
        new Arg("spender", getAddressV)
      ],
      async (world, { sxp, owner, spender }) => new NumberV(await sxp.methods.allowance(owner.val, spender.val).call())
    ),

    new Fetcher<{ sxp: XDAO, account: AddressV }, NumberV>(`
        #### GetCurrentVotes

        * "XDAO GetCurrentVotes account:<Address>" - Returns the current XDAO votes balance for an account
          * E.g. "XDAO GetCurrentVotes Geoff" - Returns the current XDAO vote balance of Geoff
      `,
      "GetCurrentVotes",
      [
        new Arg("sxp", getXDAO, { implicit: true }),
        new Arg("account", getAddressV),
      ],
      async (world, { sxp, account }) => new NumberV(await sxp.methods.getCurrentVotes(account.val).call())
    ),

    new Fetcher<{ sxp: XDAO, account: AddressV, blockNumber: NumberV }, NumberV>(`
        #### GetPriorVotes

        * "XDAO GetPriorVotes account:<Address> blockBumber:<Number>" - Returns the current XDAO votes balance at given block
          * E.g. "XDAO GetPriorVotes Geoff 5" - Returns the XDAO vote balance for Geoff at block 5
      `,
      "GetPriorVotes",
      [
        new Arg("sxp", getXDAO, { implicit: true }),
        new Arg("account", getAddressV),
        new Arg("blockNumber", getNumberV),
      ],
      async (world, { sxp, account, blockNumber }) => new NumberV(await sxp.methods.getPriorVotes(account.val, blockNumber.encode()).call())
    ),

    new Fetcher<{ sxp: XDAO, account: AddressV }, NumberV>(`
        #### GetCurrentVotesBlock

        * "XDAO GetCurrentVotesBlock account:<Address>" - Returns the current XDAO votes checkpoint block for an account
          * E.g. "XDAO GetCurrentVotesBlock Geoff" - Returns the current XDAO votes checkpoint block for Geoff
      `,
      "GetCurrentVotesBlock",
      [
        new Arg("sxp", getXDAO, { implicit: true }),
        new Arg("account", getAddressV),
      ],
      async (world, { sxp, account }) => {
        const numCheckpoints = Number(await sxp.methods.numCheckpoints(account.val).call());
        const checkpoint = await sxp.methods.checkpoints(account.val, numCheckpoints - 1).call();

        return new NumberV(checkpoint.fromBlock);
      }
    ),

    new Fetcher<{ sxp: XDAO, account: AddressV }, NumberV>(`
        #### VotesLength

        * "XDAO VotesLength account:<Address>" - Returns the XDAO vote checkpoint array length
          * E.g. "XDAO VotesLength Geoff" - Returns the XDAO vote checkpoint array length of Geoff
      `,
      "VotesLength",
      [
        new Arg("sxp", getXDAO, { implicit: true }),
        new Arg("account", getAddressV),
      ],
      async (world, { sxp, account }) => new NumberV(await sxp.methods.numCheckpoints(account.val).call())
    ),

    new Fetcher<{ sxp: XDAO, account: AddressV }, ListV>(`
        #### AllVotes

        * "XDAO AllVotes account:<Address>" - Returns information about all votes an account has had
          * E.g. "XDAO AllVotes Geoff" - Returns the XDAO vote checkpoint array
      `,
      "AllVotes",
      [
        new Arg("sxp", getXDAO, { implicit: true }),
        new Arg("account", getAddressV),
      ],
      async (world, { sxp, account }) => {
        const numCheckpoints = Number(await sxp.methods.numCheckpoints(account.val).call());
        const checkpoints = await Promise.all(new Array(numCheckpoints).fill(undefined).map(async (_, i) => {
          const {fromBlock, votes} = await sxp.methods.checkpoints(account.val, i).call();

          return new StringV(`Block ${fromBlock}: ${votes} vote${votes !== 1 ? "s" : ""}`);
        }));

        return new ListV(checkpoints);
      }
    )
  ];
}

export async function getXDAOValue(world: World, event: Event): Promise<Value> {
  return await getFetcherValue<any, any>("XDAO", sxpFetchers(), world, event);
}
