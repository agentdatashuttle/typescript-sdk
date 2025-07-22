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
  ads_subscribers_pool_id: string; // Pool ID to group horizontally scaled replicas of ADS Subscribers to ensure only one subscriber receives the event
}

export interface RedisParams {
  host: string;
  port: number;
  username?: string;
  password?: string;
}
