import WebSocket from 'ws';
import https from 'https';
import fs from 'fs';
import {
  SchemaValidator,
  schemas,
} from '@0xproject/json-schemas';

import {
  redisClient,
  coRedisClient,
} from '../redis';
import config from '../config';
import {
  createLogger,
} from '../logger';
import {
  fieldsToSkip,
} from '../apiServer/endpoints';

export const logger = createLogger(
  'socketServer',
  'debug',
);
logger.debug('socketServer logger was created');

// Check if val1 doesn't exist or equal to val1
const shouldExistAndEqual = (val1, val2) => (val1 ? val1 === val2 : true);

const removeProps = (...propsToFilter) => obj => Object.keys(obj)
  .filter(key => !propsToFilter.includes(key))
  .reduce((newObj, key) => {
    newObj[key] = obj[key];
    return newObj;
  }, {});

const validator = new SchemaValidator();

export function runWebSocketServer() {
  let server = null;
  if (config.SSL) {
    server = https.createServer(
      {
        key: fs.readFileSync('./key.pem'),
        cert: fs.readFileSync('./cert.pem'),
        passphrase: 'passphrase',
      },
    );
  }

  const wss = new WebSocket.Server({
    ...(!server ? { port: config.socketPort } : {}),
    ...(server ? { server } : {}),
    clientTracking: true,
  });

  wss.on('listening', () => {
    const wssAddress = wss.address();
    logger.info(`Server listening on port ${wssAddress.port}`);
  });

  wss.on('connection', (ws) => {
    logger.debug('ws client connected');

    ws.subscriptions = {};

    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (message) => {
      logger.debug(`received: ${message}`);
      const data = JSON.parse(message);

      if (
        data.type === 'subscribe'
        && data.requestId
      ) {
        logger.debug('subscribe');
        ws.subscriptions[data.requestId] = data;
      }

      if (
        data.type === 'unsubscribe'
        && data.requesId
      ) {
        logger.debug('unsubscribe');
        ws.subscriptions[data.requesId] = null;
      }
      logger.debug(ws.subscriptions);
    });
  });

  const redisSub = redisClient.duplicate();
  redisSub.on('message', async (channel, message) => {
    const tradingInfo = JSON.parse(await coRedisClient.get(message));

    wss.clients.forEach((client) => {
      Object.keys(client.subscriptions).forEach((subId) => {
        const sub = client.subscriptions[subId];
        if (
          sub.channel === 'tradingInfo'
          && (
            sub.payload.pairs.some(
              pair => (
                pair.networkId === tradingInfo.networkId
                && (
                  (
                    pair.assetDataA === tradingInfo.assetDataA
                    && pair.assetDataB === tradingInfo.assetDataB
                  ) || (
                    pair.assetDataB === tradingInfo.assetDataA
                    && pair.assetDataA === tradingInfo.assetDataB
                  )
                )),
            )
          )
        ) {
          logger.debug('SEND!!!');
          client.send(JSON.stringify({
            type: 'update',
            channel: 'tradingInfo',
            requestId: sub.requestId,
            payload: [
              tradingInfo,
            ],
          }));
        }
      });
    });
  });
  redisSub.subscribe('tradingInfo');

  const redisSRA = redisClient.duplicate();
  redisSRA.on('message', async (channel, message) => {
    logger.debug('Hiii');

    wss.clients.forEach((client) => {
      Object.keys(client.subscriptions).forEach((subId) => {
        const sub = client.subscriptions[subId];
        logger.debug('Hello');
        const order = JSON.parse(message);
        logger.debug(order);

        if (
          sub.channel === 'orders'
          && validator.isValid(sub.payload, schemas.relayerApiOrdersChannelSubscribePayload)
          && order.networkId === (sub.payload.networkId || 1)
          && shouldExistAndEqual(sub.payload.makerAssetProxyId, order.makerAssetProxyId)
          && shouldExistAndEqual(sub.payload.takerAssetProxyId, order.takerAssetProxyId)
          && shouldExistAndEqual(sub.payload.makerAssetAddress, order.makerAssetAddress)
          && shouldExistAndEqual(sub.payload.takerAssetAddress, order.takerAssetAddress)
          && shouldExistAndEqual(sub.payload.makerAssetData, order.makerAssetData)
          && shouldExistAndEqual(sub.payload.takerAssetData, order.takerAssetData)
          && (
            shouldExistAndEqual(sub.payload.traderAssetData, order.makerAssetData)
            || shouldExistAndEqual(sub.payload.traderAssetData, order.makerAssetData)
          )
        ) {
          logger.debug('SEND!!!');
          const clearOrder = removeProps(...fieldsToSkip)(order);

          client.send(JSON.stringify({
            type: 'update',
            channel: 'orders',
            requestId: sub.requestId,
            payload: clearOrder,
          }));
        }
      });
    });
  });
  redisSRA.subscribe('orders');

  if (server) {
    server.listen(config.socketPort);
  }
  return wss;
}