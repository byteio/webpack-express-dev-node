import { join, isAbsolute } from 'path';
import ExpressModule, { Request, Response, Application, Router } from 'express';
import webpack, { HotModuleReplacementPlugin, Configuration } from 'webpack';
import devMiddleware from 'webpack-dev-middleware';
import hotMiddleware from 'webpack-hot-middleware';
import nodeExternals from 'webpack-node-externals';

interface ExpressApplicationProperties extends Application {
    [key: string]: unknown;
}

interface FlagSpec {
    code: string;
    helpMsg: string;
    optionKey: string;
    needsValue?: boolean;
}

interface CLIOptions {
    help: boolean;
    clientConfigPath?: string;
    serverConfigPath?: string;
    entryConfigPath?: string;
}

interface WebpackConfigs {
    serverConfig?: Configuration;
    clientConfig?: Configuration;
}

interface State {
    startCount: number;
    indexPos: number;
    hookedExpressApp?: Application;
}

type FlagSpecMap = { [key: string]: FlagSpec };

const flags: FlagSpecMap = {
    'server-config': {
        optionKey: 'serverConfigPath',
        code: 's',
        helpMsg: 'Specify path to your webpack config for the server',
        needsValue: true,
    },
    'client-config': {
        optionKey: 'clientConfigPath',
        code: 'c',
        helpMsg: 'Specify path to your webpack config for client assets',
        needsValue: true,
    },
    'help': {
        optionKey: 'help',
        code: 'h',
        helpMsg: 'Display help',
    },
};


const requireRef = require;

const exit = (exitCode?: number) => {
    if (process.env.NODE_ENV !== 'test') {
        process.exit(exitCode);
    }
    console.warn('exited', exitCode);
};

const flagCodeMap: FlagSpecMap = Object.keys(flags).reduce((map, flagKey: string) => (
    { ...map, [flags[flagKey].code]: flags[flagKey] }
), {});

const parseParamToken = (token: string): [Partial<FlagSpec>, string?] => {
    const match = /(-([\w-]{1,1})|--([\w-]+))(?:=(.*))?$/.exec(token);
    if (!match) return [{}];
    const [,,flag, value] = match.filter(Boolean);
    const flagSpec = flags[flag && flag.toLowerCase()] || flagCodeMap[flag];
    if (!flagSpec) throw new Error(`Invalid parameter ${flag}`);
    return [flagSpec, value];
};

const fatalError = (msg: string) => {
    process.stdout.write(`${msg}\n`);
    exit(1);
};

export const parseCLIParams = (args: string[]): Partial<CLIOptions> => {
    let skip: boolean;
    let flagSet: boolean;
    return args.reduce((options: Partial<CLIOptions>, arg: string, index: number) => {
        if (skip) {
            skip = false;
            return options;
        }
        const getNextValue = (() => {
            skip = true;
            return args[index + 1];
        });

        const [{ optionKey: flag, needsValue }, value] = parseParamToken(arg);
        if (flag) {
            flagSet = true;
            if (value) return { ...options, [flag]: value };
            return { ...options, [flag]: (needsValue ? getNextValue() : true) };
        }

        if (!flagSet && index === args.length - 1) {
            options.entryConfigPath = arg;
        }

        return options;
    }, {});
};

const state: State = {
    startCount: 0,
    indexPos: 0,
    hookedExpressApp: undefined,
};

const routers: Router[] = [];

const propertyHook = (expressApp: ExpressApplicationProperties, keyName: string) => {
    const { indexPos } = state;
    switch (keyName) {
        case 'listen':
            if (state.startCount > 1) return () => {};
            return expressApp[keyName];
        case 'use': {
            state.indexPos += 1;
            routers[indexPos] = ExpressModule.Router();
            if (state.startCount === 1) {
                expressApp.use((...args) => routers[indexPos](...args));
            }
            return (...args: []) => routers[indexPos].use(...args);
        }
        default: 
            return expressApp[keyName];
    }
};

type ConfigWithDev = Configuration & { devServer: { publicPath: string } };
const getConstructorHook = (express: any, clientConfig?: Configuration) => {
    return (_target: unknown, thisArg: unknown, argList: [Request, Response]) => {
        state.startCount += 1;
        state.indexPos = 0;
        if (state.hookedExpressApp) return state.hookedExpressApp;

        const expressApp = express(...argList);
        if (clientConfig) {
            const clientCompiler = webpack(clientConfig);
            const devServerOptions = (clientConfig as ConfigWithDev).devServer;
            expressApp.use(hotMiddleware(clientCompiler));
            expressApp.use(devMiddleware(clientCompiler, devServerOptions));
        }
        state.hookedExpressApp = new Proxy(expressApp, { get: propertyHook });
        return state.hookedExpressApp;
    };
};

const printHelp = () => {
    const maxLen = Object.keys(flags).reduce((max, key) => (key.length > max ? key.length : max), 0);
    const flagHelp = Object.keys(flags).reduce((flagHelp, flagKey) => {
        const space = ' '.repeat(Math.max(maxLen - flagKey.length - 1, 0));
        const { code, helpMsg } = flags[flagKey];
        const codeMsg = code ? `-${code}, ` : '';
        const helpLine = `${codeMsg}--${flagKey}\t\t${space}${helpMsg}`;
        return [...flagHelp, helpLine];
    }, []);
    const msgData = [
        'Usage: webpack-express-dev-middleware [script]',
        '\twebpack-express-dev-middleware [options]',
        '\twedm [options]',
        '',
        'Options:',
        ...flagHelp,
        '\n',
    ];
    const msg = msgData.reduce((msg, line) => `${msg}\n${line}`);
    process.stdout.write(msg);
    exit();
};


const identifyEntries = (entryPath: string): WebpackConfigs  => {
    //TODO: unit test this
    //TODO: is this even needed? the user is typing this in command line they can just write the correct thing?
    const isStablePath = (path: string): boolean => {
        if (!path) return false;
        if (path[0] === '~') return true;
        return isAbsolute(path);
    };

    const reduceEntryArray = (entryConfig: Configuration[], path: string): WebpackConfigs | undefined => {
        if (!Array.isArray(entryConfig)) return undefined;
        if (entryConfig.length > 2) {
            throw new Error(`Too many webpack configurations contained in ${path}`);
        }
        const entries = entryConfig.reduce((entries, entry) => {
            if (entry.target === 'node') return { ...entries, serverConfig: entry };
            return { ...entries, clientConfig: entry };
        }, {} as WebpackConfigs);

        if (!entries.serverConfig) {
            throw new Error(`No server config was found in ${path}`);
        }
        return entries;
    };
    const fullPath = isStablePath(entryPath) ? entryPath : join(process.cwd(), entryPath); 
    const entryConfig = fullPath && require(fullPath);
    const webpackConfigs = reduceEntryArray(entryConfig, fullPath);
    if (webpackConfigs) return webpackConfigs;
};

//TODO unit test this stuff applies when its supposed to
const applyPreferredConfigSettings = ({ serverConfig, clientConfig }: WebpackConfigs) => {
    if (serverConfig) {
        serverConfig.mode = 'development';
        serverConfig.watch = true;
        if (!serverConfig.externals) {
            serverConfig.externals = [nodeExternals()];
        } else if (Array.isArray(serverConfig.externals)) {
            const nodeExt = serverConfig.externals.find(item => {
                if (typeof item !== 'function') return;
                return /mark this module as external/.exec(item.toString());
            });
            if (!nodeExt) {
                serverConfig.externals.push(nodeExternals());
            }
        }
    }
    if (clientConfig) {
        let { plugins, entry } = clientConfig;
        const hmrEntry = 'webpack-hot-middleware/client';
        clientConfig.mode = 'development';
        if (!plugins) {
            plugins = [new HotModuleReplacementPlugin()];
            clientConfig.plugins = plugins;
        }
        if (!plugins.find(item => item instanceof HotModuleReplacementPlugin)) {
            plugins.unshift(new HotModuleReplacementPlugin());
        }
        if (typeof entry === 'string') {
            entry = [hmrEntry, entry];
            clientConfig.entry = entry;
        }
        if (Array.isArray(entry) && !entry.find(item => item.match(/webpack-hot-middleware/))) {
            entry.unshift(hmrEntry);
        }
    }
};

export const resolveConfigs = (cmdLineArgs: string[]): WebpackConfigs => {
    const { serverConfigPath, clientConfigPath, entryConfigPath, help } = parseCLIParams(cmdLineArgs);
    const configs: Partial<WebpackConfigs> = {};
    if (help) {
        printHelp();
    }
    configs.serverConfig = serverConfigPath && require(serverConfigPath);
    configs.clientConfig = clientConfigPath && require(clientConfigPath);
    if (entryConfigPath) {
        const { serverConfig, clientConfig } = identifyEntries(entryConfigPath);
        configs.serverConfig = serverConfig;
        configs.clientConfig = clientConfig;
    }

    if (!configs.serverConfig) {
        printHelp();
        fatalError('No webpack config was specified for the server');
    }
    if (!configs.clientConfig) {
        console.warn('No client config was specified');
    }

    applyPreferredConfigSettings(configs);
    return configs;
};

const getHookedRequire = (clientConfig: Configuration) => {
    return (modName: string) => {
        const mod = requireRef(modName);
        if (modName !== 'express') return mod;
        return new Proxy(mod, { apply: getConstructorHook(mod, clientConfig) });
    };
};

export const runServer = (args: string[]) => {
    const { serverConfig, clientConfig } = resolveConfigs(args);
    const hookedRequire = getHookedRequire(clientConfig);
    return new Promise((resolve) => {
        webpack(serverConfig, (err, { compilation }) => {
            const { assets, errors } = compilation;
            if (err) {
                console.error(err);
                return;
            }
            if (errors.length > 0) {
                errors.forEach((err: Error) => {
                    console.error(err);
                });
                throw new Error('Could not compile server');
            }
            const serverCode = Object.keys(assets).reduce((src, assetKey) => (
                `${src}${assets[assetKey].source()}`
            ), '');
            const runServerCode = new Function('require', serverCode);
            runServerCode(hookedRequire);
            resolve();
        });
    });
};
