
# Run a single cvl e.g.:
#  make -B spec/certora/BBep20/borrowAndRepayFresh.cvl

# TODO:
#  - mintAndRedeemFresh.cvl in progress and is failing due to issues with tool proving how the exchange rate can change
#    hoping for better division modelling - currently fails to prove (a + 1) / b >= a / b
#  - BBep20Delegator/*.cvl cannot yet be run with the tool
#  - vDAI proofs are WIP, require using the delegate and the new revert message assertions

.PHONY: certora-clean

CERTORA_BIN = $(abspath script/certora)
CERTORA_RUN = $(CERTORA_BIN)/run.py
CERTORA_CLI = $(CERTORA_BIN)/cli.jar
CERTORA_EMV = $(CERTORA_BIN)/emv.jar

export CERTORA = $(CERTORA_BIN)
export CERTORA_DISABLE_POPUP = 1

spec/certora/Math/%.cvl:
	$(CERTORA_RUN) \
	 spec/certora/contracts/MathCertora.sol \
	--verify \
	 MathCertora:$@

spec/certora/XBID/search.cvl:
	$(CERTORA_RUN) \
	spec/certora/contracts/XBIDCertora.sol \
	--settings -b=4,-graphDrawLimit=0,-assumeUnwindCond,-depth=100 \
	--solc_args "'--evm-version istanbul'" \
	--verify \
	 XBIDCertora:$@

spec/certora/XBID/transfer.cvl:
	$(CERTORA_RUN) \
	spec/certora/contracts/XBIDCertora.sol \
	--settings -graphDrawLimit=0,-assumeUnwindCond,-depth=100 \
	--solc_args "'--evm-version istanbul'" \
	--verify \
	 XBIDCertora:$@

spec/certora/XDAO/search.cvl:
	$(CERTORA_RUN) \
	spec/certora/contracts/XDAOCertora.sol \
	--settings -b=4,-graphDrawLimit=0,-assumeUnwindCond,-depth=100 \
	--solc_args "'--evm-version istanbul'" \
	--verify \
	 XDAOCertora:$@

spec/certora/XDAO/transfer.cvl:
	$(CERTORA_RUN) \
	spec/certora/contracts/XDAOCertora.sol \
	--settings -graphDrawLimit=0,-assumeUnwindCond,-depth=100 \
	--solc_args "'--evm-version istanbul'" \
	--verify \
	 XDAOCertora:$@

spec/certora/Governor/%.cvl:
	$(CERTORA_RUN) \
	 spec/certora/contracts/GovernorAlphaCertora.sol \
	 spec/certora/contracts/TimelockCertora.sol \
	 spec/certora/contracts/XBIDCertora.sol \
	 spec/certora/contracts/XDAOCertora.sol \
	 --settings -assumeUnwindCond,-enableWildcardInlining=false \
	 --solc_args "'--evm-version istanbul'" \
	 --link \
	 GovernorAlphaCertora:timelock=TimelockCertora \
	 GovernorAlphaCertora:xvs=XBIDCertora \
	 GovernorAlphaCertora:sxp=XDAOCertora \
	--verify \
	 GovernorAlphaCertora:$@

spec/certora/Comptroller/%.cvl:
	$(CERTORA_RUN) \
	 spec/certora/contracts/ComptrollerCertora.sol \
	 spec/certora/contracts/PriceOracleModel.sol \
	--link \
	 ComptrollerCertora:oracle=PriceOracleModel \
	--verify \
	 ComptrollerCertora:$@

spec/certora/vDAI/%.cvl:
	$(CERTORA_RUN) \
	 spec/certora/contracts/BDaiDelegateCertora.sol \
	 spec/certora/contracts/UnderlyingModelNonStandard.sol \
	 spec/certora/contracts/mcd/dai.sol:Dai \
	 spec/certora/contracts/mcd/pot.sol:Pot \
	 spec/certora/contracts/mcd/vat.sol:Vat \
	 spec/certora/contracts/mcd/join.sol:DaiJoin \
	 tests/Contracts/BoolComptroller.sol \
	--link \
	 BDaiDelegateCertora:comptroller=BoolComptroller \
	 BDaiDelegateCertora:underlying=Dai \
	 BDaiDelegateCertora:potAddress=Pot \
	 BDaiDelegateCertora:vatAddress=Vat \
	 BDaiDelegateCertora:daiJoinAddress=DaiJoin \
	--verify \
	 BDaiDelegateCertora:$@ \
	--settings -cache=certora-run-vdai

spec/certora/BBep20/%.cvl:
	$(CERTORA_RUN) \
	 spec/certora/contracts/BBep20ImmutableCertora.sol \
	 spec/certora/contracts/BTokenCollateral.sol \
	 spec/certora/contracts/ComptrollerCertora.sol \
	 spec/certora/contracts/InterestRateModelModel.sol \
	 spec/certora/contracts/UnderlyingModelNonStandard.sol \
	--link \
	 BBep20ImmutableCertora:otherToken=BTokenCollateral \
	 BBep20ImmutableCertora:comptroller=ComptrollerCertora \
	 BBep20ImmutableCertora:underlying=UnderlyingModelNonStandard \
	 BBep20ImmutableCertora:interestRateModel=InterestRateModelModel \
	 BTokenCollateral:comptroller=ComptrollerCertora \
	 BTokenCollateral:underlying=UnderlyingModelNonStandard \
	--verify \
	 BBep20ImmutableCertora:$@ \
	--settings -cache=certora-run-vbep20-immutable

spec/certora/BBep20Delegator/%.cvl:
	$(CERTORA_RUN) \
	 spec/certora/contracts/BBep20DelegatorCertora.sol \
	 spec/certora/contracts/BBep20DelegateCertora.sol \
	 spec/certora/contracts/BTokenCollateral.sol \
	 spec/certora/contracts/ComptrollerCertora.sol \
	 spec/certora/contracts/InterestRateModelModel.sol \
	 spec/certora/contracts/UnderlyingModelNonStandard.sol \
	--link \
	 BBep20DelegatorCertora:implementation=BBep20DelegateCertora \
	 BBep20DelegatorCertora:otherToken=BTokenCollateral \
	 BBep20DelegatorCertora:comptroller=ComptrollerCertora \
	 BBep20DelegatorCertora:underlying=UnderlyingModelNonStandard \
	 BBep20DelegatorCertora:interestRateModel=InterestRateModelModel \
	 BTokenCollateral:comptroller=ComptrollerCertora \
	 BTokenCollateral:underlying=UnderlyingModelNonStandard \
	--verify \
	 BBep20DelegatorCertora:$@ \
	--settings -assumeUnwindCond \
	--settings -cache=certora-run-vbep20-delegator

spec/certora/Maximillion/%.cvl:
	$(CERTORA_RUN) \
	 spec/certora/contracts/MaximillionCertora.sol \
	 spec/certora/contracts/BBNBCertora.sol \
	--link \
	 MaximillionCertora:vBnb=BBNBCertora \
	--verify \
	 MaximillionCertora:$@

spec/certora/Timelock/%.cvl:
	$(CERTORA_RUN) \
	 spec/certora/contracts/TimelockCertora.sol \
	--verify \
	 TimelockCertora:$@

certora-clean:
	rm -rf .certora_build.json .certora_config certora_verify.json emv-*
