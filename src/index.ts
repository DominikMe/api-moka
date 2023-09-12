import * as fs from "fs/promises";
import * as rimraf from "rimraf";
import SwaggerParser from "@apidevtools/swagger-parser";

type OpenApi = Awaited<ReturnType<typeof SwaggerParser.validate>>;

const generateServiceMocks = async (outputPath: string, specs: string[]) => {
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
  return `app.${method}("${path}", (req, res) => {
        res.send({ msg: "${Buffer.from(
          Math.random().toString().substring(2, 6),
        ).toString("base64")}"});
    });`;
};

const copyOpenApi = async (
  outputPath: string,
  service: string,
  spec: string,
) => {
  let openApi: any;
  if (spec.startsWith("http")) {
    openApi = await (await fetch(spec)).json();
  }
  else {
    openApi = JSON.parse(await fs.readFile(spec, { encoding: "utf-8" }));
  }
  openApi.schemes = ["http"];
  openApi.host = "localhost:3000";
  const content = JSON.stringify(openApi, null, 2);
  await fs.writeFile(`${outputPath}/src/${service}/openapi.json`, content, {
    encoding: "utf-8",
  });
};

await generateServiceMocks("output", ["test/communicationservicesrooms.json", "https://raw.githubusercontent.com/Azure/azure-rest-api-specs/main/specification/communication/data-plane/Identity/stable/2023-08-01/CommunicationIdentity.json"]);
