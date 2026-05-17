#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createRemarkableMcpServer } from "./server.js";

const server = createRemarkableMcpServer();
const transport = new StdioServerTransport();

await server.connect(transport);
