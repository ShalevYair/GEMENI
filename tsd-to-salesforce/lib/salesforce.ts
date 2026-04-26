import { GeneratedFile, DeployResult } from '@/types/salesforce';
import JSZip from 'jszip';

const API_VERSION = '59.0';

export function buildSalesforceOAuthUrl(
  clientId: string,
  redirectUri: string,
  sandbox = false
): string {
  const base = sandbox
    ? 'https://test.salesforce.com/services/oauth2/authorize'
    : 'https://login.salesforce.com/services/oauth2/authorize';
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'full refresh_token',
  });
  return `${base}?${params}`;
}

export async function exchangeCodeForToken(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  sandbox = false
): Promise<{ access_token: string; instance_url: string; id: string }> {
  const base = sandbox
    ? 'https://test.salesforce.com'
    : 'https://login.salesforce.com';

  const res = await fetch(`${base}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OAuth error: ${text}`);
  }
  return res.json();
}

async function buildDeployZip(files: GeneratedFile[]): Promise<Buffer> {
  const zip = new JSZip();
  const pkg = zip.folder('unpackaged')!;

  for (const file of files) {
    pkg.file(file.filename, file.content);
  }

  // Build package.xml from filenames
  const types = inferPackageTypes(files);
  pkg.file('package.xml', buildPackageXml(types));

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

function inferPackageTypes(files: GeneratedFile[]): Record<string, string[]> {
  const types: Record<string, string[]> = {};

  for (const f of files) {
    if (f.filename.includes('.object-meta.xml')) {
      const name = f.filename.split('/').pop()!.replace('.object-meta.xml', '');
      (types['CustomObject'] ??= []).push(name);
    } else if (f.filename.includes('.validationRule-meta.xml')) {
      const name = f.filename.split('/').pop()!.replace('.validationRule-meta.xml', '');
      const obj = f.filename.split('/')[1];
      (types['ValidationRule'] ??= []).push(`${obj}.${name}`);
    } else if (f.filename.includes('.flow-meta.xml')) {
      const name = f.filename.split('/').pop()!.replace('.flow-meta.xml', '');
      (types['Flow'] ??= []).push(name);
    } else if (f.filename.includes('.permissionset-meta.xml')) {
      const name = f.filename.split('/').pop()!.replace('.permissionset-meta.xml', '');
      (types['PermissionSet'] ??= []).push(name);
    } else if (f.filename.includes('.layout-meta.xml')) {
      const name = f.filename.split('/').pop()!.replace('.layout-meta.xml', '');
      (types['Layout'] ??= []).push(name);
    }
  }
  return types;
}

function buildPackageXml(types: Record<string, string[]>): string {
  const typeBlocks = Object.entries(types)
    .map(
      ([name, members]) =>
        `    <types>\n${members.map((m) => `        <members>${m}</members>`).join('\n')}\n        <name>${name}</name>\n    </types>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
${typeBlocks}
    <version>${API_VERSION}</version>
</Package>`;
}

export async function deployToSalesforce(
  accessToken: string,
  instanceUrl: string,
  files: GeneratedFile[]
): Promise<DeployResult> {
  const zipBuffer = await buildDeployZip(files);
  const zipBase64 = zipBuffer.toString('base64');

  const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:met="http://soap.sforce.com/2006/04/metadata">
  <soapenv:Header>
    <met:CallOptions/>
    <met:SessionHeader>
      <met:sessionId>${accessToken}</met:sessionId>
    </met:SessionHeader>
  </soapenv:Header>
  <soapenv:Body>
    <met:deploy>
      <met:ZipFile>${zipBase64}</met:ZipFile>
      <met:DeployOptions>
        <met:allowMissingFiles>false</met:allowMissingFiles>
        <met:autoUpdatePackage>false</met:autoUpdatePackage>
        <met:checkOnly>false</met:checkOnly>
        <met:ignoreWarnings>true</met:ignoreWarnings>
        <met:rollbackOnError>true</met:rollbackOnError>
        <met:singlePackage>true</met:singlePackage>
      </met:DeployOptions>
    </met:deploy>
  </soapenv:Body>
</soapenv:Envelope>`;

  const res = await fetch(
    `${instanceUrl}/services/Soap/m/${API_VERSION}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=UTF-8',
        SOAPAction: '""',
      },
      body: soapBody,
    }
  );

  const text = await res.text();

  if (!res.ok) {
    return { success: false, errors: [`HTTP ${res.status}`], raw: text };
  }

  const deployIdMatch = text.match(/<id>([^<]+)<\/id>/);
  const faultMatch = text.match(/<faultstring>([^<]+)<\/faultstring>/);

  if (faultMatch) {
    return { success: false, errors: [faultMatch[1]], raw: text };
  }

  return {
    success: true,
    id: deployIdMatch?.[1],
    raw: text,
  };
}
