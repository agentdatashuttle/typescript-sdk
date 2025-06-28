# Agent Data Shuttle (ADS) - NodeJS TypeScript SDK

#### Agent Data Shuttle (ADS) — _The framework that makes your AI agents autonomously react to external events._

> **ADS NodeJS SDK** enables you to build ADS Publishers and Subscribers in Node.js/TypeScript, allowing your AI agents to react to external events in real time. It is interoperable with other ADS SDKs (Python, n8n) and supports all publisher-subscriber combinations.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Usage](#usage)
  - [ADS Publisher](#1-ads-publisher)
  - [ADS Subscriber](#2-ads-subscriber)
  - [n8n Integration](#3-n8n-integration)
- [Notification Channels](#notification-channels)
- [Types](#types)
- [Logging](#logging)
- [Example Projects](#example-projects)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

---

## Overview

Agent Data Shuttle (ADS) is a framework for connecting event sources (publishers) and AI agents (subscribers) across platforms and languages. This SDK lets you build Node.js/TypeScript publishers and subscribers that can interoperate with Python SDKs and Publishers/Subscribers built with n8n.

- **Publishers** send events (e.g., file uploads, system alerts, support tickets raised, CRM events, etc...).
- **Subscribers** (AI agents or workflows) receive and react to those events to take appropriate measures like humans would.

All combinations are possible:

- NodeJS Publisher → NodeJS Subscriber
- NodeJS Publisher → n8n Subscriber
- NodeJS Publisher → Python Subscriber
- Python Publisher → NodeJS Subscriber
- Python Publisher → n8n Subscriber
- Python Publisher → Python Subscriber
- n8n Publisher → NodeJS Subscriber
- n8n Publisher → n8n Subscriber
- n8n Publisher → Python Subscriber

---

## Features

- **Event-Driven Architecture:** Seamlessly publish and subscribe to events between systems and agents.
- **Publisher & Subscriber SDKs:** Build both event sources (publishers) and event consumers (subscribers) in Node.js.
- **n8n Integration:** Out-of-the-box support for n8n workflows as subscribers.
- **Notification Channels:** Send notifications via Email or Slack when agents process events. (more channels will soon be supported)
- **Pluggable Connectors:** Easily connect an ADS Subscriber to multiple ADS Publishers hosted at different places via data connectors.
- **Prompt Generation:** Automatically generate contextual prompts for AI agents based on event payloads and agent capabilities.
- **TypeScript Support:** Strong typing for safer and more maintainable code.

---

## Architecture

- **ADS Publisher:** Sends events to subscribers via ADS Bridge.
- **ADS Bridge:** (see [ADS Bridge repository](https://github.com/agentdatashuttle/ads-bridge)) Broadcasts events to connected subscribers.
- **ADS Subscriber:** Receives ADS events and invokes AI agents or workflows.
- **Notification Channels:** Email/Slack notifications on event processing.
- **Interoperability:** Mix NodeJS, Python, and n8n publishers/subscribers.

![Architecture Diagram](https://raw.githubusercontent.com/your-org/your-repo/main/docs/architecture.png) <!-- TODO: Replace with your actual diagram if available -->

---

## Prerequisites

### Prerequisites for ADS Publisher

- **Node.js** (v16+ recommended)
- **RabbitMQ** instance (for event queueing and secure event publishing)
- **ADS Bridge** (for real-time event delivery via Socket.io).  
  You must run the ADS Bridge service which would be the point of connection for subscribers.
  More info at: [https://github.com/agentdatashuttle/ads-bridge](https://github.com/agentdatashuttle/ads-bridge)
- **Redis** (for handling ADS event delivery to a large number of ADS Subscribers from ADS Bridge)

### Prerequisites for ADS Subscriber

- **Node.js** (v16+ recommended)
- **Email/Slack credentials** (if using notification channels)
- **Redis** (for queuing ADS events and prevent overwhelmed agent invocations)
- **AI Agent or LLM** (for integrating with an AI model and trigger agentic workflows)

---

<!-- TODO -->

## Installation

```sh
npm install ads_js
```

Or clone this repository and build locally:

```sh
git clone <this-repo-url>
cd ads_js
npm install
npm run build
```

---

<!-- TODO -->

## Usage

### 1. ADS Publisher

Publish events to the ADS system.  
See [`examples/nodejs/sample_publisher/index.ts`](examples/nodejs/sample_publisher/index.ts) for a working example.

```typescript
import { publisher, types } from "ads_js";

const publisherParams: types.ADSRabbitMQClientParams = {
  host: "localhost",
  port: 5672,
  username: "guest",
  password: "guest",
};

const adsPublisher = new publisher.ADSPublisher("MyPublisher", publisherParams);

const eventPayload: types.ADSDataPayload = {
  event_name: "new_file_uploaded",
  event_description: "A new file was uploaded.",
  event_data: { file_name: "report.pdf", uploaded_by: "user_1" },
};

await adsPublisher.publishEvent(eventPayload);
```

**Tip:** Customize the event payload to match your use case, as shown in the sample publisher.

---

### 2. ADS Subscriber

Subscribe to events and invoke your AI agent.  
See [`examples/nodejs/sample_subscriber/src/index.ts`](examples/nodejs/sample_subscriber/src/index.ts) for a working example.

```typescript
import { subscriber, dataconnector, types } from "ads_js";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";

// Define your agent callback (sync or async)
const agentCallback = (prompt: string, payload: types.ADSDataPayload) => {
  // Call your AI agent here
  return "Agent processed event: " + prompt;
};

const bridgeParams: types.ADSBridgeClientParams = {
  connection_string: "http://localhost:3000",
  path_prefix: "/ads_bridge",
};

const dataConnector = new dataconnector.ADSDataConnector(
  "MyConnector",
  bridgeParams
);

const redisParams: types.RedisParams = { host: "localhost", port: 6379 };

// Dummy LLM instance (replace with your own)
const llm = {} as BaseChatModel;

const adsSubscriber = new subscriber.ADSSubscriber(
  agentCallback, // or null if using async
  null, // or your async callback
  llm,
  "This agent processes uploaded files.",
  [dataConnector],
  redisParams
);

await adsSubscriber.start();
```

**Tip:**

- Use `.env` files for configuration, as shown in [`sample_subscriber/.env.example`](examples/nodejs/sample_subscriber/.env.example).
- Extend your subscriber with custom tools, as in [`sample_subscriber/src/tools/`](examples/nodejs/sample_subscriber/src/tools/), to interact with external systems (e.g., Kubernetes clusters).

---

<!-- TODO Decide Removal -->

### 3. n8n Integration

Use the [`n8n.subscriber.ADSSubscribern8n`](src/n8n/subscriber.ts) class to integrate with n8n workflows.

---

## Notification Channels

Send notifications via Email or Slack when events are processed:

```typescript
import { notifications } from "ads_js";

const emailChannel = new notifications.EmailNotificationChannel(
  "Agent description",
  "smtp.example.com",
  587,
  "smtp_user",
  "smtp_pass",
  "from@example.com",
  "to@example.com"
);

const slackChannel = new notifications.SlackNotificationChannel(
  "Agent description",
  "xoxb-your-slack-bot-token",
  "#your-channel"
);
```

Pass these channels to the `ADSSubscriber` to enable notifications.

---

<!-- TODO -->

## Types

All core types are defined in [`types/types.ts`](src/types/types.ts):

- [`ADSDataPayload`](src/types/types.ts)
- [`ADSRabbitMQClientParams`](src/types/types.ts)
- [`ADSBridgeClientParams`](src/types/types.ts)
- [`RedisParams`](src/types/types.ts)

---

<!-- TODO add Env vars possible for LOG_LEVEL -->

## Logging

Logging is handled via Winston. You can create custom loggers using:

- [`createLogger`](src/utils/logger.ts)

---

<!-- TODO -->

## Example Projects

- **Sample Publisher:**  
  [`examples/nodejs/sample_publisher/`](examples/nodejs/sample_publisher/) — Minimal event publisher.

- **Sample Subscriber:**  
  [`examples/nodejs/sample_subscriber/`](examples/nodejs/sample_subscriber/) — Subscriber with modular tools (e.g., Kubernetes resource listing, log viewing).  
  Uses `.env` files for configuration and demonstrates tool integration in [`src/tools/`](examples/nodejs/sample_subscriber/src/tools/).

---

## Contributing

Contributions are welcome!

If you have ideas for improvements, bug fixes, or new features, please open a [GitHub Issue](https://github.com/agentdatashuttle/typescript-sdk/issues) to discuss or submit a Pull Request (PR).

**How to contribute:**

1. Fork this repository and create your branch from `main`.
2. Make your changes with clear commit messages.
3. Ensure your code passes tests.
4. Open a Pull Request describing your changes.

If you encounter any bugs or have feature requests, please [raise an issue](https://github.com/agentdatashuttle/typescript-sdk/issues) on GitHub.

Thank you for helping improve the Agent Data Shuttle initiative!

---

## License

This project is licensed under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0).

---

## Contact

For questions or support, please contact
<br>[agentdatashuttle@knowyours.co](mailto:agentdatashuttle@knowyours.co) or [sudhay2001@gmail.com](mailto:sudhay2001@gmail.com)

For more information about Agent Data Shuttle - https://agentdatashuttle.knowyours.co
