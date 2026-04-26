export interface GeneratedFile {
  filename: string;
  content: string;
}

export interface DeployStep {
  id: 1 | 2 | 3 | 4;
  title: string;
  titleHe: string;
  description: string;
  instructions: string;
  metadataTypes: string[];
}

export type StepStatus = 'idle' | 'generating' | 'ready' | 'deploying' | 'done' | 'error';

export interface StepState {
  status: StepStatus;
  files: GeneratedFile[];
  error?: string;
  deployResult?: DeployResult;
}

export interface DeployResult {
  success: boolean;
  id?: string;
  errors?: string[];
  raw?: string;
}

export interface SalesforceSession {
  accessToken: string;
  instanceUrl: string;
  orgId?: string;
}

export interface AppState {
  tsdContent: string;
  session: SalesforceSession | null;
  steps: Record<number, StepState>;
}
