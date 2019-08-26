#!/usr/bin/env node

import { runServer } from './lib';

if (require.main === module) {
    runServer(process.argv);
}
