import { ADSBridgeClient } from "./client";
import { ADSBridgeClientParams } from "../types/types";
import { createLogger } from "../utils/logger";

const LOGGER = createLogger("ADSDataConnector");

export class ADSDataConnector {
  adsBridgeClient: ADSBridgeClient;
  bridgeClientParams: ADSBridgeClientParams;
  connectorName: string;
  adsPublishSocketEventName: string;

  constructor(
    connectorName: string,
    bridgeClientParams: ADSBridgeClientParams,
    adsPublishSocketEventName: string = "ads_event_published"
  ) {
    this.connectorName = connectorName;
    this.bridgeClientParams = bridgeClientParams;
    this.adsPublishSocketEventName = adsPublishSocketEventName;
    this.adsBridgeClient = new ADSBridgeClient(bridgeClientParams);
  }

  /**
   * Set up a callback function to listen to Socket.io messages from ADS Bridge
   */
  setupCallback = async (callback: any) => {
    return new Promise((resolve, reject) => {
      try {
        if (!this.adsBridgeClient.isConnected()) {
          throw new Error(
            "ADSBridgeClient is not connected to the ADS Bridge."
          );
        }

        this.adsBridgeClient.socketIoClient.on(
          this.adsPublishSocketEventName,
          callback
        );

        LOGGER.debug(
          `Callback set up for message processing from ADS Bridge for connector: ${this.connectorName}`
        );

        return resolve(true);
      } catch (error) {
        LOGGER.error(
          `Error in consuming events from ADS Bridge for connector '${this.connectorName}':`,
          error
        );
        return reject(error);
      }
    });
  };
}
