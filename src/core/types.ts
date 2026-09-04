export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

export interface FetchResponse {
  ok: boolean;
  status: number;
  url: string;
  text(): Promise<string>;
}

export type FetchLike = (
  input: string | URL,
  init?: RequestInit,
) => Promise<FetchResponse>;
