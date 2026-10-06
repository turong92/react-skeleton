export { createLegalApi } from './legalApi'
export type { LegalApi, LegalApiOptions } from './legalApi'
export type * from './types'

export {
  consentRequestsOf,
  DEFAULT_RECONSENT_EXCLUDED,
  isReconsentExcluded,
  isSignUpComplete,
  missingFromError,
  pickDocuments,
  rowsFromMissing,
  signUpRows,
} from './consentLogic'
export type { ConsentRow } from './consentLogic'

export { createReconsentController } from './reconsent'
export type { ReconsentController, ReconsentOptions, ReconsentState } from './reconsent'

export { legalKeys } from './queries'
export {
  useAgree,
  useConsentHistory,
  useLegalDocument,
  useLegalDocuments,
  useMyConsents,
  useWithdraw,
} from './hooks'

export { defaultLegalLabels, koLegalLabels, mergeLegalLabels } from './labels'
export type { LegalLabels } from './labels'
export { formatWhen } from './format'

export { ConsentChecklist } from './ConsentChecklist'
export type { ConsentChecklistProps } from './ConsentChecklist'
export { SignUpConsents } from './SignUpConsents'
export type { ConsentSlot, SignUpConsentsProps } from './SignUpConsents'
export { DocumentDialog } from './DocumentDialog'
export type { DocumentDialogProps } from './DocumentDialog'
export { LegalDocumentView } from './LegalDocumentView'
export type { LegalDocumentViewProps } from './LegalDocumentView'
export { ApiLegalDocumentPage } from './ApiLegalDocumentPage'
export type { ApiLegalDocumentPageProps } from './ApiLegalDocumentPage'
export { ReconsentScreen } from './ReconsentScreen'
export type { ReconsentScreenProps } from './ReconsentScreen'
export { ReconsentGate } from './ReconsentGate'
export type { ReconsentGateProps } from './ReconsentGate'
export { ConsentSettings } from './ConsentSettings'
export type { ConsentSettingsProps } from './ConsentSettings'
