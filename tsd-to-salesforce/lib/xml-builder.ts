import JSZip from 'jszip';
import { GeneratedFile } from '@/types/salesforce';

export async function buildZipBlob(files: GeneratedFile[]): Promise<Blob> {
  const zip = new JSZip();
  for (const file of files) {
    zip.file(file.filename, file.content);
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

export function buildZipBuffer(files: GeneratedFile[]): Promise<Buffer> {
  const zip = new JSZip();
  for (const file of files) {
    zip.file(file.filename, file.content);
  }
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
