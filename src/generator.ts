import * as fs from "fs/promises";
import * as rimraf from "rimraf";
import SwaggerParser from "@apidevtools/swagger-parser";

type OpenApi = Awaited<ReturnType<typeof SwaggerParser.validate>>;

export const generateServiceMocks = async (
  outputPath: string,
  specs: string[],
) => {
  await rimraf.rimraf(outputPath);
  await fs.mkdir(`${outputPath}/src`, { recursive: true });
  let services: string[] = [];
  for (const spec of specs) {
    const openApi = await parseSpec(spec);
    const service = openApi.info.title.replaceAll(" ", "");
    services.push(service);
    await fs.mkdir(`${outputPath}/src/${service}`);
    await generateApi(outputPath, service, openApi);
    await copyOpenApi(outputPath, service, spec);
  }
  await generateApp(outputPath, services);
  await fs.copyFile("templates/package.json", `${outputPath}/package.json`);
  await fs.copyFile("templates/tsconfig.json", `${outputPath}/tsconfig.json`);
};

const generateImports = (services: string[]) => {
  let imports = [];
  let mapCalls = [];
  for (const service of services) {
    const mapFunction = `map${uppercaseFirstLetter(service)}`;
    imports.push(`import { ${mapFunction} } from "./${service}/api.js";`);
    mapCalls.push(`${mapFunction}(app);`);
  }
  return {
    imports,
    mapCalls,
  };
};

const parseSpec = async (spec: string) => await SwaggerParser.validate(spec);

const uppercaseFirstLetter = (s: string) =>
  `${s.toUpperCase()[0]}${s.substring(1)}`;

const generateApp = async (outputPath: string, services: string[]) => {
  const template = await fs.readFile("templates/src/app.ts", {
    encoding: "utf-8",
  });
  const { imports, mapCalls } = generateImports(services);
  let content = template
    .replaceAll("// %IMPORT_APIS%", imports.join("\n"))
    .replaceAll("// %MAP_APIS%", mapCalls.join("\n"));
  await fs.writeFile(`${outputPath}/src/app.ts`, content, {
    encoding: "utf-8",
  });
};

const generateApi = async (
  outputPath: string,
  service: string,
  openApi: OpenApi,
) => {
  const content = `import { Express } from "express";

export const map${uppercaseFirstLetter(service)} = (app: Express) => {
    ${generateRoutes(openApi).join("\n    ")}
};
`;
  await fs.writeFile(`${outputPath}/src/${service}/api.ts`, content, {
    encoding: "utf-8",
  });
};

const generateRoutes = (openApi: OpenApi): string[] => {
  let routes: string[] = [];
  for (const path in openApi.paths) {
    const pathObject = openApi.paths[path] as any;
    for (const method of ["get", "post", "put", "patch", "delete"]) {
      const route = pathObject[method];
      if (!route) continue;
      const routeCode = generateRoute(path, method, pathObject[method]);
      routes.push(routeCode);
    }
  }
  return routes;
};

const generateRoute = (path: string, method: string, route: any): string => {
  const expressPath = path.replaceAll("{", ":").replaceAll("}", "");
  const response = generateResponse(route);
  return `app.${method}("${expressPath}", (req, res) => {
        res.status(${response.status}).send(${JSON.stringify(
          response.body,
          null,
          2,
        )
          .replace(/\"([^(\")"]+)\":/g, "$1:")
          .replaceAll("\n", "\n        ")});
    });`;
};

const generateResponse = (route: any) => {
  const firstStatusCode = Object.keys(route.responses)[0];
  const firstReply = route.responses[firstStatusCode];
  let body = {};
  if (firstReply.schema) {
    body = generateResponsePayload(firstReply.schema);
  }
  return {
    status: firstStatusCode,
    body,
    headers: {},
  };
};

const generateResponsePayload = (definition: any) => {
  let payload = {} as any;
  switch (definition.type) {
    case "object":
      for (let prop in definition.properties) {
        payload[prop] = generateResponsePayload(definition.properties[prop]);
      }
      break;
    case "string":
      if (definition.format === "date-time") {
        payload = new Date().toISOString();
      } else if (definition.format === "uuid") {
        payload = "00000000-0000-0000-0000-000000000000";
      } else if (definition.format === "byte") {
        payload = "string";
      } else if (definition.enum) {
        payload = definition.enum[0];
      } else {
        payload = "string";
      }
      break;
    case "integer":
      payload = 0;
      break;
    case "boolean":
      payload = false;
      break;
    case "array":
      payload = [generateResponsePayload(definition.items)];
      break;
  }
  return payload;
};

const copyOpenApi = async (
  outputPath: string,
  service: string,
  spec: string,
) => {
  let text = "";
  if (spec.startsWith("http")) {
    let response = await fetch(spec);
    text = await response.text();
  } else {
    text = await fs.readFile(spec, { encoding: "utf-8" });
  }
  const openApi = JSON.parse(hackToMakeSwaggerEditorWork(text));
  openApi.schemes = ["http"];
  openApi.host = "localhost:3000";
  const content = JSON.stringify(openApi, null, 2);
  await fs.writeFile(`${outputPath}/src/${service}/openapi.json`, content, {
    encoding: "utf-8",
  });
};

const hackToMakeSwaggerEditorWork = (openApi: string) => {
  // replace unresolved external refs with object type
  return openApi.replaceAll(/\s*"\$ref": "[^#][^\s]+/g, '"type": "object"');
};
