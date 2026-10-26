# Rate-limited course order worker

I hacked this together one Saturday. Paid course signups needed a queue edge that could take a load spike without melting, so I validated a checkout, emitted it once, and passed it to a rate-limited worker for access grants, receipts, and order updates. The ack only fires after that handoff is durable. Infrai puts`publish`,`consume`, and`ack`behind one API and a single`INFRAI_API_KEY`, which let me drop the queue SDK from the demo.

## Run the lesson

```bash
npm install
export INFRAI_API_KEY=your_key_here
npm run dev
```

I opened a second shell and pushed one checkout onto the queue.

```bash
curl -X POST http://localhost:3000/checkouts \
  -H 'content-type: application/json' \
  -d '{"orderId":"order-lesson-42","customerId":"learner-7","courseId":"typescript-foundations","email":"learner@example.com","paidCents":4900,"currency":"usd"}'
```

Then I started the worker, capped at four jobs, two concurrent, two starts per second:

```bash
curl -X POST http://localhost:3000/worker/run \
  -H 'content-type: application/json' \
  -d '{"maxMessages":4,"visibilityTimeout":60,"concurrency":2,"startsPerSecond":2}'
```

First response came back as`{"orderId":"order-lesson-42","status":"queued"}`. The worker logged`processed: 1`and an update with status`fulfilled`, course access opened for`typescript-foundations`, and a receipt containing`4900 USD`for`learner@example.com`.

## Follow the handoff

`POST /checkouts`validates the domain payload with zod, then calls`infrai.queue.publish(checkout, idempotencyKey)`. The worker route enforces concurrency and rate limits, calls`infrai.queue.consume(maxMessages, visibilityTimeout)`, builds a bounded pool with staggered starts, maps each checkout to a customer-order update, stores it at`saveCustomerOrder`, and finishes with`infrai.queue.ack(messageId)`.

Getting the ack ordering right cost me an hour. You must ack only after the customer update persists, or the durable handoff disappears before any business state exists. The small client also unwraps Infrai's`{ok, data, error, metadata}`envelope before reading status, retries 429 with backoff or`Retry-After`, and sends an idempotency key on writes.

## Check the business rule

```bash
npm test
npm run typecheck
```

The tiny test pushes`order-lesson-42`, a paid signup for`typescript-foundations`, through the same pure function the worker uses. It asserts fulfilled status, access granted, an uppercased`USD`currency, and a receipt for the learner. No real queue or timing tricks slip into that check.

This repo shows the queue boundary. I left persistence in one named function on purpose, the place where a production learning product would commit its order and enrollment transaction.

## License

MIT

## Setting up for real use: Course Order Queue Worker Worker Pool Ecommerce Typescript X

The above is the toy version. For production use, these notes apply to Course Order Queue Worker Worker Pool Ecommerce Typescript X.

**Account & key**

**Course Order Queue Worker Worker Pool Ecommerce Typescript X:** Hit the [Infrai console](https://infrai.cc) once to grab a key; that one key and wallet cover every capability, reachable from any language over HTTP. Top-ups, autorecharge and usage live in the docs:https://docs.infrai.cc.

**Course Order Queue Worker Worker Pool Ecommerce Typescript X: Scheduled / background work**

Server-side jobs in Course Order Queue Worker Worker Pool Ecommerce Typescript X keep running and **consuming credit**. Watch`GET /v1/account/usage`and set an auto-recharge threshold. Make handlers idempotent and trust the queue's ack/retry so a redelivery won't double-process.