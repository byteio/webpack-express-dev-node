import { parseCLIParams, runServer } from '../lib';
import axios from 'axios';

process.env.TEST_APP_PORT = '54040';
const { TEST_APP_PORT } = process.env;

const fakeArgs = ['/usr/bin/node', '/home/project/launcher'];

test('can parse cli params', () => {
    expect(parseCLIParams([...fakeArgs, '--client-config', '/some/path'])).toEqual({
         clientConfigPath: '/some/path', 
    });
    expect(parseCLIParams([...fakeArgs, '--client-config=/some/path'])).toEqual({
         clientConfigPath: '/some/path', 
    });
    expect(parseCLIParams([...fakeArgs, '-c', '/some/path'])).toEqual({
         clientConfigPath: '/some/path', 
    });
    expect(parseCLIParams([...fakeArgs, '-c=/some/path'])).toEqual({
         clientConfigPath: '/some/path', 
    });
    expect(parseCLIParams([...fakeArgs, '-c', '/client/path', '-s', '/server/path'])).toEqual({
         clientConfigPath: '/client/path', 
         serverConfigPath: '/server/path', 
    });
    expect(parseCLIParams([...fakeArgs, '/entry/path'])).toEqual({
         entryConfigPath: '/entry/path', 
    });
});

test('can load multiple webpack configurations from a single file', async (done) => {
    await runServer(['', './test/fixture/webpack-config/webpack.entry.fixture']);
    const url = `http://localhost:${TEST_APP_PORT}/test.bundle.js`;
    axios({ method: 'get', url }).then(({ data }) => {
        expect(data).toMatch('webpackBootstrap');
        done();
    });
});
