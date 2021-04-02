import { Contract } from '../Contract';
import { Sendable } from '../Invokation';
import { BTokenMethods, BTokenScenarioMethods } from './BToken';

interface BBep20DelegateMethods extends BTokenMethods {
  _becomeImplementation(data: string): Sendable<void>;
  _resignImplementation(): Sendable<void>;
}

interface BBep20DelegateScenarioMethods extends BTokenScenarioMethods {
  _becomeImplementation(data: string): Sendable<void>;
  _resignImplementation(): Sendable<void>;
}

export interface BBep20Delegate extends Contract {
  methods: BBep20DelegateMethods;
  name: string;
}

export interface BBep20DelegateScenario extends Contract {
  methods: BBep20DelegateScenarioMethods;
  name: string;
}
