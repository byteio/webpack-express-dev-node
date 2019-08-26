import express, { Request } from 'express';
const { TEST_APP_PORT } = process.env;
const server = express();

const testPayload = { __testPayload: 'd2f254c8835a9f52fae59cbf326fcea816f550ae' };

server.get('/', (req: Request) => {
    req.res.json(testPayload);
});

server.listen(TEST_APP_PORT, () => {
    console.log('Hosting Fixture Server On', TEST_APP_PORT);
});
