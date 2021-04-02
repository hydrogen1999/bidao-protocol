import { Contract } from '../Contract';
import { encodedNumber } from '../Encoding';
import { Callable, Sendable } from '../Invokation';

export interface BaiLensMethods {
  bTokenBalances(bToken: string, account: string): Sendable<[string,number,number,number,number,number]>;
  bTokenBalancesAll(bTokens: string[], account: string): Sendable<[string,number,number,number,number,number][]>;
  bTokenMetadata(bToken: string): Sendable<[string,number,number,number,number,number,number,number,number,boolean,number,string,number,number]>;
  bTokenMetadataAll(bTokens: string[]): Sendable<[string,number,number,number,number,number,number,number,number,boolean,number,string,number,number][]>;
  bTokenUnderlyingPrice(bToken: string): Sendable<[string,number]>;
  bTokenUnderlyingPriceAll(bTokens: string[]): Sendable<[string,number][]>;
  getAccountLimits(comptroller: string, account: string): Sendable<[string[],number,number]>;
}

export interface BaiLens extends Contract {
  methods: BaiLensMethods;
  name: string;
}
