import * as amqp from "amqplib";
import { io, Socket } from "socket.io-client";
import { createLogger } from "../utils/logger";
import { ADSRabbitMQClientParams, ADSBridgeClientParams } from "../types/types";

const LOGGER = createLogger("ADSClient");

// ADSRabbitMQClient - Used by ADSPublisher to connect to RabbitMQ broker and publish events
export class ADSRabbitMQClient {
  static readonly ADS_WORKER_QUEUE_NAME = "ads_events_worker_queue";
  private rabbitMqClientParams: ADSRabbitMQClientParams;
  private connection: amqp.ChannelModel | null = null;

  constructor(rabbitMqClientParams: ADSRabbitMQClientParams) {
    this.rabbitMqClientParams = rabbitMqClientParams;
  }

  connect = async () => {
    try {
      const { host, port, username, password } = this.rabbitMqClientParams;
      const conn = await amqp.connect({
        hostname: host,
        port,
        username,
        password,
      });
      this.connection = conn;
      await this.createAdsWorkerQueueIfNotExists();
      LOGGER.info("Connected to RabbitMQ broker.");
    } catch (error) {
      LOGGER.error("Failed to connect to RabbitMQ broker", error);
      this.connection = null;
      throw error;
    }
  };

  disconnect = async () => {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
      LOGGER.info("Disconnected from RabbitMQ broker.");
    }
  };

  isConnected = () => {
    return this.connection !== null;
  };

  getChannel = async () => {
    if (!this.isConnected() || !this.connection) {
      throw new Error("Not connected to RabbitMQ broker.");
    }
    const channel = await this.connection.createChannel();
    return channel;
  };

  createAdsWorkerQueueIfNotExists = async () => {
    const channel = await this.getChannel();
    await channel.assertQueue(ADSRabbitMQClient.ADS_WORKER_QUEUE_NAME, {
      durable: true,
    });
    LOGGER.debug(
      `RabbitMQ Worker Queue '${ADSRabbitMQClient.ADS_WORKER_QUEUE_NAME}' created or already exists.`
    );
    await channel.close();
  };
}

// ADSBridgeClient - Used by ADSSubscriber to connect to ADS Bridge via Socket.io and hear for events
export class ADSBridgeClient {
  bridgeClientParams: ADSBridgeClientParams;
  socketIoClient: Socket;

  constructor(bridgeClientParams: ADSBridgeClientParams) {
    this.bridgeClientParams = bridgeClientParams;
    this.socketIoClient = io(bridgeClientParams.connection_string, {
      autoConnect: false,
      withCredentials: true,
      retries: 5,
      path: this.bridgeClientParams.path_prefix
        ? this.bridgeClientParams.path_prefix != "/"
          ? `${this.bridgeClientParams.path_prefix}/socket.io`
          : "/socket.io"
        : `/ads_bridge/socket.io`,
    });

    // Socket.io lifecycle events
    this.socketIoClient.on("connect", () => {
      LOGGER.info("Connected to ADS Bridge via Socket.io");
    });
    this.socketIoClient.on("disconnect", (reason, description) => {
      LOGGER.info(`Disconnected from ADS Bridge.`, { reason, description });
    });
    this.socketIoClient.on("error", (error) => {
      LOGGER.error(`Error occurred while connecting to ADS Bridge`, error);
    });
  }

  connect = async () => {
    return new Promise((resolve, reject) => {
      try {
        const socketConn = this.socketIoClient.connect();

        socketConn.on("connect", () => {
          return resolve(true);
        });
        socketConn.on("error", (err) => {
          return reject(err);
        });
      } catch (error) {
        LOGGER.error("Failed to connect to ADS Bridge", error);
        return reject(error);
      }
    });
  };

  disconnect = async () => {
    this.socketIoClient.disconnect();
  };

  isConnected = () => {
    return this.socketIoClient.connected;
  };
}
