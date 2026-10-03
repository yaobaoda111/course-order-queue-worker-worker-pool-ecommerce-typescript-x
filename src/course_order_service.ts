import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { ZodError, z } from "zod";
import { infrai, InfraiError } from "./infrai_queue";
import {
  checkoutSchema,
  fulfillCourseOrder,
  type CheckoutJob,
  type CustomerOrderUpdate,
} from "./course_order_worker";

const workerRunSchema = z.object({
  maxMessages: z.number().int().min(1).max(20).default(4),
  visibilityTimeout: z.number().int().min(10).max(3_600).default(60),
  concurrency: z.number().int().min(1).max(8).default(2),
  startsPerSecond: z.number().int().min(1).max(10).default(2),
});

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body, null, 2));
}

async function publishCheckout(request: IncomingMessage, response: ServerResponse) {
  const checkout = checkoutSchema.parse(await readJson(request));
  await infrai.queue.publish(checkout, `checkout-${checkout.orderId}`);
  json(response, 202, { orderId: checkout.orderId, status: "queued" });
}

async function runWorker(request: IncomingMessage, response: ServerResponse) {
  const settings = workerRunSchema.parse(await readJson(request));
  const batch = await infrai.queue.consume<CheckoutJob>(
    settings.maxMessages,
    settings.visibilityTimeout,
  );
  const messages = batch.messages ?? [];
  const updates: CustomerOrderUpdate[] = new Array(messages.length);
  const interval = 1_000 / settings.startsPerSecond;
  let nextIndex = 0;

  async function work(): Promise<void> {
    while (nextIndex < messages.length) {
      const index = nextIndex;
      nextIndex += 1;
      if (index > 0) await new Promise((resolve) => setTimeout(resolve, index * interval));
      const message = messages[index];
      const checked = checkoutSchema.parse(message.payload);
      const update = fulfillCourseOrder(checked);
      await saveCustomerOrder(update);
      await infrai.queue.ack(message.message_id);
      updates[index] = update;
    }
  }

  const workerCount = Math.min(settings.concurrency, messages.length);
  await Promise.all(Array.from({ length: workerCount }, () => work()));
  json(response, 200, { processed: updates.length, updates });
}

async function saveCustomerOrder(update: CustomerOrderUpdate): Promise<void> {
  // Replace this observable teaching-store boundary with the application's database write.
  console.log(JSON.stringify({ event: "customer_order_updated", ...update }));
}

function clientStatus(error: unknown): number {
  if (error instanceof ZodError) return 400;
  if (error instanceof SyntaxError) return 400;
  if (error instanceof InfraiError && error.status >= 400 && error.status < 500) {
    return error.status;
  }
  return 500;
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === "POST" && request.url === "/checkouts") {
      await publishCheckout(request, response);
      return;
    }
    if (request.method === "POST" && request.url === "/worker/run") {
      await runWorker(request, response);
      return;
    }
    json(response, 404, { error: "Route not found" });
  } catch (error) {
    json(response, clientStatus(error), {
      error: error instanceof Error ? error.message : "Request failed",
    });
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Course order worker listening on http://localhost:${port}`));
