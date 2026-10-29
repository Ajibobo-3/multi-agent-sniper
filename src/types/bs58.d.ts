declare module 'bs58' {
  export function encode(buffer: Uint8Array | number[]): string;
  export function decode(string: string): Uint8Array;
}
