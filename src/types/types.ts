export interface ADSDataPayload {
  event_name: string;
  event_description: string;
  event_data: Record<string, any>;
}

export interface ADSRabbitMQClientParams {
  host: string;
  port: number;
  username: string;
  password: string;
}

export interface ADSBridgeClientParams {
  connection_string: string;
  path_prefix: string; // Used when ADS Bridge behind reverse proxy - defaults to '/ads_bridge'
}

export interface RedisParams {
  host: string;
  port: number;
}
