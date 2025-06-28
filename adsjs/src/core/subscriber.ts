import { ADSDataPayload, RedisParams } from "../types/types";
import { createLogger } from "../utils/logger";
import { ADSDataConnector } from "./dataconnector";
import { getEventContextualizationPrompt } from "../utils/prompts";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import Bull, { Queue, Job, DoneCallback } from "bull";
import { ADSNotificationEngine } from "./notifications";

const LOGGER = createLogger("ADSSubscriber");

export class ADSSubscriber {
  private bullJobQueue: Queue;
  private redisParams: RedisParams;
  private dataConnectors: ADSDataConnector[];
  private agentCallbackFunctionSync:
    | ((agentPrompt: string, ads_payload: ADSDataPayload) => string)
    | null;
  private agentCallbackFunctionAsync:
    | ((agentPrompt: string, ads_payload: ADSDataPayload) => Promise<string>)
    | null;
  private llm: BaseChatModel;
  agentDescription: string;
  private notificationChannels: ADSNotificationEngine[];

  constructor(
    agentCallbackFunctionSync:
      | ((agentPrompt: string, ads_payload: ADSDataPayload) => string)
      | null,
    agentCallbackFunctionAsync:
      | ((agentPrompt: string, ads_payload: ADSDataPayload) => Promise<string>)
      | null,
    llm: BaseChatModel,
    agentDescription: string,
    dataConnectors: ADSDataConnector[],
    redisParams: RedisParams,
    notificationChannels: ADSNotificationEngine[] = []
  ) {
    if (agentCallbackFunctionAsync && agentCallbackFunctionSync) {
      throw new Error(
        `Both 'agentCallbackFunctionAsync' and 'agentCallbackFunctionSync' should NOT be set. One of them should be 'null'`
      );
    } else if (agentCallbackFunctionAsync) {
      if (!this.isCallable(agentCallbackFunctionAsync)) {
        throw new Error(
          `'agentCallbackFunctionAsync' must be an async callable that takes in "agent_invocation_prompt" and returns "agent_response".`
        );
      }
    } else if (agentCallbackFunctionSync) {
      if (!this.isCallable(agentCallbackFunctionSync)) {
        throw new Error(
          `'agentCallbackFunctionSync' must be a callable that takes in "agent_invocation_prompt" and returns "agent_response".`
        );
      }
    }

    this.dataConnectors = dataConnectors;
    this.agentCallbackFunctionAsync = agentCallbackFunctionAsync;
    this.agentCallbackFunctionSync = agentCallbackFunctionSync;
    this.agentDescription = agentDescription;
    this.llm = llm;
    this.redisParams = redisParams;
    this.notificationChannels = notificationChannels;

    // Setup ADS Event job processing queue
    this.bullJobQueue = Bull("ads_subscriber_job_processing_queue", {
      redis: { host: redisParams.host, port: redisParams.port },
    });

    // Setup event on SIGINT to stop subscriber
    process.on("SIGINT", async (s) => {
      await this.stop();
      process.exit(0);
    });
  }

  private isCallable = (func: any) => {
    return typeof func === "function";
  };

  private generateAgentInvocationPrompt = async (
    adsEventPayload: ADSDataPayload
  ) => {
    try {
      if (!this.agentDescription) {
        throw new Error("Agent description is not set.");
      }

      const prompt = getEventContextualizationPrompt(
        this.agentDescription,
        adsEventPayload
      );

      const response = await this.llm
        .withRetry({ stopAfterAttempt: 5 })
        .invoke(prompt);

      return (response.content as string).trim();
    } catch (error) {
      LOGGER.error("Error generating agent invocation prompt:", error);
      return null;
    }
  };

  private socketEventCallback = async (msg: any) => {
    if (!msg) return;

    try {
      const messagePayload: ADSDataPayload = JSON.parse(msg.toString());
      LOGGER.debug(
        `Received ADS Publish Event: ${JSON.stringify(messagePayload)}`
      );

      // Push to Bull Job queue
      const job = await this.bullJobQueue.add(
        { messagePayload },
        { attempts: 1 }
      );

      LOGGER.debug(
        `Pushed ADS Publish event payload to Bull job queue - JobID: ${job.id}`
      );
    } catch (error) {
      LOGGER.error("Error processing message from ADS Bridge:", error);
    }
  };

  private processAdsEventJobCallback = async (job: Job, done: DoneCallback) => {
    try {
      const { messagePayload } = job.data;

      // Generate the agent invocation prompt based on the received message
      const agentInvocationPrompt = await this.generateAgentInvocationPrompt(
        messagePayload
      );

      if (!agentInvocationPrompt) {
        LOGGER.error("Failed to generate agent invocation prompt.");
        done(new Error("Failed to generate agent invocation prompt."));
        return;
      }

      // Use the generated prompt to invoke the agent
      LOGGER.debug("Invoking agent with the ADS event payload...");

      let agentResponse;
      if (this.agentCallbackFunctionSync) {
        agentResponse = this.agentCallbackFunctionSync(
          agentInvocationPrompt,
          messagePayload
        );
      } else if (this.agentCallbackFunctionAsync) {
        agentResponse = await this.agentCallbackFunctionAsync(
          agentInvocationPrompt,
          messagePayload
        );
      } else {
        throw new Error(
          "No agent callback function provided. Either 'agentCallbackFunctionSync' or 'agentCallbackFunctionAsync' must be set."
        );
      }

      LOGGER.info(`Agent response: ${agentResponse}`);

      // Notify all registered notification channels
      for (const notificationChannel of this.notificationChannels) {
        try {
          const result = await notificationChannel.fireNotification(
            agentResponse
          );
          if (!result) {
            LOGGER.warn(
              `Failed to send notification to channel: ${notificationChannel.channel_name}`
            );
          } else {
            LOGGER.info(
              `Notification sent successfully to channel: ${notificationChannel.channel_name}`
            );
          }
        } catch (error) {
          LOGGER.error(
            `Error notifying channel '${notificationChannel.channel_name}':`,
            error
          );
        }
      }

      done();
    } catch (error: any) {
      LOGGER.error("Error processing message from Bull queue:", error);
      done(new Error(error.toString()));
    }
  };

  start = async () => {
    if (this.dataConnectors.length === 0) {
      throw new Error("No ADS data connectors provided.");
    }

    // Register Bull job processing callback function with concurrency of 1
    this.bullJobQueue.process(1, this.processAdsEventJobCallback);

    try {
      for (const connector of this.dataConnectors) {
        await connector.adsBridgeClient.connect();
        await connector.setupCallback(this.socketEventCallback);
      }
    } catch (error) {
      LOGGER.error(
        "Unable to register all ADS Data Connectors to subscriber",
        error
      );
      await this.stop();
    }

    LOGGER.debug("All data connectors connected and callbacks set up.");
    LOGGER.info("ADS Subscriber started and listening for messages...");
  };

  stop = async () => {
    LOGGER.info("Received SIGINT - Closing ADS connections...");
    for (const connector of this.dataConnectors) {
      await connector.adsBridgeClient.disconnect();
    }
    LOGGER.info("ADS Subscriber stopped.");
  };
}
