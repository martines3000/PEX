import { PresentationDefinitionV2, PresentationSubmission } from '@sphereon/pex-models';

import { PEX } from './PEX';
import { EvaluationClientWrapper, EvaluationResults, SelectResults } from './evaluation';
import { PresentationSignCallBackParams, PresentationSignOptions } from './signing';
import { InternalVerifiableCredential, Presentation, Proof, VerifiablePresentation } from './types';
import { VerifiableCredential } from './types/SSI.types';
import { SSITypesBuilder } from './types/SSITypesBuilder';
import { PresentationDefinitionV2VB, Validated, ValidationEngine } from './validation';

/**
 * This is the main interfacing class to be used from out side the library to use the functionality provided by the library.
 */
export class PEXv2 {
  private _evaluationClientWrapper: EvaluationClientWrapper;

  constructor() {
    this._evaluationClientWrapper = new EvaluationClientWrapper();
  }

  /***
   * The evaluatePresentationV2 compares what is expected from a presentation with a presentationDefinitionV2.
   *
   * @param presentationDefinition the definition of what is expected in the presentation.
   * @param presentation the presentation which has to be evaluated in comparison of the definition.
   * @param limitDisclosureSignatureSuites the credential signature suites that support limit disclosure
   *
   * @return the evaluation results specify what was expected and was fulfilled and also specifies which requirements described in the input descriptors
   * were not fulfilled by the presentation.
   */
  public evaluatePresentation(
    presentationDefinition: PresentationDefinitionV2,
    presentation: Presentation,
    limitDisclosureSignatureSuites?: string[]
  ): EvaluationResults {
    const presentationCopy: Presentation = JSON.parse(JSON.stringify(presentation));
    const internalVCs: InternalVerifiableCredential[] = SSITypesBuilder.mapExternalVerifiableCredentialsToInternal(
      presentationCopy.verifiableCredential
    );
    this._evaluationClientWrapper = new EvaluationClientWrapper();
    const holderDIDs = presentation.holder ? [presentation.holder] : [];
    return this._evaluationClientWrapper.evaluate(
      SSITypesBuilder.createInternalPresentationDefinitionV2FromModelEntity(presentationDefinition),
      internalVCs,
      holderDIDs,
      limitDisclosureSignatureSuites
    );
  }

  /***
   * The evaluateCredentialsV2 compares what is expected from a verifiableCredentials with the presentationDefinitionV2.
   *
   * @param presentationDefinition the v2 definition of what is expected in the presentation.
   * @param verifiableCredentials the verifiable credentials which are candidates to fulfill requirements defined in the presentationDefinition param.
   * @param holderDIDs the list of the DIDs that the wallet holders controlls.
   * @param limitDisclosureSignatureSuites the credential signature suites that support limit disclosure
   *
   * @return the evaluation results specify what was expected and was fulfilled and also specifies which requirements described in the input descriptors
   * were not fulfilled by the verifiable credentials.
   */
  public evaluateCredentials(
    presentationDefinition: PresentationDefinitionV2,
    verifiableCredentials: InternalVerifiableCredential[],
    holderDIDs: string[],
    limitDisclosureSignatureSuites: string[]
  ): EvaluationResults {
    const verifiableCredentialCopy = JSON.parse(JSON.stringify(verifiableCredentials));
    this._evaluationClientWrapper = new EvaluationClientWrapper();
    return this._evaluationClientWrapper.evaluate(
      SSITypesBuilder.createInternalPresentationDefinitionV2FromModelEntity(presentationDefinition),
      SSITypesBuilder.mapExternalVerifiableCredentialsToInternal(verifiableCredentialCopy),
      holderDIDs,
      limitDisclosureSignatureSuites
    );
  }

  /**
   * The selectFromV2 method is a helper function that helps filter out the verifiable credentials which can not be selected and returns
   * the selectable credentials.
   *
   * @param presentationDefinition the v2 definition of what is expected in the presentation.
   * @param verifiableCredentials verifiable credentials are the credentials from wallet provided to the library to find selectable credentials.
   * @param holderDIDs the decentralized identity of the wallet holder. This is used to identify the credentials issued to the holder of wallet.
   * @param limitDisclosureSignatureSuites the credential signature suites that support limit disclosure
   *
   * @return the selectable credentials.
   */
  public selectFrom(
    presentationDefinition: PresentationDefinitionV2,
    verifiableCredentials: InternalVerifiableCredential[],
    holderDIDs: string[],
    limitDisclosureSignatureSuites: string[]
  ): SelectResults {
    const verifiableCredentialCopy = JSON.parse(JSON.stringify(verifiableCredentials));
    this._evaluationClientWrapper = new EvaluationClientWrapper();
    return this._evaluationClientWrapper.selectFrom(
      SSITypesBuilder.createInternalPresentationDefinitionV2FromModelEntity(presentationDefinition),
      SSITypesBuilder.mapExternalVerifiableCredentialsToInternal(verifiableCredentialCopy),
      holderDIDs,
      limitDisclosureSignatureSuites
    );
  }

  /**
   * This method helps create a Presentation. A Presentation after signing becomes a Verifiable Presentation and can be sent to
   * a verifier.
   *
   * @param presentationDefinition the v2 definition of what is expected in the presentation.
   * @param selectedCredential the credentials which were declared selectable by getSelectableCredentials and then chosen by the intelligent-user
   * (e.g. human).
   * @param holderDID optional; the decentralized identifier of the Credential subject. This is used to identify the holder of the presentation.
   *
   * @return the presentation.
   */
  public presentationFrom(
    presentationDefinition: PresentationDefinitionV2,
    selectedCredential: InternalVerifiableCredential[],
    holderDID?: string
  ): Presentation {
    const presentationSubmission = this._evaluationClientWrapper.submissionFrom(
      SSITypesBuilder.createInternalPresentationDefinitionV2FromModelEntity(presentationDefinition),
      selectedCredential
    );
    return PEX.getPresentation(presentationSubmission, selectedCredential, holderDID);
  }

  /**
   * This method validates whether an object is usable as a presentation definition or not.
   *
   * @param presentationDefinitionV2 the object to be validated.
   *
   * @return the validation results to reveal what is acceptable/unacceptable about the passed object to be considered a valid presentation definition
   */
  public validateDefinition(presentationDefinitionV2: PresentationDefinitionV2): Validated {
    return new ValidationEngine().validate([
      {
        bundler: new PresentationDefinitionV2VB('root'),
        target: presentationDefinitionV2,
      },
    ]);
  }

  /**
   * This method validates whether an object is usable as a presentation submission or not.
   *
   * @param presentationSubmission the object to be validated.
   *
   * @return the validation results to reveal what is acceptable/unacceptable about the passed object to be considered a valid presentation submission
   */
  public validateSubmission(presentationSubmission: PresentationSubmission): Validated {
    return new PEX().validateSubmission(presentationSubmission);
  }

  /**
   * This method can be used to combine a definition, selected Verifiable Credentials, together with
   * signing options and a callback to sign a presentation, making it a Verifiable Presentation before sending.
   *
   * Please note that PE-JS has no signature support on purpose. We didn't want this library to depend on all kinds of signature suites.
   * The callback function next to the Signing Params also gets a Presentation which is evaluated against the definition.
   * It is up to you to decide whether you simply update the supplied partial proof and add it to the presentation in the callback,
   * or whether you will use the selected Credentials, Presentation definition, evaluation results and/or presentation submission together with the signature options
   *
   * @param presentationDefinition the Presentation Definition V2
   * @param selectedCredentials the PE-JS and/or User selected/filtered credentials that will become part of the Verifiable Presentation
   * @param signingCallBack the function which will be provided as a parameter. And this will be the method that will be able to perform actual
   *        signing. One example of signing is available in the project named. pe-selective-disclosure.
   * @param options: Signing Params these are the signing params required to sign.
   *
   * @return the signed and thus Verifiable Presentation.
   */
  public verifiablePresentationFrom(
    presentationDefinition: PresentationDefinitionV2,
    selectedCredentials: VerifiableCredential[],
    signingCallBack: (callBackParams: PresentationSignCallBackParams) => VerifiablePresentation,
    options: PresentationSignOptions
  ): VerifiablePresentation {
    const { holder, signatureOptions, proofOptions } = options;

    function limitedDisclosureSuites() {
      let limitDisclosureSignatureSuites: string[] = [];
      if (proofOptions?.typeSupportsSelectiveDisclosure) {
        if (!proofOptions?.type) {
          throw Error('Please provide a proof type if you enable selective disclosure');
        }
        limitDisclosureSignatureSuites = [proofOptions.type];
      }
      return limitDisclosureSignatureSuites;
    }

    const holderDIDs: string[] = holder ? [holder] : [];
    const limitDisclosureSignatureSuites = limitedDisclosureSuites();
    this.evaluateCredentials(
      presentationDefinition,
      SSITypesBuilder.mapExternalVerifiableCredentialsToInternal(selectedCredentials),
      holderDIDs,
      limitDisclosureSignatureSuites
    );

    const presentation = this.presentationFrom(
      presentationDefinition,
      SSITypesBuilder.mapExternalVerifiableCredentialsToInternal(selectedCredentials),
      holder
    );
    const evaluationResults = this.evaluatePresentation(
      presentationDefinition,
      presentation,
      limitDisclosureSignatureSuites
    );
    if (!evaluationResults.value) {
      throw new Error('Could not get evaluation results from presentation');
    }

    const proof: Partial<Proof> = {
      type: proofOptions?.type,
      verificationMethod: signatureOptions?.verificationMethod,
      created: proofOptions?.created ? proofOptions.created : new Date().toISOString(),
      proofPurpose: proofOptions?.proofPurpose,
      proofValue: signatureOptions?.proofValue,
      jws: signatureOptions?.jws,
      challenge: proofOptions?.challenge,
      nonce: proofOptions?.nonce,
      domain: proofOptions?.domain,
    };

    const callBackParams: PresentationSignCallBackParams = {
      options,
      presentation,
      presentationDefinition,
      selectedCredentials,
      proof,
      presentationSubmission: evaluationResults.value,
      evaluationResults,
    };

    return signingCallBack(callBackParams);
  }
}