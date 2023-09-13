#!/usr/bin/env node
import { program } from "commander";
import { generateServiceMocks } from "./generator.js";
import { spawn } from "child_process";

program
  .name("api-moka")
  .description("Generate mock APIs from OpenAPI specs")
  .option("-o, --output <path>", "Output path")
  .option("-s, --spec <paths...>", "OpenAPI spec paths")
  .option("-r, --run", "Immediately run the generated mock server")
  .action(async (options) => {
    await generateServiceMocks(options.output, options.spec);
    if (options.run) {
      spawn(
        `start cmd.exe /k "cd ${options.output} && npm i && code . && npm run build && npm run start"`,
        { detached: true, shell: true, stdio: "ignore" },
      );
    }
  });

program.parse();
