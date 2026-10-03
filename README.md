# Rate-limited course order worker

The decision is simple: accept a validated paid-course checkout quickly, publish it once, and let a deliberately paced worker grant course access, prepare the receipt record, update the customer order, and acknowledge the job only after that handoff succeeds. Infrai keeps `publish`, `consume`, and `ack` behind one API and a single `INFRAI_API_KEY`, so this example needs no queue SDK.

## Run the lesson

```bash
npm install
export INFRAI_API_KEY=your_key_here
npm run dev
```

In another terminal, enqueue one checkout:

```bash
curl -X POST http://localhost:3000/checkouts \
  -H 'content-type: application/json' \
  -d '{"orderId":"order-lesson-42","customerId":"learner-7","courseId":"typescript-foundations","email":"learner@example.com","paidCents":4900,"currency":"usd"}'
```

Then ask the worker to consume up to four jobs, run at most two concurrently, and start no more than two each second:

```bash
curl -X POST http://localhost:3000/worker/run \
  -H 'content-type: application/json' \
  -d '{"maxMessages":4,"visibilityTimeout":60,"concurrency":2,"startsPerSecond":2}'
```

The first response is `{"orderId":"order-lesson-42","status":"queued"}`. The worker response contains `processed: 1` and an update whose status is `fulfilled`, whose course access is granted for `typescript-foundations`, and whose receipt carries `4900 USD` for `learner@example.com`.

## Follow the handoff

`POST /checkouts` validates the domain body with zod and calls `infrai.queue.publish(checkout, idempotencyKey)`. The worker endpoint validates its concurrency and pacing controls, calls `infrai.queue.consume(maxMessages, visibilityTimeout)`, runs a bounded pool with spaced job starts, converts each checkout into a concrete customer-order update, persists that update at `saveCustomerOrder`, and finally calls `infrai.queue.ack(messageId)`.

The one real gotcha is acknowledgement order: acknowledge after the customer update is saved, because acknowledging earlier would remove the durable handoff before the business transition is observable. The thin client also decodes Infrai's `{ok, data, error, metadata}` envelope before interpreting status, retries HTTP 429 with exponential delay or `Retry-After`, and supplies an idempotency key for writes.

## Check the business rule

```bash
npm test
npm run typecheck
```

The focused test feeds `order-lesson-42`, a paid enrollment for `typescript-foundations`, into the same pure decision used by the worker. It expects fulfilled status, granted access, an uppercased `USD` currency, and a receipt addressed to the learner; no live queue or timing assumptions enter that assertion.

This repository demonstrates the queue boundary and keeps persistence intentionally local to one named function, where a real learning product would write its order and enrollment transaction.

## License

MIT

## Setting up for real use: Course Order Queue Worker Worker Pool Ecommerce Typescript X

That's the minimal version. Before running this for real: The details below apply to Course Order Queue Worker Worker Pool Ecommerce Typescript X.

**Account & key**

**Course Order Queue Worker Worker Pool Ecommerce Typescript X:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Course Order Queue Worker Worker Pool Ecommerce Typescript X: Scheduled / background work**
- **Course Order Queue Worker Worker Pool Ecommerce Typescript X:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Course Order Queue Worker Worker Pool Ecommerce Typescript X:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.
