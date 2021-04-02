import { Event } from '../Event';
import { World } from '../World';
import { BBep20Delegate } from '../Contract/BBep20Delegate';
import {
  getCoreValue,
  mapValue
} from '../CoreValue';
import { Arg, Fetcher, getFetcherValue } from '../Command';
import {
  AddressV,
  Value,
} from '../Value';
import { getWorldContractByAddress, getBTokenDelegateAddress } from '../ContractLookup';

export async function getBTokenDelegateV(world: World, event: Event): Promise<BBep20Delegate> {
  const address = await mapValue<AddressV>(
    world,
    event,
    (str) => new AddressV(getBTokenDelegateAddress(world, str)),
    getCoreValue,
    AddressV
  );

  return getWorldContractByAddress<BBep20Delegate>(world, address.val);
}

async function bTokenDelegateAddress(world: World, bTokenDelegate: BBep20Delegate): Promise<AddressV> {
  return new AddressV(bTokenDelegate._address);
}

export function bTokenDelegateFetchers() {
  return [
    new Fetcher<{ bTokenDelegate: BBep20Delegate }, AddressV>(`
        #### Address

        * "BTokenDelegate <BTokenDelegate> Address" - Returns address of BTokenDelegate contract
          * E.g. "BTokenDelegate vDaiDelegate Address" - Returns vDaiDelegate's address
      `,
      "Address",
      [
        new Arg("bTokenDelegate", getBTokenDelegateV)
      ],
      (world, { bTokenDelegate }) => bTokenDelegateAddress(world, bTokenDelegate),
      { namePos: 1 }
    ),
  ];
}

export async function getBTokenDelegateValue(world: World, event: Event): Promise<Value> {
  return await getFetcherValue<any, any>("BTokenDelegate", bTokenDelegateFetchers(), world, event);
}
