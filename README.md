<!-- TODO -->

# Agent Data Shuttle (ADS) - NodeJS TypeScript SDK

#### Agent Data Shuttle (ADS) — _The framework that makes your AI agents autonomously react to external events._

> **ADS NodeJS SDK** enables you to build ADS Publishers and Subscribers in Node.js/TypeScript, allowing your AI agents to react to external events in real time. It is interoperable with other ADS SDKs (Python, n8n) and supports all publisher-subscriber combinations.

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

## Usage

### 1. ADS Publisher

Publish events to ADS subscribers.  
See [`examples/nodejs/sample_publisher/index.ts`](examples/nodejs/sample_publisher/index.ts) for a working example. <!-- TODO: Add link to examples repo -->

```typescript
import { types, publisher } from "@agentdatashuttle/adsjs";

(() => {
  return new Promise(async (resolve, reject) => {
    const clientParams: types.ADSRabbitMQClientParams = {
      host: process.env.ADS_HOST || "localhost",
      username: process.env.ADS_USERNAME || "ads_user",
      password: process.env.ADS_PASSWORD || "ads_password",
      port: parseInt(process.env.ADS_PORT || "5672"),
    };

    const adsPublisher = new publisher.ADSPublisher(
      "UptimeKumaEvents",
      clientParams
    );

    const payload: types.ADSDataPayload = {
      event_name: "container_down",
      event_description: "the argocd service is down",
      event_data: {
        timestamp: "23-04-2004",
        memory_captured_last: "2042Mi",
      },
    };

    await new Promise((resolve) => setTimeout(resolve, 2000));
    await adsPublisher.publishEvent(payload);
    console.log("Event published successfully.");
    resolve(true);
  });
})();
```

**Tip:** Customize the event payload to match your use case, as shown in the sample publisher and make sure to add a detailed `event_description` and as much detail as required in the `event_data` object for the destination AI Agent to take remediation actions with greater confidence.

---

### 2. ADS Subscriber

Subscribe to events and invoke your AI agent.  
See [`examples/nodejs/sample_subscriber/src/index.ts`](examples/nodejs/sample_subscriber/src/index.ts) for a working example. <!-- TODO: Add link to examples repo -->

```typescript
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import seeK8sLogsTool from "./tools/see_k8s_logs_tool";
import {
  types,
  dataconnector,
  subscriber,
  notifications,
} from "@agentdatashuttle/adsjs";

import dotenv from "dotenv";
import { renderTextDescriptionAndArgs } from "./utils/render";
dotenv.config();

(async () => {
  // Define the tools for the agent to use
  const agentTools = [toolA, toolB, seeK8sLogsTool];
  const llm = new ChatGoogleGenerativeAI({ model: "gemini-2.0-flash" });

  // Initialize memory to persist state between graph runs
  const agent = createReactAgent({
    llm: llm,
    tools: agentTools,
  });

  // Define a callback function to be triggered when ADS events are received
  const invoke_agent = async (
    prompt: string,
    payload: types.ADSDataPayload
  ) => {
    console.log("The payload was:", payload);

    if (payload.event_name === "container_up") {
      return "NO INVOCATION FOR THIS EVENT - CONTAINER UP";
    }

    const response = await agent.invoke({
      messages: [new HumanMessage(prompt)],
    });
    return response.messages[response.messages.length - 1].content as string;
  };

  //   # ---- ADS Subscriber ----
  // # Step 1: Create an ADSDataConnector with an ADSClientParams for each data source that should trigger the agent.
  // # Example: ADSDataConnector for Uptime Kuma events
  // # Note: ADSDataConnectors always connect with respective ADSBridges
  const adsBridgeClientParams: types.ADSBridgeClientParams = {
    connection_string: "http://localhost:9999",
    path_prefix: "/ads_bridge",
  };

  const dataConnectorOne = new dataconnector.ADSDataConnector(
    "UptimeKumaConnector",
    adsBridgeClientParams
  );

  // # Step 2: Create an ADSSubscriber with the agent executor, llm, and data connectors and redisParams for job processing
  // # The ADSSubscriber will listen for events from the data connectors, queue them up and invoke the agent executor.

  const redisParams: types.RedisParams = { host: "localhost", port: 6379 };
  const agentDescription = renderTextDescriptionAndArgs(agentTools);

  // # Step 3: Create NotificationChannels if needed
  const emailChannel = new notifications.EmailNotificationChannel(
    agentDescription,
    "<your_smtp_host>",
    465,
    "<from_address>",
    process.env.EMAIL_SMTP_PASSWORD || "",
    "<from_address>",
    "<to_address>"
  );

  const slackChannel = new notifications.SlackNotificationChannel(
    agentDescription,
    process.env.SLACK_BOT_TOKEN || "",
    "#ads-notifications"
  );

  // # Step 4: Create the ADSSubscriber instance with the agent executor, llm, agent description, data connectors, redisParams, and notification channels.
  const adsSubscriber = new subscriber.ADSSubscriber(
    null,
    invoke_agent,
    llm,
    agentDescription,
    [dataConnectorOne, dataConnectorTwo],
    redisParams,
    [emailChannel, slackChannel]
  );

  // # Step 5: Start the ADSSubscriber to listen for events and invoke the agent executor.
  await adsSubscriber.start();
})();
```

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

<!-- TODO -->

## Example Projects

- **Sample Publisher:**  
  [`examples/nodejs/sample_publisher/`](examples/nodejs/sample_publisher/) — Minimal ADS event publisher.

- **Sample Subscriber:**  
  [`examples/nodejs/sample_subscriber/`](examples/nodejs/sample_subscriber/) — ADS Subscriber with modular tools (e.g., Kubernetes resource listing, log viewing).  
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
