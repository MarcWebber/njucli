import { z } from "zod";

export const OPAC_BASE_URL = "https://opac.nju.edu.cn";

const nullableString = z.string().nullish();

export const searchBookSchema = z.object({
  bibId: z.union([z.string(), z.number().transform(String)]),
  title: z.string().min(1),
  author: nullableString,
  callno: z.array(z.string()).nullish(),
  itemCount: z.coerce.number().int().nonnegative(),
  circCount: z.coerce.number().int().nonnegative(),
});

export const searchEnvelopeSchema = z.object({
  code: z.coerce.number(),
  msg: z.string().nullish(),
  data: z.object({
    actualTotal: z.coerce.number().int().nonnegative(),
    dataList: z.array(searchBookSchema),
  }),
});

export const holdingSchema = z.object({
  callNo: z.string().min(1),
  library: nullableString,
  location: z.string().min(1),
  shelfMark: nullableString,
  status: z.string().min(1),
  itemsAvailable: z.coerce.number().int().nonnegative(),
});

export const holdingsEnvelopeSchema = z.object({
  code: z.coerce.number(),
  msg: z.string().nullish(),
  data: z.object({ holdings: z.string() }),
});

export const bookInfoEnvelopeSchema = z.object({
  code: z.coerce.number(),
  msg: z.string().nullish(),
  data: z.object({
    map: z.object({
      baseInfo: z.object({
        map: z.object({
          title: z.string().min(1),
          author: nullableString,
        }),
      }),
    }),
  }),
});

export const loanSchema = z.object({
  title: z.string().min(1),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  isOverdue: z.coerce.number().int(),
});

export const loansEnvelopeSchema = z.object({
  code: z.coerce.number(),
  msg: z.string().nullish(),
  data: z.array(loanSchema),
});
