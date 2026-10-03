import { z } from "zod";

export const checkoutSchema = z.object({
  orderId: z.string().min(1),
  customerId: z.string().min(1),
  courseId: z.string().min(1),
  email: z.string().email(),
  paidCents: z.number().int().positive(),
  currency: z.string().length(3).transform((value) => value.toUpperCase()),
});

export type CheckoutJob = z.infer<typeof checkoutSchema>;

export type CustomerOrderUpdate = {
  orderId: string;
  customerId: string;
  status: "fulfilled";
  courseAccess: { courseId: string; granted: true };
  receipt: {
    recipient: string;
    totalCents: number;
    currency: string;
  };
};

export function fulfillCourseOrder(job: CheckoutJob): CustomerOrderUpdate {
  return {
    orderId: job.orderId,
    customerId: job.customerId,
    status: "fulfilled",
    courseAccess: { courseId: job.courseId, granted: true },
    receipt: {
      recipient: job.email,
      totalCents: job.paidCents,
      currency: job.currency,
    },
  };
}
