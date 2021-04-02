import { Contract } from '../Contract';
import { Callable, Sendable } from '../Invokation';
import { BTokenMethods } from './BToken';
import { encodedNumber } from '../Encoding';

interface BBep20DelegatorMethods extends BTokenMethods {
  implementation(): Callable<string>;
  _setImplementation(
    implementation_: string,
    allowResign: boolean,
    becomImplementationData: string
  ): Sendable<void>;
}

interface BBep20DelegatorScenarioMethods extends BBep20DelegatorMethods {
  setTotalBorrows(amount: encodedNumber): Sendable<void>;
  setTotalReserves(amount: encodedNumber): Sendable<void>;
}

export interface BBep20Delegator extends Contract {
  methods: BBep20DelegatorMethods;
  name: string;
}

export interface BBep20DelegatorScenario extends Contract {
  methods: BBep20DelegatorMethods;
  name: string;
}
