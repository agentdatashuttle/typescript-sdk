import { ADSDataPayload, RedisParams } from "../types/types";
import { createLogger } from "../utils/logger";
import { ADSDataConnector } from "../core/dataconnector";
import { getEventContextualizationPrompt } from "../utils/prompts";
import { ITriggerFunctions } from "n8n-workflow";
import Bull, { DoneCallback, Job, Queue } from "bull";

const LOGGER = createLogger("ADSSubscriberN8N");

export class ADSSubscriberN8N {
  private bullJobQueue: Queue;
  private redisParams: RedisParams;
  private dataConnectors: ADSDataConnector[];
  private agentDescription: string;
  private n8nTriggerCtx: ITriggerFunctions;

  constructor(
    agentDescription: string,
    dataConnectors: ADSDataConnector[],
    n8nTriggerCtx: ITriggerFunctions,
    redisParams: RedisParams
  ) {
    this.dataConnectors = dataConnectors;
    this.agentDescription = agentDescription;
    this.n8nTriggerCtx = n8nTriggerCtx;
    this.redisParams = redisParams;

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

      // Emit the ADS event data payload from trigger() to the execute() function
      this.n8nTriggerCtx.emit([
        this.n8nTriggerCtx.helpers.returnJsonArray({
          ads_event_contextualization_prompt: getEventContextualizationPrompt(
            this.agentDescription,
            messagePayload
          ),
          ads_event_payload: { ...messagePayload },
        }),
      ]);
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
