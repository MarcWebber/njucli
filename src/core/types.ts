export interface FetchResponse {
  ok: boolean;
  status: number;
  url: string;
  headers: Pick<Headers, "get">;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export type FetchLike = (
  input: string | URL,
  init?: RequestInit,
) => Promise<FetchResponse>;
