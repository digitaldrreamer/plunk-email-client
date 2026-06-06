export interface ScanResult {
  isClean: boolean;
  threats: { type: string; severity: string; description: string }[];
  fileName: string;
}

export async function scanBuffer(buffer: Buffer, fileName: string): Promise<ScanResult> {
  // Dynamic import — package is ESM-only, this works from CJS at runtime
  const { scanFile } = await import("@flutterde/file-scanner");
  const result = await scanFile(buffer, { fileName });
  return {
    isClean: result.isClean,
    threats: result.threats as ScanResult["threats"],
    fileName: result.fileName,
  };
}
