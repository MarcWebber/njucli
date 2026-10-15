import { z } from "zod";

const timestamp = z.iso.datetime({ offset: true, precision: 0 })
  .transform(value => new Date(value).toISOString().replace(".000Z", "Z"));

export const assignmentInput = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  endTime: timestamp,
  startTime: timestamp.optional(),
}).strict().refine(input => !input.startTime || Date.parse(input.startTime) < Date.parse(input.endTime), {
  message: "startTime 必须早于 endTime",
});

export type AssignmentInput = z.infer<typeof assignmentInput>;
