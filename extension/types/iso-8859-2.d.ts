declare module "iso-8859-2" {
  function encode(input: string): string;
  function decode(input: string): string;
  const labels: string[];
  const version: string;
}
