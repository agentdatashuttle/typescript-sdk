# Agent Data Shuttle (ADS) - NodeJS TypeScript SDK

#### Agent Data Shuttle (ADS) — _The framework that makes your AI agents autonomously react to external events._

> **ADS Node.js SDK** enables you to build ADS Publishers and Subscribers in Node.js/TypeScript, allowing your AI agents to react to external events in real time.

> It is interoperable with other ADS SDKs (Python, n8n) and supports all publisher-subscriber combinations.

---

## Installation

```sh
npm install @agentdatashuttle/adsjs
```

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Usage](#usage)
  - [ADS Publisher](#1-ads-publisher)
  - [ADS Subscriber](#2-ads-subscriber)
- [Notification Channels](#notification-channels)
- [Types](#types)
- [Logging](#logging)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

---

## Overview

Agent Data Shuttle (ADS) is a framework for connecting event sources (publishers) and AI agents (subscribers) across platforms and languages.

This SDK lets you build Node.js/TypeScript publishers and subscribers that can interoperate with Python SDKs and Publishers/Subscribers built with n8n.

- **Publishers** send events (e.g., file uploads, system alerts, support tickets raised, CRM events, payment processor events, etc...).
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
- **n8n Integration:** Out-of-the-box support for n8n workflows as subscribers or publishers.
- **Notification Channels:** Send notifications via Email or Slack when agents process events.
  > More channels coming soon.
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

> ![Before and After ADS](https://agentdatashuttle.knowyours.co/before-after-illustration.png)
>
> ![Architecture Diagram](https://agentdatashuttle.knowyours.co/architecture-diagram.png)

---

## Prerequisites

### Prerequisites for ADS Publisher

- **Node.js** (v16+ recommended)

- **RabbitMQ** instance

  > For event queueing and secure event publishing

- **ADS Bridge**

  > For real-time event delivery via Socket.io
  >
  > You must run the ADS Bridge service which would be the point of connection for subscribers.
  >
  > More info at: [https://github.com/agentdatashuttle/ads-bridge](https://github.com/agentdatashuttle/ads-bridge)

- **Redis**

  > For handling ADS event delivery to a large number of ADS Subscribers from ADS Bridge

### Prerequisites for ADS Subscriber

- **Node.js** (v16+ recommended)

- **Email/Slack credentials** (Optional)

  > For using notification channels upon each autonomous agent invocation

- **Redis**

  > For queuing ADS events and prevent overwhelmed agent invocations

- **AI Agent or LLM** (for integrating with an AI model and trigger agentic workflows)

---

## Usage

### 1. ADS Publisher

Publish events to ADS subscribers.

```typescript
import { types, publisher } from "@agentdatashuttle/adsjs";

(() => {
  return new Promise(async (resolve, reject) => {
    // Step 1: Create ADSRabbitMQClientParams
    const clientParams: types.ADSRabbitMQClientParams = {
      host: process.env.RABBITMQ_HOST || "localhost",
      username: process.env.RABBITMQ_USERNAME || "ads_user",
      password: process.env.RABBITMQ_PASSWORD || "ads_password",
      port: parseInt(process.env.RABBITMQ_PORT || "5672"),
    };

    // Step 2: Create a ADSPublisher instance
    // Example: ADSPublisher for Kubernetes Health monitoring system
    const adsPublisher = new publisher.ADSPublisher(
      "KubernetesMonitoring",
      clientParams
    );

    // Step 3: Create a sample ADSDataPayload
    const payload: types.ADSDataPayload = {
      event_name: "pod_killed",
      event_description:
        "Pod 'payment-service-233ch3' just got killed due to OOMKilled error",
      event_data: {
        pod: "payment-service-233ch3",
        recorded_memory_usage: "2042Mi",
        limits: "2000Mi",
      },
    };

    // Simulate some delay before publishing
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Publish the payload
    await adsPublisher.publishEvent(payload);

    console.log("Event published successfully.");
    resolve(true);
  });
})();
```

**Tip:** Customize the event payload to match your use case, as shown in the sample publisher and make sure to add a detailed `event_description` and as much detail as required in the `event_data` object for the destination AI Agent to take remediation actions with greater confidence and accuracy.

---

### 2. ADS Subscriber

Subscribe to events and invoke your AI agent.

```typescript
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import seeK8sLogsTool from "./tools/see_k8s_logs_tool";
import dotenv from "dotenv";
import { renderTextDescriptionAndArgs } from "./utils/render";

// Import ADS Subscriber and add ADS Data Connectors
import {
  types,
  dataconnector,
  subscriber,
  notifications,
} from "@agentdatashuttle/adsjs";

dotenv.config();

(async () => {
  // Define the tools for the agent to use
  const agentTools = [toolA, toolB, seeK8sLogsTool];
  const llm = new ChatGoogleGenerativeAI({ model: "gemini-2.0-flash" });

  const agent = createReactAgent({
    llm: llm,
    tools: agentTools,
  });

  // Step 1: Define callback function for ADS Subscriber to invoke agent
  const invoke_agent = async (
    prompt: string,
    payload: types.ADSDataPayload
  ) => {
    console.log("The payload was:", payload);

    // Filter specific events in/out as you desire
    if (payload.event_name === "container_up") {
      return "NO INVOCATION FOR THIS EVENT - CONTAINER UP";
    }

    // Invoke your agent with the context enriched prompt generated by Agent Data Shuttle
    const response = await agent.invoke({
      messages: [new HumanMessage(prompt)],
    });

    // Return final agent response - will be sent to all notification channels for later review
    return response.messages[response.messages.length - 1].content as string;
  };

  // Step 2: Define ADSBridgeClientParams and corresponding ADSDataConnector
  const adsBridgeClientParams: types.ADSBridgeClientParams = {
    connection_string: "http://localhost:9999",
    path_prefix: "/ads_bridge",
    ads_subscribers_pool_id = "<a_random_uuid>", // Replace with your actual pool ID to group horizontally scaled replicas of ADS Subscribers - use https://agentdatashuttle.knowyours.co/pool-id-generator to make one if needed
  };

  const dataConnectorOne = new dataconnector.ADSDataConnector(
    "K8sMonitoringConnector",
    adsBridgeClientParams
  );

  const redisParams: types.RedisParams = { host: "localhost", port: 6379 };

  const agentDescription = renderTextDescriptionAndArgs(agentTools);

  // Step 3: Optionally, add notification channels
  const emailChannel = new notifications.EmailNotificationChannel(
    agentDescription,
    "<smtp_host>",
    "<smtp_port>",
    "<smtp_username>",
    "<smtp_password>",
    "<from_address>",
    "<to_address>"
  );

  const slackChannel = new notifications.SlackNotificationChannel(
    agentDescription,
    process.env.SLACK_BOT_TOKEN || "",
    "#ads-notifications"
  );

  // Step 4: Create the ADSSubscriber with the callback function, LLM, and Data Connectors.
  // The ADSSubscriber will listen for events from all the data connectors and invoke the agent.
  const adsSubscriber = new subscriber.ADSSubscriber(
    null,
    invoke_agent,
    llm,
    agentDescription,
    [dataConnectorOne],
    redisParams,
    [emailChannel, slackChannel]
  );

  // Step 5: Start the ADSSubscriber to listen for events and invoke the agent.
  await adsSubscriber.start();
})();
```

---

## Notification Channels

Send notifications via Email or Slack when events are processed:

```typescript
import { notifications } from "@agentdatashuttle/adsjs";

const emailChannel = new notifications.EmailNotificationChannel(
  "<agent_description>",
  "<smtp_host>",
  "<smtp_port>",
  "<smtp_username>",
  "<smtp_password>",
  "from@example.com",
  "to@example.com"
);

const slackChannel = new notifications.SlackNotificationChannel(
  "<agent_description>",
  "<slack_bot_token>",
  "#<your-channel>"
);
```

Pass these channels to the `ADSSubscriber` to enable notifications.

---

## Types

All core types are defined in [`types/types.ts`](src/types/types.ts):

- [`ADSDataPayload`](src/types/types.ts)
- [`ADSRabbitMQClientParams`](src/types/types.ts)
- [`ADSBridgeClientParams`](src/types/types.ts)
- [`RedisParams`](src/types/types.ts)

---

## Logging

Logging level can be configured via the `LOG_LEVEL` environment variable with the following values

| Level | Description                                     |
| ----- | ----------------------------------------------- |
| error | Critical errors that may cause the app to crash |
| warn  | Warnings about potentially harmful situations   |
| info  | General operational information                 |
| debug | Debug-level logs for development                |
| silly | Extremely verbose logs, lowest priority         |

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
<br>[agentdatashuttle@knowyours.co](mailto:agentdatashuttle@knowyours.co)

For more information about Agent Data Shuttle - https://agentdatashuttle.knowyours.co
