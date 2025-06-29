import { ADSRabbitMQClient } from "./client";
import { ADSRabbitMQClientParams, ADSDataPayload } from "../types/types";
import { createLogger } from "../utils/logger";

const LOGGER = createLogger("ADSPublisher");

export class ADSPublisher {
  private rabbitMqClientParams: ADSRabbitMQClientParams;
  private publisherName: string;
  private adsRabbitMQClient: ADSRabbitMQClient;

  constructor(
    publisherName: string,
    rabbitMqClientParams: ADSRabbitMQClientParams
  ) {
    this.publisherName = publisherName;
    this.rabbitMqClientParams = rabbitMqClientParams;
    this.adsRabbitMQClient = new ADSRabbitMQClient(rabbitMqClientParams);
  }

  publishEvent = async (eventPayload: ADSDataPayload) => {
    await this.adsRabbitMQClient.connect();

    if (!this.adsRabbitMQClient.isConnected()) {
      throw new Error(
        "ADSRabbitMQClient is not connected to the RabbitMQ broker."
      );
    }

    try {
      const channel = await this.adsRabbitMQClient.getChannel();
      const message = JSON.stringify(eventPayload);

      await channel.sendToQueue(
        ADSRabbitMQClient.ADS_WORKER_QUEUE_NAME,
        Buffer.from(message),
        { persistent: true }
      );
      LOGGER.debug(`ADS Event Published: ${JSON.stringify(eventPayload)}`);
      await channel.close();
    } catch (error) {
      LOGGER.error("Error publishing ADS event:", error);
      throw error;
    } finally {
      await this.adsRabbitMQClient.disconnect();
    }
  };
}
