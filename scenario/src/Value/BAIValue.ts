import { Event } from '../Event';
import { World } from '../World';
import { BAI } from '../Contract/BAI';
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
import { getBAI } from '../ContractLookup';

export function vaiFetchers() {
  return [
    new Fetcher<{ vai: BAI }, AddressV>(`
        #### Address

        * "<BAI> Address" - Returns the address of BAI token
          * E.g. "BAI Address"
      `,
      "Address",
      [
        new Arg("vai", getBAI, { implicit: true })
      ],
      async (world, { vai }) => new AddressV(vai._address)
    ),

    new Fetcher<{ vai: BAI }, StringV>(`
        #### Name

        * "<BAI> Name" - Returns the name of the BAI token
          * E.g. "BAI Name"
      `,
      "Name",
      [
        new Arg("vai", getBAI, { implicit: true })
      ],
      async (world, { vai }) => new StringV(await vai.methods.name().call())
    ),

    new Fetcher<{ vai: BAI }, StringV>(`
        #### Symbol

        * "<BAI> Symbol" - Returns the symbol of the BAI token
          * E.g. "BAI Symbol"
      `,
      "Symbol",
      [
        new Arg("vai", getBAI, { implicit: true })
      ],
      async (world, { vai }) => new StringV(await vai.methods.symbol().call())
    ),

    new Fetcher<{ vai: BAI }, NumberV>(`
        #### Decimals

        * "<BAI> Decimals" - Returns the number of decimals of the BAI token
          * E.g. "BAI Decimals"
      `,
      "Decimals",
      [
        new Arg("vai", getBAI, { implicit: true })
      ],
      async (world, { vai }) => new NumberV(await vai.methods.decimals().call())
    ),

    new Fetcher<{ vai: BAI }, NumberV>(`
        #### TotalSupply

        * "BAI TotalSupply" - Returns BAI token's total supply
      `,
      "TotalSupply",
      [
        new Arg("vai", getBAI, { implicit: true })
      ],
      async (world, { vai }) => new NumberV(await vai.methods.totalSupply().call())
    ),

    new Fetcher<{ vai: BAI, address: AddressV }, NumberV>(`
        #### TokenBalance

        * "BAI TokenBalance <Address>" - Returns the BAI token balance of a given address
          * E.g. "BAI TokenBalance Geoff" - Returns Geoff's BAI balance
      `,
      "TokenBalance",
      [
        new Arg("vai", getBAI, { implicit: true }),
        new Arg("address", getAddressV)
      ],
      async (world, { vai, address }) => new NumberV(await vai.methods.balanceOf(address.val).call())
    ),

    new Fetcher<{ vai: BAI, owner: AddressV, spender: AddressV }, NumberV>(`
        #### Allowance

        * "BAI Allowance owner:<Address> spender:<Address>" - Returns the BAI allowance from owner to spender
          * E.g. "BAI Allowance Geoff Torrey" - Returns the BAI allowance of Geoff to Torrey
      `,
      "Allowance",
      [
        new Arg("vai", getBAI, { implicit: true }),
        new Arg("owner", getAddressV),
        new Arg("spender", getAddressV)
      ],
      async (world, { vai, owner, spender }) => new NumberV(await vai.methods.allowance(owner.val, spender.val).call())
    )
  ];
}

export async function getBAIValue(world: World, event: Event): Promise<Value> {
  return await getFetcherValue<any, any>("BAI", vaiFetchers(), world, event);
}
