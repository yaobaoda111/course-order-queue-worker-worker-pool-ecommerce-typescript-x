import assert from "node:assert/strict";
import test from "node:test";
import { checkoutSchema, fulfillCourseOrder } from "../src/course_order_worker";

test("a paid course checkout grants access and prepares the matching receipt", () => {
  const checkout = checkoutSchema.parse({
    orderId: "order-lesson-42",
    customerId: "learner-7",
    courseId: "typescript-foundations",
    email: "learner@example.com",
    paidCents: 4900,
    currency: "usd",
  });

  assert.deepEqual(fulfillCourseOrder(checkout), {
    orderId: "order-lesson-42",
    customerId: "learner-7",
    status: "fulfilled",
    courseAccess: { courseId: "typescript-foundations", granted: true },
    receipt: {
      recipient: "learner@example.com",
      totalCents: 4900,
      currency: "USD",
    },
  });
});
